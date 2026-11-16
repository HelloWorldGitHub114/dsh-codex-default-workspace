# dsh-codex-default-workspace

[English](README.en.md) | 简体中文

为 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 提供仿照 Codex 无项目会话（Project-free sessions）体验的插件：在**默认工作区**中新建的每段会话，首次运行时会自动分配并进入一个按日期分组的独立子目录，避免把日常临时对话文件全都堆在默认工作区根目录下。

## 核心特性

- **自动创建独立会话子目录**：默认工作区中尚未执行过的新会话，在首次访问工作目录时自动创建 `<默认工作区>/YYYY-MM-DD/<会话ID>/`。
- **100% 原生工作目录机制**：保留 `session.header.cwd` 为 `<默认工作区>` 不变（会话依然整洁地归属在左侧默认工作区列表下），通过追加原生 `working-directory/change` 事件切换目录：
  - `read` / `write` / `edit` / `glob` / `grep` / `bash` / `pwsh` 等工具全部在该子目录下执行；
  - `working_directory`（`cd`）相对路径与绝对路径切换原生正常；
  - 对话中的相对路径文件链接与引用可直接点击打开；
  - 右侧文件树、终端环境变量与模型系统提示词原生同步。
- **默认开启 `work/` 与 `outputs/` 目录约定（可随时关闭）**：默认自动在新会话目录内创建 `work/` 与 `outputs/`，并向主会话及工作在会话目录树内的子代理（subagent）注入一句简短提示：`临时文件放 work/，交付文件放 outputs/。`（可在设置中随时关闭，非默认工作区会话不会注入此提示）。
- **多工作区安全隔离**：非默认工作区保持原样不受影响；默认工作区中已存在历史轮次的老会话保持原有工作目录不被强制迁移；子代理继承父会话目录，不会重复新建嵌套文件夹。
- **极简且支持一键清理的持久化**：
  - 不写入宿主 `cordis.patch.yml`，保存设置立即生效且不重启插件；
  - 默认状态下不生成任何外部配置文件，仅在修改非默认设置时保存至 `~/.dsh/storages/codex-default-workspace.json`；
  - 升级插件不丢失配置，恢复默认或点击设置页底部按钮 / 执行 `/codex-default-workspace-clear` 会自动清理该配置文件。

## 目录结构示例

```text
<默认工作区>/
└─ 2026-11-16/
   └─ session-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/
      ├─ work/       # 临时脚本与中间产物（默认创建，可在设置中关闭）
      └─ outputs/    # 最终交付文件（默认创建，可在设置中关闭）
```

## 默认工作区识别顺序

插件按以下优先级确定需要接管的默认工作区（内部均按工作区 ID 匹配，不受重命名影响）：

1. 用户在设置中手动指定的工作区（可通过工作区右键菜单「设为默认工作区」或在设置页选择）；
2. DSH 原生记录的默认工作区 `defaultWorkspaceId`；
3. 名称为 `默认工作区` / `default-workspace` / `Default workspace` 或目录名为 `default-workspace` 的工作区。

若以上均未找到，插件保持静默不接管任何会话，并在界面给出一次性引导提示。

## 安装方式

- **DSH 插件市场**：搜索并安装 `dsh-codex-default-workspace`。
- **命令行安装（npm / GitHub / Release 包）**：

```sh
# 替换 <profile> 为实际使用的 profile 名称（如 web 或 desktop）
dsh plugin --profile <profile> add dsh-codex-default-workspace
# 或从 GitHub 安装
dsh plugin --profile <profile> add HelloWorldGitHub114/dsh-codex-default-workspace
```

## 设置与清理

可通过以下任意入口调整默认工作区与 `work / outputs` 开关：
- 左侧边栏工作区右键 / `···` 菜单 → **设为默认工作区**；
- **设置 → 默认工作区**；
- 插件管理页中的 **Codex 式默认工作区** 配置卡片。

如需在卸载插件前彻底清理残留配置，可直接在设置页点击 **恢复默认并清理配置文件**，或运行斜杠命令 `/codex-default-workspace-clear`（不会删除已生成的磁盘文件夹或历史会话记录）。停用或卸载插件后，新建会话恢复直接使用默认工作区根目录，历史会话仍保留各自的独立目录。

## 许可证

[MIT](LICENSE)
