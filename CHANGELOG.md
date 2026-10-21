# Changelog

## 0.1.5

- A tidier `stint status`: a full frame, aligned labels, and today’s time split into yours and your agents’.

## 0.1.4

- Fix: big history imports timed out. Uploads go in smaller batches with a longer timeout.

## 0.1.3

- Fix: large imports sent only the newest 20 000 queued records and dropped the rest. The whole queue is now sent.
- Every command refreshes the copy of the CLI that hooks run, so hooks always use the version you last ran.

## 0.1.2

- Past usage now syncs on its own: hooks run a background import of Claude Code, Codex, Gemini CLI and OpenCode history at most once an hour, so you never have to run `stint sync` yourself.

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
