import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../lib/config";
import { backupOnce, readJsonFile, readText, writeFileAtomic, writeJsonFile } from "../lib/files";
import { paths } from "../lib/paths";
import { hookCommand, nodeCommand, onPath } from "../lib/runtime";
import { addHooks, hasHooks, removeHooks, type HookSettings, type HookSpec } from "./hookConfig";
import { opencodePluginSource } from "./opencodePlugin";
import { readWakatimeConfig, restoredWakatimeConfig, wakatimeApiUrl, withStint } from "./wakatime";

export enum IntegrationId {
  ClaudeCode = "claude-code",
  Codex = "codex",
  GeminiCli = "gemini-cli",
  OpenCode = "opencode",
  Editors = "editors",
  WakaTime = "wakatime",
}

export enum IntegrationKind {
  Agent = "agent",
  Editor = "editor",
}

export type Integration = {
  id: IntegrationId;
  name: string;
  kind: IntegrationKind;
  hint: string;
  detected: () => boolean;
  installed: () => boolean;
  install: () => string;
  uninstall: () => string;
};

const command = (agent: string) => ({ type: "command" as const, command: hookCommand(agent) });

function hookFileIntegration(options: {
  id: IntegrationId;
  name: string;
  hint: string;
  file: () => string;
  detected: () => boolean;
  specs: () => HookSpec[];
  after?: string;
}): Integration {
  return {
    id: options.id,
    name: options.name,
    kind: IntegrationKind.Agent,
    hint: options.hint,
    detected: options.detected,
    installed: () => hasHooks(readJsonFile<HookSettings>(options.file()), options.id),
    install: () => {
      const file = options.file();
      const text = readText(file);
      const current = text === null ? {} : readJsonFile<HookSettings>(file);
      if (current === null)
        throw new Error(`${file} isn't valid JSON, so Stint left it alone. Fix it and run the install again.`);
      backupOnce(file);
      writeJsonFile(file, addHooks(current, options.id, options.specs()));
      return [`Added Stint hooks to ${file}`, options.after].filter(Boolean).join(". ");
    },
    uninstall: () => {
      const file = options.file();
      const current = readJsonFile<HookSettings>(file);
      if (!current) return `Nothing to remove in ${file}`;
      writeJsonFile(file, removeHooks(current, options.id));
      return `Removed Stint hooks from ${file}`;
    },
  };
}

const claude = hookFileIntegration({
  id: IntegrationId.ClaudeCode,
  name: "Claude Code",
  hint: "hooks in ~/.claude/settings.json",
  file: paths.claudeSettings,
  detected: () => existsSync(join(paths.claudeSettings(), "..")) || onPath("claude"),
  specs: () => {
    const handler = { ...command(IntegrationId.ClaudeCode), async: true, timeout: 30 };
    return [
      { event: "SessionStart", handler },
      { event: "UserPromptSubmit", handler },
      { event: "PostToolUse", matcher: "*", handler },
      { event: "Stop", handler },
      { event: "SubagentStop", handler },
      { event: "SessionEnd", handler },
    ];
  },
});

const codex = hookFileIntegration({
  id: IntegrationId.Codex,
  name: "Codex CLI",
  hint: "hooks in ~/.codex/hooks.json",
  file: () => join(paths.codexHome(), "hooks.json"),
  detected: () => existsSync(paths.codexHome()) || onPath("codex"),
  specs: () => {
    const handler = { ...command(IntegrationId.Codex), async: true, statusMessage: "Stint" };
    return [
      { event: "SessionStart", handler },
      { event: "UserPromptSubmit", handler },
      { event: "PostToolUse", matcher: "*", handler },
      { event: "Stop", handler },
    ];
  },
  after: "Codex asks you to trust new hooks once: run /hooks in Codex and approve the Stint entries",
});

const gemini = hookFileIntegration({
  id: IntegrationId.GeminiCli,
  name: "Gemini CLI",
  hint: "hooks in ~/.gemini/settings.json",
  file: () => join(paths.geminiHome(), "settings.json"),
  detected: () => existsSync(paths.geminiHome()) || onPath("gemini"),
  specs: () => {
    const handler = { ...command(IntegrationId.GeminiCli), name: "stint", timeout: 5000 };
    return [
      { event: "SessionStart", handler },
      { event: "BeforeAgent", handler },
      { event: "AfterTool", matcher: ".*", handler },
      { event: "AfterAgent", handler },
      { event: "SessionEnd", handler },
    ];
  },
});

const opencodeFile = () => join(paths.opencodeConfig(), "plugins", "stint.js");

const opencode: Integration = {
  id: IntegrationId.OpenCode,
  name: "OpenCode",
  kind: IntegrationKind.Agent,
  hint: "plugin in ~/.config/opencode/plugins",
  detected: () => existsSync(paths.opencodeConfig()) || existsSync(paths.opencodeData()) || onPath("opencode"),
  installed: () => readText(opencodeFile())?.includes("STINT_PLUGIN") ?? false,
  install: () => {
    writeFileAtomic(opencodeFile(), opencodePluginSource(nodeCommand(), paths.bin()));
    return `Wrote ${opencodeFile()}`;
  },
  uninstall: () => {
    rmSync(opencodeFile(), { force: true });
    return `Removed ${opencodeFile()}`;
  },
};

const editorClis = ["code", "cursor", "windsurf", "codium", "code-insiders"];
const extensionId = "getstint.stint";

const editors: Integration = {
  id: IntegrationId.Editors,
  name: "VS Code, Cursor and Windsurf",
  kind: IntegrationKind.Editor,
  hint: "installs the Stint extension",
  detected: () => editorClis.some(onPath),
  installed: () => false,
  install: () => {
    const results = editorClis.filter(onPath).map((cli) => {
      const result = spawnSync(cli, ["--install-extension", extensionId, "--force"], {
        stdio: "ignore",
        shell: process.platform === "win32",
        timeout: 120_000,
      });
      return result.status === 0
        ? `${cli}: installed`
        : `${cli}: couldn't install, get it at https://marketplace.visualstudio.com/items?itemName=getstint.stint`;
    });
    return results.join(", ") || "No editor command line found";
  },
  uninstall: () => {
    editorClis.filter(onPath).forEach((cli) =>
      spawnSync(cli, ["--uninstall-extension", extensionId], {
        stdio: "ignore",
        shell: process.platform === "win32",
        timeout: 60_000,
      }),
    );
    return "Removed the Stint extension";
  },
};

const wakatime: Integration = {
  id: IntegrationId.WakaTime,
  name: "WakaTime plugins",
  kind: IntegrationKind.Editor,
  hint: "JetBrains, Neovim, Zed, Xcode, Sublime, Emacs and 50 more, through ~/.wakatime.cfg",
  detected: () => existsSync(paths.wakatimeConfig()) || existsSync(join(paths.wakatimeConfig(), "..", ".wakatime")),
  installed: () => readWakatimeConfig().includes(wakatimeApiUrl(loadConfig().apiUrl)),
  install: () => {
    const config = loadConfig();
    if (!config.apiKey) throw new Error("Sign in first so Stint has a key to give your WakaTime plugins.");
    backupOnce(paths.wakatimeConfig());
    writeFileAtomic(
      paths.wakatimeConfig(),
      withStint(readWakatimeConfig(), wakatimeApiUrl(config.apiUrl), config.apiKey),
      0o600,
    );
    return `Pointed ${paths.wakatimeConfig()} at Stint (your old file is saved as .wakatime.cfg.stint-backup)`;
  },
  uninstall: () => {
    writeFileAtomic(paths.wakatimeConfig(), restoredWakatimeConfig(), 0o600);
    return `Restored ${paths.wakatimeConfig()}`;
  },
};

export const integrations: Integration[] = [claude, codex, gemini, opencode, editors, wakatime];

export const integrationById = (id: string) => integrations.find((integration) => integration.id === id);
