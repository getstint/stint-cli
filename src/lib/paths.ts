import { homedir } from "node:os";
import { join } from "node:path";

export const home = () => process.env.STINT_HOME_OVERRIDE ?? homedir();

export const stintDir = () => process.env.STINT_HOME ?? join(home(), ".stint");

export const paths = {
  config: () => join(stintDir(), "config.json"),
  state: () => join(stintDir(), "state.json"),
  queue: () => join(stintDir(), "queue.jsonl"),
  usageQueue: () => join(stintDir(), "usage.jsonl"),
  log: () => join(stintDir(), "stint.log"),
  bin: () => join(stintDir(), "bin", "stint.mjs"),
  claudeSettings: () => join(process.env.CLAUDE_CONFIG_DIR ?? join(home(), ".claude"), "settings.json"),
  claudeProjects: () => join(process.env.CLAUDE_CONFIG_DIR ?? join(home(), ".claude"), "projects"),
  codexHome: () => process.env.CODEX_HOME ?? join(home(), ".codex"),
  geminiHome: () => join(home(), ".gemini"),
  opencodeConfig: () => join(process.env.XDG_CONFIG_HOME ?? join(home(), ".config"), "opencode"),
  opencodeData: () => join(process.env.XDG_DATA_HOME ?? join(home(), ".local", "share"), "opencode"),
  wakatimeConfig: () => join(process.env.WAKATIME_HOME ?? home(), ".wakatime.cfg"),
};
