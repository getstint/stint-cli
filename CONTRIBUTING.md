# Contributing

Thanks for helping. Bug reports, new integrations and fixes are all welcome.

## Setup

```bash
bun install
bun test
bun run typecheck
bun run build
```

You need [Bun](https://bun.sh) to develop. The published CLI is a single Node file, so users only need Node 18 or newer.

To work against a local server, run the [Stint web app](https://github.com/getstint/web) and set `STINT_API_URL=http://localhost:3210`. `bun scripts/e2e.ts` runs the whole flow against it inside a temporary home directory.

## Conventions

- **TypeScript, strict.** No `any` and no comments: name things so they don't need one.
- **camelCase file names.** Tests sit next to the code as `*.test.ts`.
- **Pure logic gets a test.** Parsers, config merging and payload building are pure functions with unit tests. Anything that touches the network or the file system is a thin wrapper around them.
- **Hooks must never hurt the agent.** `stint hook` exits 0, prints nothing, and never waits on the network.
- **Settings files belong to the user.** Merge, never overwrite. Keep a backup, and remove only what Stint added.
- **Honest output.** Messages say what happened and what to do next. No exclamation marks, no emoji.

## Adding an integration

1. Add a parser in `src/parsers/` if the tool keeps a usage log, with tests built from a real (anonymised) sample.
2. Register it in `src/agents/registry.ts` with `detected`, `installed`, `install` and `uninstall`.
3. Map its end-of-turn event in `src/lib/hookEvent.ts`.
4. Document it in the README's integrations table.

## Commits and pull requests

Conventional Commits, imperative and lower-case: `feat(codex): read token_usage_record events`. Keep pull requests focused, and include the output of `bun run check`.
