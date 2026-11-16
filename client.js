// 界面部分（三个入口共用同一个 Host 接口）：
// 1. 侧边栏工作区右键 / “…”菜单：“设为默认工作区”；
// 2. 插件详情页的配置卡片；
// 3. 设置面板里的独立页面“Codex 式默认工作区”。
// 设置卡片可选择默认工作区、开关 work/outputs 约定；找不到默认工作区时给出提示。
window.__ModuleLoader__.load({
  id: 'dsh-codex-default-workspace',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const PKG = 'dsh-codex-default-workspace'
    const NS = 'codex-default-workspace'
    const API = 'api/dsh-codex-default-workspace'
    const AUTO = ''
    const DICT = {
      zh: {
        set: '设为默认工作区',
        current: '默认工作区（会话独立目录）',
        done: '已将“{title}”设为默认工作区，之后在这里新建的会话会使用独立子目录。',
        failed: '设置失败',
        none: 'Codex 式默认工作区：未找到默认工作区。在侧边栏右键一个工作区，选择“设为默认工作区”。',
        section: 'Codex 式默认工作区',
        nav: '默认工作区',
        intro: '默认工作区中的每段新会话首次运行时，自动使用 默认工作区/YYYY-MM-DD/会话ID 作为工作目录。会话仍显示在默认工作区下。',
        workspaceLabel: '默认工作区',
        workspaceHint: '自动：依次使用 DSH 原生默认工作区、名为“默认工作区”的工作区。',
        auto: '自动',
        effective: '当前生效：{title}（{source}）',
        sourceUser: '你的设置',
        sourceNative: 'DSH 原生默认',
        sourceGuess: '按名称推测',
        noneFound: '未找到默认工作区，插件暂不接管会话。请在上面选择一个工作区。',
        woLabel: 'work / outputs 目录约定',
        woHint: '默认开启：新会话目录内创建 work/ 与 outputs/，并告知模型「临时文件放 work/，交付文件放 outputs/」。关闭后不再自动创建；已有文件不受影响。',
        saved: '已保存，新设置已立即生效，将用于之后新建或运行的会话。',
        readonly: '当前配置不可写，无法在此修改。',
        loading: '正在读取…',
        loadFailed: '读取失败：{error}',
        'err.readonly': '当前配置不可写。',
        'err.workspace-missing': '所选工作区不存在。',
        'err.bad-request': '请求无效。',
        configMissing: '你之前选择的工作区已不存在，当前已回退到自动选择。可以在上面重新选择。',
        resetLabel: '恢复默认并清理配置文件',
        resetHint: '将选项还原为自动选择，并删除 ~/.dsh/storages/codex-default-workspace.json；已创建的会话目录与文件保留。',
        resetDone: '已恢复默认设置，并已清理 ~/.dsh/storages/ 下的配置文件。',
      },
      en: {
        set: 'Set as default workspace',
        current: 'Default workspace (session folders)',
        done: '"{title}" is now the default workspace. New sessions there use their own folders.',
        failed: 'Could not save',
        none: 'Codex-style default workspace: no default workspace found. Right-click a workspace in the sidebar and choose "Set as default workspace".',
        section: 'Codex-style default workspace',
        nav: 'Default workspace',
        intro: 'On its first run, each new session in the default workspace uses default workspace/YYYY-MM-DD/session id as its working directory. Sessions still appear under the default workspace.',
        workspaceLabel: 'Default workspace',
        workspaceHint: 'Automatic: DSH\'s native default workspace, then a workspace named "Default workspace".',
        auto: 'Automatic',
        effective: 'In effect: {title} ({source})',
        sourceUser: 'your choice',
        sourceNative: 'DSH native default',
        sourceGuess: 'matched by name',
        noneFound: 'No default workspace found; no sessions are taken over. Choose a workspace above.',
        woLabel: 'work / outputs convention',
        woHint: 'Enabled by default: creates work/ and outputs/ in each session folder and tells the model that temporary files go in work/ and deliverables in outputs/. Existing files are unaffected.',
        saved: 'Saved. New settings are in effect for sessions created or run afterwards.',
        readonly: 'This configuration is read-only here.',
        loading: 'Loading…',
        loadFailed: 'Could not load: {error}',
        'err.readonly': 'This configuration is read-only.',
        'err.workspace-missing': 'The selected workspace does not exist.',
        'err.bad-request': 'Invalid request.',
        configMissing: 'The workspace you chose earlier no longer exists, so automatic selection is in use. You can pick another one above.',
        resetLabel: 'Reset to defaults & remove config file',
        resetHint: 'Resets options to automatic defaults and deletes ~/.dsh/storages/codex-default-workspace.json; existing session folders and files are kept.',
        resetDone: 'Restored defaults and removed the config file from ~/.dsh/storages/.',
      },
    }
    const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '')

    // 接口路径相对页面基址解析，兼容挂载在子路径下的页面
    const url = path => new URL(path, document.baseURI).href
    const getStatus = async signal => {
      const response = await fetch(url(`${API}/status`), { credentials: 'same-origin', cache: 'no-store', signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    }
    const save = async (patch, signal) => {
      const response = await fetch(url(`${API}/set`), {
        method: 'POST', credentials: 'same-origin', signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const result = await response.json().catch(() => ({ ok: false }))
      if (!response.ok || result.ok !== true) throw new Error(result.error ?? `HTTP ${response.status}`)
      return result.status ?? await getStatus(signal)
    }

    const CSS = `
.cdw-root { display:flex; flex-direction:column; gap:12px; width:100%; max-width:760px; box-sizing:border-box; color:var(--dsw-alias-label-primary); }
.cdw-card { display:flex; flex-direction:column; gap:14px; box-sizing:border-box; border:1px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2)); border-radius:var(--dsw-radius-xl, 12px); padding:16px 18px; background:var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2)); }
.cdw-title { margin:0; font-size:15px; line-height:22px; font-weight:600; }
.cdw-desc { margin:0; font-size:13px; line-height:20px; color:var(--dsw-alias-label-secondary); }
.cdw-row { display:flex; align-items:flex-start; justify-content:space-between; gap:12px 16px; flex-wrap:wrap; }
.cdw-info { display:flex; flex-direction:column; gap:4px; min-width:0; flex:1 1 260px; }
.cdw-label { font-size:14px; line-height:20px; font-weight:500; }
.cdw-hint { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-secondary); overflow-wrap:anywhere; }
.cdw-select { min-width:200px; max-width:100%; height:32px; padding:0 8px; border-radius:var(--dsw-radius-md, 8px); border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; }
.cdw-select:disabled { opacity:.6; }
.cdw-switch { position:relative; flex:none; width:36px; height:20px; margin-top:2px; border-radius:999px; corner-shape:round; border:none; padding:0; cursor:pointer; background:var(--dsw-alias-state-idle-primary); transition:background .15s; }
.cdw-switch[aria-checked="true"] { background:var(--dsw-alias-brand-primary); }
.cdw-switch:disabled { opacity:.6; cursor:default; }
.cdw-switch::after { content:''; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; corner-shape:round; background:#fff; transition:transform .15s, background .15s; }
.cdw-switch[aria-checked="true"]::after { transform:translateX(16px); background:#141414; }
.cdw-switch:focus-visible, .cdw-select:focus-visible, .cdw-btn:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
.cdw-row-sep { padding-top:12px; border-top:1px solid var(--dsw-alias-border-l2); }
.cdw-btn { flex:none; height:32px; padding:0 12px; border-radius:var(--dsw-radius-md, 8px); border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; cursor:pointer; }
.cdw-btn:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); }
.cdw-btn:disabled { opacity:.6; cursor:default; }
.cdw-banner { margin:0; padding:8px 12px; border-radius:var(--dsw-radius-md, 8px); font-size:13px; line-height:19px; border:1px solid var(--dsw-alias-border-l2); overflow-wrap:anywhere; }
.cdw-banner[data-tone="warn"] { color:var(--dsw-alias-state-warn-primary); border-color:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, var(--dsw-alias-border-l2)); background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 8%, transparent); }
.cdw-banner[data-tone="error"] { color:var(--dsw-alias-state-error-primary); border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, var(--dsw-alias-border-l2)); background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent); }
.cdw-banner[data-tone="ok"] { color:var(--dsw-alias-state-success-primary); border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary) 45%, var(--dsw-alias-border-l2)); background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 8%, transparent); }
`

    // 设置卡片：插件详情页与设置面板共用
    function SettingsCard({ t, withTitle }) {
      const [status, setStatus] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [notice, setNotice] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const life = React.useRef(null)
      React.useEffect(() => {
        const controller = new AbortController()
        life.current = controller
        getStatus(controller.signal).then(setStatus, e => { if (!controller.signal.aborted) setError(String(e.message ?? e)) })
        return () => controller.abort()
      }, [])
      const apply = async (patch, successKey = 'saved') => {
        setBusy(true); setNotice(null)
        try {
          const next = await save(patch, life.current?.signal)
          if (life.current?.signal.aborted) return
          setStatus(next)
          setNotice({ tone: 'ok', text: t(successKey) })
        } catch (e) {
          if (life.current?.signal.aborted) return
          const code = String(e.message ?? e)
          const known = ['readonly', 'workspace-missing', 'bad-request'].includes(code)
          setNotice({ tone: 'error', text: `${t('failed')}: ${known ? t(`err.${code}`) : code}` })
        } finally {
          if (!life.current?.signal.aborted) setBusy(false)
        }
      }
      const children = []
      if (withTitle) children.push(h('h3', { key: 'title', className: 'cdw-title' }, t('section')))
      children.push(h('p', { key: 'intro', className: 'cdw-desc' }, t('intro')))
      if (error !== null) children.push(h('p', { key: 'err', className: 'cdw-banner', 'data-tone': 'error', role: 'alert' }, fill(t('loadFailed'), { error })))
      else if (status === null) children.push(h('p', { key: 'loading', className: 'cdw-hint', role: 'status' }, t('loading')))
      else {
        const disabled = busy || !status.canSet
        const sourceText = { user: t('sourceUser'), native: t('sourceNative'), guess: t('sourceGuess') }[status.source]
        children.push(h('div', { key: 'ws', className: 'cdw-row' },
          h('div', { className: 'cdw-info' },
            h('label', { className: 'cdw-label', htmlFor: 'cdw-workspace' }, t('workspaceLabel')),
            h('p', { className: 'cdw-hint' }, t('workspaceHint')),
            status.workspaceId !== null && h('p', { className: 'cdw-hint' }, fill(t('effective'), { title: `${status.title} · ${status.path}`, source: sourceText }))),
          h('select', {
            id: 'cdw-workspace', className: 'cdw-select', disabled,
            value: status.workspaces.some(w => w.id === status.configuredWorkspaceId) ? status.configuredWorkspaceId : AUTO,
            onChange: event => {
              const id = event.target.value
              void apply({ workspaceId: id })
            },
          },
          h('option', { value: AUTO }, t('auto')),
          ...status.workspaces.map(w => h('option', { key: w.id, value: w.id, title: w.path }, w.title)))))
        if (status.configuredMissing) children.push(h('p', { key: 'missing', className: 'cdw-banner', 'data-tone': 'warn', role: 'status' }, t('configMissing')))
        if (status.workspaceId === null) children.push(h('p', { key: 'none', className: 'cdw-banner', 'data-tone': 'warn', role: 'status' }, t('noneFound')))
        children.push(h('div', { key: 'wo', className: 'cdw-row' },
          h('div', { className: 'cdw-info' },
            h('span', { className: 'cdw-label', id: 'cdw-wo-label' }, t('woLabel')),
            h('p', { className: 'cdw-hint' }, t('woHint'))),
          h('button', {
            type: 'button', role: 'switch', className: 'cdw-switch', disabled,
            'aria-checked': status.workOutputs ? 'true' : 'false', 'aria-labelledby': 'cdw-wo-label',
            onClick: () => { const next = !status.workOutputs; void apply({ workOutputs: next }) },
          })))
        if (status.hasSettingsFile) {
          children.push(h('div', { key: 'reset', className: 'cdw-row cdw-row-sep' },
            h('div', { className: 'cdw-info' },
              h('span', { className: 'cdw-label' }, t('resetLabel')),
              h('p', { className: 'cdw-hint' }, t('resetHint'))),
            h('button', {
              type: 'button', className: 'cdw-btn', disabled,
              onClick: () => { void apply({ reset: true }, 'resetDone') },
            }, t('resetLabel'))))
        }
        if (!status.canSet) children.push(h('p', { key: 'ro', className: 'cdw-hint' }, t('readonly')))
      }
      if (notice !== null) children.push(h('p', { key: 'notice', className: 'cdw-banner', 'data-tone': notice.tone, role: notice.tone === 'error' ? 'alert' : 'status' }, notice.text))
      return h('div', { className: 'cdw-root' }, h('style', null, CSS), h('div', { className: 'cdw-card' }, children))
    }

    // 菜单图标：16px 线框风格，颜色跟随菜单文字
    const svg = (...children) => h('svg', {
      width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true,
      stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round',
      style: { display: 'block', flex: 'none' },
    }, ...children)
    const IconHome = () => svg(
      h('path', { key: 'a', d: 'M2.5 7.2 8 2.8l5.5 4.4' }),
      h('path', { key: 'b', d: 'M4 6.2v6.6c0 .4.3.7.7.7h6.6c.4 0 .7-.3.7-.7V6.2' }),
      h('path', { key: 'c', d: 'M6.6 13.5V10h2.8v3.5' }),
    )
    const IconHomeCheck = () => svg(
      h('path', { key: 'a', d: 'M2.5 7.2 8 2.8l5.5 4.4' }),
      h('path', { key: 'b', d: 'M4 6.2v6.6c0 .4.3.7.7.7h6.6c.4 0 .7-.3.7-.7V6.2' }),
      h('path', { key: 'c', d: 'm6.2 9.9 1.3 1.3 2.4-2.6' }),
    )

    return {
      inject: ['slots', 'contextMenus', 'locale'],
      apply(ctx) {
        for (const [lang, dict] of Object.entries(DICT)) ctx.effect(() => ctx.locale.register(NS, lang, dict))
        const t = ctx.locale.bind(NS)

        // 右键菜单图标：按图标键注册到 contextMenu.icon，与内置菜单项的图标列对齐
        ctx.slots.inject('contextMenu.icon', function* () {
          yield ctx.slots.register({ name: 'contextMenu.icon', key: 'codex-default-workspace.set' }, IconHome)
          yield ctx.slots.register({ name: 'contextMenu.icon', key: 'codex-default-workspace.current' }, IconHomeCheck)
        })

        // 入口 1：工作区右键 / “…”菜单
        ctx.effect(() => ctx.contextMenus.register({
          id: 'codex-default-workspace.set-default',
          target: 'workspace',
          order: 50,
          async resolve(target, signal) {
            const status = await getStatus(signal)
            if (status.workspaceId === target.workspaceId) return [{ id: 'current', label: t('current'), disabled: true, icon: { key: 'codex-default-workspace.current' } }]
            if (!status.canSet) return []
            return [{
              id: 'set', label: t('set'), failureLabel: t('failed'), icon: { key: 'codex-default-workspace.set' },
              async run() {
                try { await save({ workspaceId: target.workspaceId }) } catch (e) {
                  const code = String(e.message ?? e)
                  throw new Error(['readonly', 'workspace-missing', 'bad-request'].includes(code) ? t(`err.${code}`) : code)
                }
                ctx.contextMenus.notify(fill(t('done'), { title: target.displayTitle }), true)
              },
            }]
          },
        }))

        // 入口 2：插件详情页的配置卡片
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register(
          { name: 'plugins.bundle.config', key: PKG },
          () => h(SettingsCard, { t, withTitle: false }),
        ))

        // 入口 3：设置面板中的独立页面与左侧导航图标
        ctx.slots.inject('settings.section', () => ctx.slots.register(
          { name: 'settings.section', id: 'codex-default-workspace', order: 46, label: () => t('nav') },
          () => h(SettingsCard, { t, withTitle: true }),
        ))
        ctx.slots.inject('settings.section.icon', () => ctx.slots.register(
          { name: 'settings.section.icon', id: 'codex-default-workspace' },
          IconHome,
        ))

        // 兜底提示：一个默认工作区都找不到时提示一次
        const controller = new AbortController()
        ctx.effect(() => () => controller.abort())
        getStatus(controller.signal).then(status => {
          if (status.source !== 'none') return
          // 同一浏览器标签页内只提示一次，刷新页面不再重复弹出
          let shown = false
          try { shown = window.sessionStorage.getItem('cdw-none-notified') === '1'; if (!shown) window.sessionStorage.setItem('cdw-none-notified', '1') } catch { /* 存储不可用时按未提示处理 */ }
          if (!shown) ctx.contextMenus.notify(t('none'), false)
        }, () => {})
      },
    }
  },
})
