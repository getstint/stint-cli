import * as p from "@clack/prompts";
import pc from "picocolors";
import { integrations } from "../agents/registry";
import { api } from "../lib/api";
import { loadConfig, saveConfig } from "../lib/config";
import { paths } from "../lib/paths";
import { queuedCount } from "../lib/queue";
import { installedBinVersion } from "../lib/runtime";
import { loadState } from "../lib/state";
import { formatDuration, link } from "../lib/ui";
import { version } from "../lib/version";

export async function status() {
  const config = loadConfig();
  const state = loadState();
  const lines: string[] = [];
  if (!config.apiKey) {
    lines.push(`${pc.yellow("●")} Not signed in. Run ${pc.bold("npx getstint login")}.`);
  } else {
    try {
      const [me, today] = await Promise.all([api.me(config), api.today(config).catch(() => null)]);
      if (me.username !== config.username) saveConfig({ username: me.username, email: me.email });
      lines.push(`${pc.green("●")} Signed in as ${pc.bold(me.username)} ${pc.dim(me.email)}`);
      if (today) lines.push(`${pc.dim("Today")}  ${pc.bold(formatDuration(today.data.grand_total.total_seconds))}`);
    } catch (error) {
      lines.push(`${pc.red("●")} ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  lines.push("");
  for (const integration of integrations) {
    const mark = integration.installed() ? pc.green("✓") : integration.detected() ? pc.yellow("○") : pc.dim("·");
    lines.push(
      `${mark} ${integration.name}${integration.installed() ? "" : pc.dim(integration.detected() ? "  found, not connected" : "  not found")}`,
    );
  }
  lines.push("");
  const queued = queuedCount(paths.queue()) + queuedCount(paths.usageQueue());
  lines.push(`${pc.dim("Server")}    ${config.apiUrl}`);
  lines.push(
    `${pc.dim("Version")}   ${version}${installedBinVersion() && installedBinVersion() !== version ? pc.dim(` (hooks use ${installedBinVersion()})`) : ""}`,
  );
  lines.push(
    `${pc.dim("Waiting")}   ${queued ? `${queued} events will send when Stint is reachable` : "nothing queued"}`,
  );
  if (state.lastFlush) lines.push(`${pc.dim("Last sent")} ${new Date(state.lastFlush).toLocaleString()}`);
  if (state.lastError) lines.push(`${pc.dim("Last error")} ${pc.red(state.lastError.message)}`);
  p.note(lines.join("\n"), "Stint");
  if (config.apiKey) p.log.message(`Dashboard: ${link(`${config.apiUrl}/dashboard`)}`);
}
