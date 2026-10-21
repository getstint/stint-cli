<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/wordmark-dark.png">
  <img src="assets/wordmark-light.png" alt="Stint" height="56">
</picture>

**Know where your hours go.** One command connects your AI agents and editors to [Stint](https://getstint.dev), the free coding time tracker.

[![npm](https://img.shields.io/npm/v/getstint?color=ffb224&label=npm)](https://www.npmjs.com/package/getstint)
[![Node](https://img.shields.io/badge/node-%E2%89%A518.17-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Bun](https://img.shields.io/badge/bunx-ready-f9f1e1?logo=bun&logoColor=black)](https://bun.sh)
[![VS Code](https://img.shields.io/badge/VS%20Code-Marketplace-007ACC?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=getstint.stint)
[![CI](https://github.com/getstint/stint-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/getstint/stint-cli/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[Quick start](#quick-start) · [Integrations](#integrations) · [Commands](#commands) · [Privacy](#privacy) · [Configuration](#configuration) · [How it works](#how-it-works) · [Development](#development)

</div>

---

```bash
npx getstint
```

That's the whole setup. It signs you in through your browser, finds the agents and editors on your machine, connects the ones you pick, and imports token usage from your past sessions so your dashboard isn't empty on day one.

## Quick start

```bash
npx getstint        # or: bunx getstint · pnpm dlx getstint · yarn dlx getstint
```

```
┌  ◔ stint v0.1.0
│
◇  Connect this machine ─────────────────────────────────╮
│                                                         │
│  Your code   KQ4E-WZGK                                  │
│                                                         │
│  Approve this sign-in in the browser window that just   │
│  opened.                                                │
│  https://getstint.dev/device?user_code=KQ4EWZGK         │
│  The link is on your clipboard.                         │
│                                                         │
├─────────────────────────────────────────────────────────╯
◇  Signed in as adam
│
◆  What should Stint track?
│  AI agents
│  ◼ Claude Code       hooks in ~/.claude/settings.json
│  ◼ Codex CLI         hooks in ~/.codex/hooks.json
│  ◻ Gemini CLI        not found on this machine
│  ◼ OpenCode          plugin in ~/.config/opencode/plugins
│  Editors
│  ◼ VS Code, Cursor and Windsurf
│  ◻ WakaTime plugins  JetBrains, Neovim, Zed, Xcode and more
└
```

No browser on this machine (SSH, a container, a server)? The CLI notices and prints the link instead. Open it on your phone or laptop, approve, and the terminal carries on. For CI or scripts, skip the browser entirely with a key from **Settings › API key**:

```bash
npx getstint login --key 3f2b8c1e-9a4d-4e7f-b1c2-5d6e7f8a9b0c
```

Prefer a global install? `npm i -g getstint` gives you `stint` on your `PATH`.

## Integrations

| Tool                                                                | How Stint connects                                                                                                                                                  | What you get                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Claude Code**                                                     | `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop`, `SubagentStop` and `SessionEnd` hooks in `~/.claude/settings.json`, or the [plugin](#claude-code-plugin) | Agent time per project, files it edits, tokens and cost per model from the session transcript |
| **Codex CLI**                                                       | Lifecycle hooks in `~/.codex/hooks.json`                                                                                                                            | Agent time, edits, per-response token usage from the rollout log                              |
| **Gemini CLI**                                                      | Hooks in `~/.gemini/settings.json`                                                                                                                                  | Agent time, edits, token usage from the chat log                                              |
| **OpenCode**                                                        | A plugin in `~/.config/opencode/plugins/stint.js`                                                                                                                   | Agent time, edits, token usage for every completed message                                    |
| **Grok CLI, Copilot CLI, Amp, Qwen Code, anything else**            | `stint run <agent>` wraps the command                                                                                                                               | Agent time per project                                                                        |
| **VS Code, Cursor, Windsurf, VSCodium**                             | Installs the Stint extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=getstint.stint)                                     | Your own coding time, languages, files and branches                                           |
| **JetBrains, Neovim, Vim, Zed, Xcode, Sublime, Emacs and 50+ more** | Points your existing [WakaTime plugin](https://wakatime.com/plugins) at Stint through `~/.wakatime.cfg`                                                             | Everything those plugins already track                                                        |

Agent time is always counted **separately** from your own coding time, so a long agent session never inflates your hours.

Codex asks you to trust new hooks once. After installing, open Codex, run `/hooks` and approve the Stint entries.

### Claude Code plugin

If you'd rather manage it as a plugin:

```bash
claude plugin marketplace add getstint/stint-cli
claude plugin install stint@stint
npx getstint login
```

The plugin uses the same hook as `npx getstint install claude-code`, so pick one or the other.

### Backfilling history

```bash
npx getstint sync             # everything from the last 13 months
npx getstint sync --days 30
```

`sync` reads the session logs Claude Code, Codex, Gemini CLI and OpenCode already keep on your disk, and sends token counts and agent time. Running it again only sends what's new, and Stint ignores anything it has already seen.

## Commands

| Command                 | What it does                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npx getstint`          | Sign in, pick what to track, import past usage                                                                                       |
| `login`                 | Connect this machine. `--no-browser` prints the link only, `--key <key>` skips the browser, `--api-url <url>` targets another server |
| `logout`                | Forget the key on this machine                                                                                                       |
| `status`                | Who you're signed in as, today's time, what's connected, anything waiting to send                                                    |
| `install [ids…]`        | Connect integrations. With no ids you get the picker, `--all` connects everything detected                                           |
| `uninstall [ids…]`      | Remove Stint's hooks and plugins, leaving everything else in those files alone                                                       |
| `sync`                  | Import token usage and agent time from past sessions                                                                                 |
| `run <agent> [-- cmd…]` | Track any CLI agent by wrapping it: `stint run grok`, `stint run my-agent -- ./bin/agent --flag`                                     |
| `flush`                 | Send anything waiting in the offline queue now                                                                                       |
| `doctor`                | Check Node, the hook script, the connection and your key                                                                             |

Integration ids: `claude-code`, `codex`, `gemini-cli`, `opencode`, `editors`, `wakatime`.

## Privacy

Stint is a time tracker, not a code collector.

- **Never sent**: file contents, prompts, model responses, tool output, terminal commands, environment variables.
- **Sent**: timestamps, project name (the folder name of the git repository), branch, the file **extension only** (`*.ts`, never the file name or path), whether the event was an edit, the agent and model names, and token counts.
- Files outside the project, such as `~/.ssh/config`, are reported as a plain session event with no file at all.
- Your key lives in `~/.stint/config.json`, readable only by you (`0600` on macOS and Linux). Revoke it any time in **Settings › API key**.
- Hide project names from your public profile in **Settings › Privacy**.

## Configuration

Everything lives in `~/.stint/`:

| File                         | Purpose                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| `config.json`                | Server URL, your key, username and connected integrations            |
| `bin/stint.mjs`              | The copy of the CLI that hooks run, so a hook never waits on `npx`   |
| `queue.jsonl`, `usage.jsonl` | Events waiting to send while you're offline (capped at 250 000 each) |
| `state.json`                 | How far each session log has been read                               |
| `stint.log`                  | Hook errors, capped at 1 MB                                          |

Environment variables:

| Variable                                                                               | Default                | Description                                         |
| -------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------- |
| `STINT_API_URL`                                                                        | `https://getstint.dev` | Use another Stint server, such as a self-hosted one |
| `STINT_API_KEY`                                                                        | from `config.json`     | Use this key instead of the saved one               |
| `STINT_HOME`                                                                           | `~/.stint`             | Where Stint keeps its files                         |
| `STINT_NO_BROWSER`                                                                     | unset                  | Never open a browser during login                   |
| `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `WAKATIME_HOME` | the tools' defaults    | Respected when finding each tool's files            |

## How it works

```
 agent hook ──▶ stint hook <agent> ──▶ ~/.stint/queue.jsonl ──▶ stint flush (detached) ──▶ getstint.dev
                 reads stdin JSON        append-only, offline-safe     batches of 500
                 reads new log lines     never blocks the agent        retries next time if offline
```

- **Hooks never slow your agent down.** `stint hook` reads the event, appends to a local queue and exits in milliseconds without touching the network. Sending happens in a detached `stint flush`, at most once a minute and at the end of each turn.
- **Nothing is lost offline.** If Stint can't be reached, events stay queued and go out with the next flush.
- **Nothing is counted twice.** Token usage is keyed by the provider's message or response id, heartbeats by time and file, and the server drops duplicates.
- **Your settings files are safe.** Installing merges Stint's entries next to your own hooks, keeps a one-time `.stint-backup` of the original, and uninstalling removes only Stint's lines. Installing twice changes nothing.

The HTTP API the CLI and editor extensions use is documented in [`docs/api.md`](docs/api.md).

## Development

```bash
bun install
bun test            # unit tests
bun run typecheck
bun run build       # dist/stint.mjs, a single file with no runtime dependencies
bun run dev -- status
```

Run against a local Stint server with `STINT_API_URL=http://localhost:3210`. `bun scripts/e2e.ts` runs the full login, install, hook, sync and uninstall flow against a local server inside a throwaway home directory, so it never touches your real agent settings.

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions and [docs/publishing.md](docs/publishing.md) for how releases reach npm, the Claude Code marketplace and the editor stores.

## License

[MIT](LICENSE)
