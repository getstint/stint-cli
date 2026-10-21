import { hostname } from "node:os";
import { readJsonFile, writeJsonFile } from "./files";
import { paths } from "./paths";

export const defaultApiUrl = "https://getstint.dev";

export type Config = {
  apiUrl: string;
  apiKey?: string;
  username?: string;
  email?: string;
  machine: string;
  installed: string[];
  hideProjectNames?: boolean;
};

const ownerOnly = 0o600;

export function normalizeApiUrl(value: string): string {
  const url = new URL(value.includes("://") ? value : `https://${value}`);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Stint only talks to servers over HTTPS (http is allowed for localhost).");
  return url.origin;
}

export function loadConfig(): Config {
  const stored = readJsonFile<Partial<Config>>(paths.config()) ?? {};
  const apiUrl = process.env.STINT_API_URL ?? stored.apiUrl ?? defaultApiUrl;
  return {
    apiUrl: normalizeApiUrl(apiUrl),
    apiKey: process.env.STINT_API_KEY ?? stored.apiKey,
    username: stored.username,
    email: stored.email,
    machine: stored.machine ?? hostname(),
    installed: Array.isArray(stored.installed) ? stored.installed.filter((item) => typeof item === "string") : [],
    hideProjectNames: stored.hideProjectNames === true,
  };
}

export function saveConfig(changes: Partial<Config>): Config {
  const stored = readJsonFile<Partial<Config>>(paths.config()) ?? {};
  const next = { ...stored, ...changes };
  for (const key of Object.keys(next) as (keyof Config)[]) if (next[key] === undefined) delete next[key];
  writeJsonFile(paths.config(), next, ownerOnly);
  return loadConfig();
}

export function rememberInstalled(id: string, installed: boolean) {
  const current = new Set(loadConfig().installed);
  if (installed) current.add(id);
  else current.delete(id);
  saveConfig({ installed: [...current].sort() });
}
