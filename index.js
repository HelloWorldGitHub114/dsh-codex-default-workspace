/**
 * dsh-codex-default-workspace：默认工作区里的每段新会话，使用
 * <默认工作区>/YYYY-MM-DD/<会话ID>/ 作为实际工作目录。
 *
 * 默认工作区的确定顺序（都按内部工作区 ID 匹配，不依赖显示名称变化）：
 * 1. $DSH_HOME/storages/codex-default-workspace.json 中的 workspaceId；
 * 2. DSH 原生记录的默认工作区 defaultWorkspaceId（其注册项仍存在时）；
 * 3. 推测：标题为“默认工作区 / default-workspace / Default workspace”，或目录名为 default-workspace 的工作区；
 * 4. 都找不到：插件不接管任何会话，界面给出提示。
 *
 * 实现机制（DSH 原生事件 + 最小化持久化）：
 * - working-directory/access（waterfall）：新会话首次运行时在磁盘建立子目录，并追加一条原生
 *   working-directory/change 事件；随后的 ensure()、cd、相对路径解析、侧边栏文件树与系统提示词全部交由 DSH 原生处理。
 * - 默认即零文件：仅当用户修改为非默认设置时才写入 ~/.dsh/storages/codex-default-workspace.json；恢复默认或执行清理命令时自动删除该文件。
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'

export const inject = ['workingDirectory', 'agents', 'systemPrompt', 'storageDomain', 'workspaceRegistry']

const CONVENTION_CONTEXT = 'codex-default-workspace:convention'
const API = '/api/dsh-codex-default-workspace'
const GUESS_TITLES = ['默认工作区', 'default-workspace', 'default workspace']
const DATE_SEGMENT = /^\d{4}-\d{2}-\d{2}$/
const SESSION_SEGMENT = /^(?:session-[\w-]+|[0-9a-f]{8}-[0-9a-f-]{4,})$/i

const pad = n => String(n).padStart(2, '0')
const dateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const same = (a, b) => (process.platform === 'win32' ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b))

const isInsideSessionDir = (root, targetPath, expectedId) => {
  if (typeof root !== 'string' || root === '' || typeof targetPath !== 'string' || targetPath === '') return false
  const rel = relative(resolve(root), resolve(targetPath))
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return false
  const parts = rel.split(/[\\/]/)
  if (parts.length < 2 || !DATE_SEGMENT.test(parts[0])) return false
  if (expectedId !== undefined) {
    return process.platform === 'win32'
      ? parts[1].toLowerCase() === expectedId.toLowerCase()
      : parts[1] === expectedId
  }
  return SESSION_SEGMENT.test(parts[1])
}

const normalizeSettings = (raw, fallback = {}) => ({
  workspaceId: typeof raw?.workspaceId === 'string' ? raw.workspaceId : (typeof fallback.workspaceId === 'string' ? fallback.workspaceId : ''),
  workOutputs: typeof raw?.workOutputs === 'boolean' ? raw.workOutputs : (typeof fallback.workOutputs === 'boolean' ? fallback.workOutputs : true),
})

const isDefaultSettings = s => s.workspaceId === '' && s.workOutputs === true

const loadSettings = async (settingsPath, fallback) => {
  try {
    const text = await readFile(settingsPath, 'utf8')
    return normalizeSettings(JSON.parse(text), fallback)
  } catch {
    return normalizeSettings(undefined, fallback)
  }
}

export async function apply(ctx, config = {}) {
  const resolveDshHome = ctx.get('dshHomePath')
  const dshHome = typeof resolveDshHome === 'function'
    ? resolveDshHome()
    : (process.env.DSH_HOME?.trim() || join(homedir(), '.dsh'))
  const SETTINGS_PATH = join(dshHome, 'storages', 'codex-default-workspace.json')
  let state = await loadSettings(SETTINGS_PATH, config)

  const fresh = new Set() // 默认工作区中尚未执行过的新会话
  const managed = new Set() // 归属本插件管理的会话（用于 work/outputs 约定）
  const stopped = new Set() // 用户主动清理后本生命周期不再接管的会话
  const warned = new Set() // 已提示过建目录失败的会话

  ctx.effect(() => () => {
    fresh.clear()
    managed.clear()
    stopped.clear()
    warned.clear()
  })

  // 按“插件配置 → 原生默认 → 名称推测”的顺序确定默认工作区
  const resolveDefault = () => {
    const registry = ctx.workspaceRegistry
    if (state.workspaceId !== '') {
      const w = registry.get(state.workspaceId)
      if (w !== undefined) return { source: 'user', workspace: w }
    }
    const nativeId = ctx.storageDomain.get('workspace')?.global.get()?.defaultWorkspaceId
    const native = nativeId === undefined ? undefined : registry.get(nativeId)
    if (native !== undefined) return { source: 'native', workspace: native }
    const guess = registry.list().find(w => GUESS_TITLES.includes(w.title.trim().toLowerCase()) || basename(w.path).toLowerCase() === 'default-workspace')
    if (guess !== undefined) return { source: 'guess', workspace: guess }
    return { source: 'none', workspace: undefined }
  }
  const defaultRoot = () => resolveDefault().workspace?.path

  {
    const { source, workspace } = resolveDefault()
    if (workspace === undefined) ctx.logger.warn('codex-default-workspace: 未找到默认工作区，插件暂不接管会话；可在侧边栏工作区右键菜单中选择“设为默认工作区”。')
    else ctx.logger.info(`codex-default-workspace: 默认工作区 ${workspace.title} (${workspace.path})，来源 ${source}`)
  }

  const consider = agent => {
    const id = String(agent.id)
    if (stopped.has(id)) return
    const header = agent.session.header
    if (header.origin === 'subagent' || header.cwd === undefined) return
    const events = agent.session.snapshotEvents()
    const hasSubdirEvent = events.some(
      e => e.type === 'working-directory/change' && isInsideSessionDir(defaultRoot() ?? header.cwd, e.data?.cwd, id),
    )
    if (hasSubdirEvent) {
      managed.add(id)
      return
    }
    const root = defaultRoot()
    if (root === undefined || !same(header.cwd, root)) return
    if (!same(ctx.workingDirectory.get(agent.session), root)) return
    const boundary = ctx.agents.turnBoundaryOf(agent.session)
    if (boundary.lastTurn === 0 && boundary.openTurnStartSeq === null) {
      fresh.add(id)
      managed.add(id)
    }
  }

  const rescan = () => {
    fresh.clear()
    managed.clear()
    for (const agent of ctx.agents.list()) consider(agent)
  }

  const initSessionDir = async agent => {
    const id = String(agent.id)
    if (stopped.has(id) || !fresh.has(id)) return

    const root = defaultRoot()
    const headerCwd = agent.session.header.cwd
    const dir = root !== undefined && headerCwd !== undefined && same(headerCwd, root)
      ? join(root, dateStr(), id)
      : undefined
    if (dir === undefined) {
      fresh.delete(id)
      return
    }

    try {
      await mkdir(dir, { recursive: true })
      if (state.workOutputs) {
        await Promise.all([
          mkdir(join(dir, 'work'), { recursive: true }),
          mkdir(join(dir, 'outputs'), { recursive: true }),
        ])
      }
      fresh.delete(id)
      if (same(ctx.workingDirectory.get(agent.session), root)) {
        agent.session.append('working-directory/change', { cwd: dir })
      }
    } catch (error) {
      fresh.delete(id)
      if (!warned.has(id)) {
        warned.add(id)
        ctx.logger.warn(`codex-default-workspace: 无法创建会话目录 ${dir}，本会话暂用原生工作目录：${String(error?.message ?? error)}`)
      }
    }
  }

  ctx.on('agent/created', ({ agent }) => { consider(agent) })
  ctx.on('agent/disposed', ({ agent }) => {
    const id = String(agent.id)
    fresh.delete(id)
    managed.delete(id)
  })
  for (const agent of ctx.agents.list()) consider(agent)

  // 首次访问工作目录前落盘子目录并写入原生 working-directory/change 事件，随后完全交给原生 ensure/set
  ctx.on('working-directory/access', async (request, next) => {
    const id = String(request.agent.id)
    if (!stopped.has(id) && fresh.has(id)) {
      await initSessionDir(request.agent)
    }
    return next()
  }, { prepend: true })

  // 注册 work/outputs 约定上下文（required: true，保证关闭可选上下文时仍生效；子代理工作在会话目录树内时一并继承）
  const isManagedAgent = agent => {
    if (agent === undefined) return false
    const id = String(agent.id)
    if (stopped.has(id)) return false
    if (managed.has(id)) return true
    const root = defaultRoot()
    return isInsideSessionDir(root, ctx.workingDirectory.get(agent.session)) || isInsideSessionDir(root, agent.session.header.cwd)
  }

  try {
    const order = ctx.systemPrompt.getContextOrder('WORKING_DIRECTORY')
    const base = Number.isFinite(order) ? order : 100
    ctx.systemPrompt.context({
      name: CONVENTION_CONTEXT,
      order: base + 0.5,
      required: true,
      interpolate: false,
      text: ({ agent }) => (state.workOutputs && isManagedAgent(agent))
        ? '临时文件放 work/，交付文件放 outputs/。'
        : '',
    })
  } catch (error) {
    ctx.logger.warn(`codex-default-workspace: 注册目录约定上下文失败：${String(error?.message ?? error)}`)
  }

  // —— 界面接口：读取状态与更新 ~/.dsh/storages/codex-default-workspace.json（即时生效，默认即零文件） ——
  const connection = ctx.get('connection')
  const status = () => {
    const { source, workspace } = resolveDefault()
    return {
      source,
      workspaceId: workspace?.id ?? null,
      title: workspace?.title ?? null,
      path: workspace?.path ?? null,
      configuredWorkspaceId: state.workspaceId,
      configuredMissing: state.workspaceId !== '' && ctx.workspaceRegistry.get(state.workspaceId) === undefined,
      workOutputs: state.workOutputs,
      workspaces: ctx.workspaceRegistry.list().map(w => ({ id: w.id, title: w.title, path: w.path })),
      hasSettingsFile: existsSync(SETTINGS_PATH),
      canSet: true,
    }
  }
  const saveSettings = async patch => {
    if (patch.reset !== true && patch.workspaceId !== undefined && patch.workspaceId !== '' && ctx.workspaceRegistry.get(patch.workspaceId) === undefined) {
      throw new Error('workspace-missing')
    }
    const next = patch.reset === true
      ? normalizeSettings(undefined)
      : {
          workspaceId: patch.workspaceId !== undefined ? patch.workspaceId : state.workspaceId,
          workOutputs: patch.workOutputs !== undefined ? patch.workOutputs : state.workOutputs,
        }
    if (isDefaultSettings(next)) {
      await rm(SETTINGS_PATH, { force: true })
    } else {
      await mkdir(dirname(SETTINGS_PATH), { recursive: true })
      await writeFile(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    }
    state = next
    rescan()
  }

  if (connection !== undefined) {
    ctx.effect(() => connection.fetch.register({
      path: `${API}/status`,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: async () => Response.json(status(), { headers: { 'cache-control': 'no-store' } }),
    }), 'codex-default-workspace: status')
    ctx.effect(() => connection.fetch.register({
      path: `${API}/set`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async request => {
        try {
          const body = await request.json()
          const patch = {}
          if (body?.reset === true) patch.reset = true
          if (typeof body?.workspaceId === 'string') patch.workspaceId = body.workspaceId
          if (typeof body?.workOutputs === 'boolean') patch.workOutputs = body.workOutputs
          if (Object.keys(patch).length === 0) return Response.json({ ok: false, error: 'bad-request' }, { status: 400 })
          await saveSettings(patch)
          return Response.json({ ok: true, status: status() }, { headers: { 'cache-control': 'no-store' } })
        } catch (error) {
          return Response.json({ ok: false, error: String(error?.message ?? error) }, { status: 400 })
        }
      },
    }), 'codex-default-workspace: set')
  }

  const commands = ctx.get('commands')
  if (commands !== undefined) {
    // 清除插件自身配置文件：恢复默认设置并释放未初始化会话的待接管状态，不删除磁盘目录与会话记录
    ctx.effect(() => commands.register({
      name: 'codex-default-workspace-clear',
      description: '删除插件配置文件并恢复默认设置（不删除文件夹与会话） / Remove plugin config file and restore defaults (folders and sessions are kept)',
      recordInput: false,
      handler: async () => {
        await rm(SETTINGS_PATH, { force: true })
        state = normalizeSettings(undefined)
        const cleared = fresh.size
        for (const id of [...fresh, ...managed]) stopped.add(id)
        fresh.clear()
        managed.clear()
        return {
          kind: 'success',
          text: `已删除插件配置文件 ${SETTINGS_PATH} 并恢复默认设置；已取消 ${cleared} 个未初始化会话的接管（磁盘文件夹与会话记录保留）。\nRemoved plugin config file ${SETTINGS_PATH} and restored defaults; released ${cleared} uninitialized session(s) (folders on disk and session logs are kept).`,
        }
      },
    }))
  }
}
