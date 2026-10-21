import * as p from "@clack/prompts";
import pc from "picocolors";
import { integrationById, integrations, IntegrationKind, type Integration } from "../agents/registry";
import { rememberInstalled } from "../lib/config";
import { ensureBin } from "../lib/runtime";

export function describe(integration: Integration): string {
  const state = integration.installed()
    ? pc.green("connected")
    : integration.detected()
      ? pc.yellow("found")
      : pc.dim("not found");
  return `${integration.name} ${pc.dim(`(${state}${pc.dim(")")}`)}`;
}

export async function pickIntegrations(): Promise<Integration[] | null> {
  const agents = integrations.filter((integration) => integration.kind === IntegrationKind.Agent);
  const editors = integrations.filter((integration) => integration.kind === IntegrationKind.Editor);
  const choice = await p.groupMultiselect({
    message: "What should Stint track?",
    options: {
      "AI agents": agents.map((integration) => ({
        value: integration.id,
        label: integration.name,
        hint: integration.installed()
          ? "connected"
          : integration.detected()
            ? integration.hint
            : "not found on this machine",
      })),
      Editors: editors.map((integration) => ({
        value: integration.id,
        label: integration.name,
        hint: integration.installed() ? "connected" : integration.hint,
      })),
    },
    initialValues: integrations
      .filter(
        (integration) =>
          integration.installed() || (integration.detected() && integration.kind === IntegrationKind.Agent),
      )
      .map((integration) => integration.id),
    required: false,
  });
  if (p.isCancel(choice)) return null;
  return (choice as string[])
    .map((id) => integrationById(id))
    .filter((integration): integration is Integration => Boolean(integration));
}

export function applyIntegrations(selected: Integration[]): { ok: number; failed: number } {
  ensureBin();
  let ok = 0;
  let failed = 0;
  for (const integration of selected) {
    try {
      const result = integration.install();
      rememberInstalled(integration.id, true);
      p.log.success(`${pc.bold(integration.name)}  ${pc.dim(result)}`);
      ok += 1;
    } catch (error) {
      p.log.error(`${pc.bold(integration.name)}  ${error instanceof Error ? error.message : String(error)}`);
      failed += 1;
    }
  }
  return { ok, failed };
}

export async function install(ids: string[], all: boolean) {
  if (ids.length === 0 && !all) {
    const picked = await pickIntegrations();
    if (!picked) return p.cancel("Nothing changed.");
    applyIntegrations(picked);
    return;
  }
  const unknown = ids.filter((id) => !integrationById(id));
  if (unknown.length)
    throw new Error(
      `Unknown integration: ${unknown.join(", ")}. Try: ${integrations.map((integration) => integration.id).join(", ")}`,
    );
  applyIntegrations(
    all ? integrations.filter((integration) => integration.detected()) : ids.map((id) => integrationById(id)!),
  );
}

export function uninstall(ids: string[]) {
  const targets = ids.length
    ? ids.map((id) => integrationById(id)).filter((integration): integration is Integration => Boolean(integration))
    : integrations.filter((integration) => integration.installed());
  if (targets.length === 0) return p.log.info("Nothing is connected.");
  for (const integration of targets) {
    try {
      p.log.success(`${pc.bold(integration.name)}  ${pc.dim(integration.uninstall())}`);
      rememberInstalled(integration.id, false);
    } catch (error) {
      p.log.error(`${pc.bold(integration.name)}  ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
