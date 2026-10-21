import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import pc from "picocolors";
import { IntegrationId, integrations } from "../agents/registry";
import { api } from "../lib/api";
import { loadConfig } from "../lib/config";
import { ago } from "../lib/ago";
import { paths } from "../lib/paths";
import { queuedCount } from "../lib/queue";
import { loadState } from "../lib/state";
import { nodeCommand, onPath } from "../lib/runtime";

type Check = { label: string; ok: boolean; fix?: string };

export async function doctor(): Promise<boolean> {
  const config = loadConfig();
  const checks: Check[] = [];
  const [major] = process.versions.node.split(".").map(Number);
  checks.push({
    label: `Node ${process.versions.node}`,
    ok: major >= 18,
    fix: "Install Node 18 or newer from nodejs.org",
  });
  checks.push({
    label: `Hooks run with ${nodeCommand()}`,
    ok: nodeCommand() === "node" || existsSync(nodeCommand()),
    fix: "Put node on your PATH so agents can run the Stint hook",
  });
  checks.push({ label: `Hook script at ${paths.bin()}`, ok: existsSync(paths.bin()), fix: "Run npx getstint install" });
  try {
    await api.me(config);
    checks.push({ label: `Reached ${config.apiUrl} and the key works`, ok: true });
  } catch (error) {
    checks.push({
      label: `Reaching ${config.apiUrl}`,
      ok: false,
      fix: error instanceof Error ? error.message : String(error),
    });
  }
  for (const integration of integrations.filter((item) => item.installed()))
    checks.push({ label: `${integration.name} connected`, ok: true });
  if (integrations.find((item) => item.id === IntegrationId.Codex)?.installed())
    checks.push({
      label: "Codex hooks need one approval",
      ok: onPath("codex"),
      fix: "Open Codex, run /hooks and trust the Stint entries",
    });
  const state = loadState();
  const connected = integrations.some(
    (item) => item.installed() && item.id !== IntegrationId.Editors && item.id !== IntegrationId.WakaTime,
  );
  if (connected)
    checks.push(
      state.lastHook
        ? { label: `Last agent event ${ago(state.lastHook.at)} from ${state.lastHook.agent}`, ok: true }
        : {
            label: "No agent events recorded yet",
            ok: false,
            fix: "Use an agent, then run this again. Agents load hooks when a session starts, so restart any that were already open",
          },
    );
  const queued = queuedCount(paths.queue()) + queuedCount(paths.usageQueue());
  checks.push({
    label: state.lastFlush ? `Last upload ${ago(state.lastFlush)}` : "Nothing uploaded yet",
    ok: Boolean(state.lastFlush) || queued === 0,
    fix: "Run npx getstint flush to send now",
  });
  if (queued > 0)
    checks.push({ label: `${queued} events waiting to send`, ok: !state.lastError, fix: "Run npx getstint flush" });
  if (state.lastError && Date.now() - state.lastError.at < 86_400_000)
    checks.push({
      label: `Last error ${ago(state.lastError.at)}: ${state.lastError.message}`,
      ok: false,
      fix: state.authFailed ? "Your key was rejected. Run npx getstint login" : `Details in ${paths.log()}`,
    });
  for (const check of checks) {
    if (check.ok) p.log.success(check.label);
    else p.log.error(`${check.label}${check.fix ? pc.dim(`  ${check.fix}`) : ""}`);
  }
  return checks.every((check) => check.ok);
}
