import * as p from "@clack/prompts";
import pc from "picocolors";
import { integrations } from "../agents/registry";
import { api } from "../lib/api";
import { loadConfig, saveConfig } from "../lib/config";
import { paths } from "../lib/paths";
import { queuedCount } from "../lib/queue";
import { installedBinVersion } from "../lib/runtime";
import { loadState } from "../lib/state";
import { brand, formatDuration, link } from "../lib/ui";
import { version } from "../lib/version";

const row = (label: string, value: string) => `${pc.dim(label.padEnd(11))}${value}`;

export async function status() {
  const config = loadConfig();
  const state = loadState();
  p.intro(brand());
  const lines: string[] = [];
  if (!config.apiKey) {
    lines.push(`${pc.yellow("●")} Not signed in. Run ${pc.bold("npx getstint login")}.`);
  } else {
    try {
      const [me, today] = await Promise.all([api.me(config), api.activityToday(config).catch(() => null)]);
      if (me.username !== config.username) saveConfig({ username: me.username, email: me.email });
      lines.push(`${pc.green("●")} Signed in as ${pc.bold(me.username)} ${pc.dim(me.email)}`);
      if (today) {
        const agentSeconds = Object.values(today.agents).reduce((sum, value) => sum + value, 0);
        const agentPart = agentSeconds ? pc.dim(` · ${formatDuration(agentSeconds)} agents`) : "";
        lines.push(row("Today", `${pc.bold(formatDuration(today.seconds))} you${agentPart}`));
      }
    } catch (error) {
      lines.push(`${pc.red("●")} ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  lines.push("");
  for (const integration of integrations) {
    const mark = integration.installed() ? pc.green("✓") : integration.detected() ? pc.yellow("○") : pc.dim("·");
    const note = integration.installed() ? "" : integration.detected() ? "found, not connected" : "not found";
    lines.push(`${mark} ${integration.name}${note ? pc.dim(`  ${note}`) : ""}`);
  }
  lines.push("");
  const queued = queuedCount(paths.queue()) + queuedCount(paths.usageQueue());
  const hooks = installedBinVersion();
  lines.push(row("Server", config.apiUrl));
  lines.push(row("Version", `${version}${hooks && hooks !== version ? pc.dim(` (hooks use ${hooks})`) : ""}`));
  lines.push(row("Waiting", queued ? `${queued} events, sent on the next flush` : "nothing queued"));
  if (state.lastFlush) lines.push(row("Last sent", new Date(state.lastFlush).toLocaleString()));
  if (state.lastError) lines.push(row("Last error", pc.red(state.lastError.message)));
  p.note(lines.join("\n"), "Status");
  p.outro(config.apiKey ? `Dashboard  ${link(`${config.apiUrl}/dashboard`)}` : "Run npx getstint to get started.");
}
