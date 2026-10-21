export type HookHandler = { type: "command"; command: string; [key: string]: unknown };

export type HookGroup = { matcher?: string; hooks: HookHandler[]; [key: string]: unknown };

export type HookSettings = { hooks?: Record<string, HookGroup[]>; [key: string]: unknown };

export type HookSpec = { event: string; matcher?: string; handler: HookHandler };

export const stintMarker = (agent: string) =>
  new RegExp(`stint(\\.mjs)?["']?\\s+hook\\s+${agent.replace(/[-]/g, "\\-")}(\\s|$)`);

const isOurs = (handler: unknown, agent: string) => {
  const command = (handler as { command?: unknown })?.command;
  return typeof command === "string" && stintMarker(agent).test(command);
};

export function removeHooks(settings: HookSettings, agent: string): HookSettings {
  if (!settings.hooks || typeof settings.hooks !== "object") return settings;
  const hooks: Record<string, HookGroup[]> = {};
  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) {
      hooks[event] = groups;
      continue;
    }
    const kept = groups
      .map((group) =>
        group && Array.isArray(group.hooks)
          ? { ...group, hooks: group.hooks.filter((handler) => !isOurs(handler, agent)) }
          : group,
      )
      .filter((group) => !group || !Array.isArray(group.hooks) || group.hooks.length > 0);
    if (kept.length > 0) hooks[event] = kept;
  }
  if (Object.keys(hooks).length > 0) return { ...settings, hooks };
  const { hooks: _dropped, ...rest } = settings;
  return rest;
}

export function addHooks(settings: HookSettings, agent: string, specs: HookSpec[]): HookSettings {
  const cleaned = removeHooks(settings, agent);
  const hooks: Record<string, HookGroup[]> = { ...(cleaned.hooks ?? {}) };
  for (const spec of specs) {
    const group: HookGroup =
      spec.matcher === undefined ? { hooks: [spec.handler] } : { matcher: spec.matcher, hooks: [spec.handler] };
    hooks[spec.event] = [...(hooks[spec.event] ?? []), group];
  }
  return { ...cleaned, hooks };
}

export function hasHooks(settings: HookSettings | null, agent: string): boolean {
  if (!settings?.hooks) return false;
  return Object.values(settings.hooks).some(
    (groups) =>
      Array.isArray(groups) &&
      groups.some((group) => Array.isArray(group?.hooks) && group.hooks.some((handler) => isOurs(handler, agent))),
  );
}
