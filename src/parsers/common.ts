import { basename, isAbsolute, relative, resolve } from "node:path";
import { Category, type Heartbeat, type UsageSample } from "../lib/payloads";

export type ParseContext = {
  projectOf: (cwd: string | undefined) => string;
  rootOf?: (cwd: string | undefined) => string | undefined;
  carry?: Record<string, string>;
};

export type Parsed = { samples: UsageSample[]; heartbeats: Heartbeat[]; carry: Record<string, string> };

export const tokens = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;

export const seconds = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value > 1e12 ? value / 1000 : value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed / 1000 : null;
  }
  return null;
};

export function lines(text: string): unknown[] {
  const out: unknown[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {}
  }
  return out;
}

export const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const text = (value: unknown) => (typeof value === "string" ? value : undefined);

export function agentBeat(agent: string, time: number, project: string, session: string, model?: string): Heartbeat {
  return {
    entity: `${agent}:${session}`,
    type: "app",
    category: Category.AiCoding,
    time,
    project: project || undefined,
    agent,
    ai_session: session,
    ai_model: model,
  };
}

export function fileBeat(
  base: Heartbeat,
  root: string | undefined,
  cwd: string | undefined,
  file: string,
  isWrite: boolean,
): Heartbeat | null {
  if (!root || !file || file.length > 1000) return null;
  const absolute = isAbsolute(file) ? file : resolve(cwd ?? root, file);
  const inside = relative(root, absolute);
  if (!inside || inside.startsWith("..") || isAbsolute(inside)) return null;
  const entity = extensionEntity(absolute);
  return entity ? { ...base, entity, type: "file", is_write: isWrite } : null;
}

export function extensionEntity(file: string): string | null {
  const name = basename(file);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `*${name.slice(dot).toLowerCase()}` : null;
}
