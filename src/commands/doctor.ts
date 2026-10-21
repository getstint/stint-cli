import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import pc from "picocolors";
import { integrations } from "../agents/registry";
import { api } from "../lib/api";
import { loadConfig } from "../lib/config";
import { paths } from "../lib/paths";
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
  if (integrations.find((item) => item.id === "codex")?.installed())
    checks.push({
      label: "Codex hooks need one approval",
      ok: onPath("codex"),
      fix: "Open Codex, run /hooks and trust the Stint entries",
    });
  for (const check of checks) {
    if (check.ok) p.log.success(check.label);
    else p.log.error(`${check.label}${check.fix ? pc.dim(`  ${check.fix}`) : ""}`);
  }
  return checks.every((check) => check.ok);
}
