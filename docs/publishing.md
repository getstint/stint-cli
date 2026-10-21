# Publishing

Where Stint's integrations are released, what each store needs, and the one-time setup for each. Everything here is free.

## npm (and therefore `npx`, `bunx`, `pnpm dlx` and `yarn dlx`)

The CLI is the unscoped package [`getstint`](https://www.npmjs.com/package/getstint). The name `stint` was already taken on npm, and `getstint` matches the domain, so the command people type is `npx getstint`. Once installed, the binary is also called `stint`.

`bunx`, `pnpm dlx` and `yarn dlx` all read the npm registry, so publishing to npm is the only step. Bun has no separate registry.

The published package is one file, `dist/stint.mjs`, about 80 KB with no runtime dependencies, so `npx getstint` starts in about a second on a cold cache.

### One-time setup

1. Create the npm account or organisation that will own the package, with two-factor authentication on.
2. Publish the first version by hand. Trusted publishing is configured from the package's settings page, so the package has to exist first:
   ```bash
   bun run check
   npm publish --access public
   ```
3. On npmjs.com, open **getstint › Settings › Trusted Publisher**, choose **GitHub Actions**, and enter:
   - Organization or user: `getstint`
   - Repository: `stint-cli`
   - Workflow filename: `release.yml`
4. In the same settings, set **Publishing access** to require two-factor authentication and disallow tokens, so only the workflow can publish.

npm requires `repository.url` in `package.json` to match the GitHub repository exactly, and it already does. A new trusted publisher has to complete its first publish within two days of being configured.

### Every release

1. Bump `version` in `package.json` and `plugins/claude-code/.claude-plugin/plugin.json`, and add a `CHANGELOG.md` entry.
2. Commit, then tag and push:
   ```bash
   git tag v0.1.1
   git push origin main --tags
   ```
3. `.github/workflows/release.yml` runs the checks, builds, and publishes with provenance through OIDC. No npm token is stored anywhere.

Users get the new version the next time they run `npx getstint`. Hooks run the copy in `~/.stint/bin`, which refreshes itself whenever a newer CLI runs.

## Claude Code plugin marketplace

This repository is also a Claude Code marketplace: `.claude-plugin/marketplace.json` lists the plugin in `plugins/claude-code`. There is nothing to publish. Pushing to `main` is the release, and users install it with:

```bash
claude plugin marketplace add getstint/stint-cli
claude plugin install stint@stint
```

Check it before pushing:

```bash
claude plugin validate .
claude plugin validate ./plugins/claude-code
```

To appear in Anthropic's own directory as well, submit the plugin through the form linked from the [plugin publishing docs](https://code.claude.com/docs/en/plugins/publish).

## VS Code Marketplace and Open VSX

The editor extension lives in its own repository, [`getstint/stint-vscode`](https://github.com/getstint/stint-vscode). VS Code installs from the Visual Studio Marketplace. Cursor, Windsurf, VSCodium, Gitpod and Theia install from Open VSX, so publish to both.

### Visual Studio Marketplace (one time)

1. Sign in at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) and create the publisher. **ID: `getstint`** (permanent, and part of the extension id `getstint.stint`), **Name: Stint**.
2. Authenticate. Microsoft retires global Azure DevOps personal access tokens on 1 December 2026, so use **Microsoft Entra ID** through workload identity federation and `vsce publish --azure-credential`. Until then, a PAT with **Organization: All accessible organizations** and **Marketplace: Manage** also works, stored as the `VSCE_PAT` secret.
3. Requirements vsce enforces: a PNG icon of at least 128×128 (not SVG), and https URLs for any README images. Badges are fine only from trusted badge providers.

### Open VSX (one time)

1. Create an Eclipse account using the same GitHub username, log in to [open-vsx.org](https://open-vsx.org) with GitHub, connect the Eclipse account on your profile, and sign the Publisher Agreement.
2. Create an access token under **Settings › Access Tokens** and store it as the `OVSX_PAT` secret.
3. Create the namespace once: `npx ovsx create-namespace getstint -p <token>`.
4. Optionally claim the namespace to get the verified badge.

The extension's `release.yml` publishes the same `.vsix` to both stores when a tag is pushed.

## Other WakaTime-compatible editors

JetBrains, Neovim, Zed, Xcode, Sublime, Emacs and the rest already have WakaTime plugins that work with Stint unchanged. `npx getstint install wakatime` points them at Stint, so there is nothing to publish for those editors.
