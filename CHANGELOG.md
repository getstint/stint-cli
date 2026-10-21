# Changelog

## 0.1.1

- When the editor extension can’t be installed automatically, the CLI links its VS Code Marketplace listing.
- Releases are published from GitHub Actions with npm provenance.

## 0.1.0

First release.

- `npx getstint` signs you in through the browser (or a printed link on headless machines), connects your tools and imports past usage.
- Integrations: Claude Code (hooks or plugin), Codex CLI, Gemini CLI, OpenCode, VS Code and its forks, and every WakaTime plugin through `~/.wakatime.cfg`.
- `stint run` tracks any other CLI agent.
- Token usage from Claude Code, Codex, Gemini CLI and OpenCode session logs, keyed by message id so nothing is counted twice.
- Offline queue, detached sending, and hooks that return in milliseconds.
