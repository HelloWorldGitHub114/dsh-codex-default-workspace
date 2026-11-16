# dsh-codex-default-workspace

English | [简体中文](README.md)

A [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) plugin that brings Codex-style project-free session isolation to DSH's default workspace: each new session inside the default workspace automatically gets its own date-grouped directory on first run instead of cluttering the workspace root.

## Features

- **Automatic Per-Session Directory**: On first working-directory access, each brand-new session in the default workspace creates `<default-workspace>/YYYY-MM-DD/<session-id>/`.
- **100% Native DSH Behavior**: Keeps `session.header.cwd` pointed at the default workspace root (so sessions remain grouped under the default workspace in the sidebar) while emitting a native `working-directory/change` event:
  - File tools (`read`, `write`, `edit`, `glob`, `grep`), `bash`/`pwsh`, and terminals run directly inside the session folder;
  - Relative and absolute `working_directory` (`cd`) changes work natively;
  - Relative file links and references in chat open directly;
  - Right sidebar file trees and system runtime context stay in sync.
- **Built-in `work/` & `outputs/` Convention (Enabled by Default, Toggleable)**: Automatically creates `work/` and `outputs/` inside new session folders and adds a concise reminder for both the parent agent and subagents running inside the session directory tree to separate scratch files from deliverables (can be disabled in Settings; non-default workspaces never receive this prompt).
- **Scoped & Non-Intrusive**:
  - Other workspaces are untouched;
  - Existing multi-turn sessions in the root workspace keep their original working directory;
  - Subagents inherit the parent session folder without creating extra nested folders.
- **Clean Persistence & One-Click Reset**:
  - Does not write plugin configuration into host `cordis.patch.yml` (changes apply immediately without restarting the plugin);
  - Creates no external config file while using defaults; persists non-default settings in `~/.dsh/storages/codex-default-workspace.json` so plugin updates preserve your choices;
  - Clicking **Reset to defaults & remove config file** in settings or running `/codex-default-workspace-clear` removes `~/.dsh/storages/codex-default-workspace.json` completely.

## Directory Layout

```text
<default-workspace>/
└─ 2026-11-16/
   └─ session-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/
      ├─ work/       # Scratch files & temporary scripts (created by default, toggleable)
      └─ outputs/    # Final deliverables (created by default, toggleable)
```

## Default Workspace Resolution Order

1. Explicit workspace selected by the user (via workspace context menu **"Set as default workspace"** or Settings);
2. DSH native `defaultWorkspaceId` (if the workspace still exists);
3. A workspace titled `默认工作区` / `default-workspace` / `Default workspace`, or whose folder is named `default-workspace`.

## Installation

- **DSH Plugin Market**: Search for and install `dsh-codex-default-workspace`.
- **CLI**:

```sh
dsh plugin --profile <profile> add dsh-codex-default-workspace
# Or install directly from GitHub
dsh plugin --profile <profile> add HelloWorldGitHub114/dsh-codex-default-workspace
```

## Settings & Clean Uninstall

Configure via workspace context menu, **Settings → Default workspace**, or the plugin details card.

Before uninstalling, you can click **Reset to defaults & remove config file** in Settings or run `/codex-default-workspace-clear` to remove `~/.dsh/storages/codex-default-workspace.json` (created folders and session logs are always kept). After disabling or uninstalling, new sessions use the root workspace directly while existing sessions retain their folders.

## License

[MIT](LICENSE)
