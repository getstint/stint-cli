import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

export const maxQueued = 20_000;
const staleClaimMs = 10 * 60_000;

export function enqueue<T>(path: string, items: T[]) {
  if (items.length === 0) return;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, items.map((item) => JSON.stringify(item)).join("\n") + "\n");
}

function parseLines<T>(text: string): T[] {
  const items: T[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      items.push(JSON.parse(line) as T);
    } catch {}
  }
  return items;
}

function reclaimStale(path: string) {
  const dir = dirname(path);
  const prefix = `${basename(path)}.claim-`;
  let entries: string[] = [];
  try {
    entries = readdirSync(dir).filter((name) => name.startsWith(prefix));
  } catch {
    return;
  }
  for (const name of entries) {
    const claim = join(dir, name);
    try {
      if (Date.now() - statSync(claim).mtimeMs < staleClaimMs) continue;
      appendFileSync(path, readFileSync(claim, "utf8"));
      rmSync(claim, { force: true });
    } catch {}
  }
}

export type Claim<T> = { items: T[]; done: () => void; release: (unsent: T[]) => void };

export function claim<T>(path: string): Claim<T> | null {
  reclaimStale(path);
  if (!existsSync(path)) return null;
  const claimPath = `${path}.claim-${process.pid}-${Date.now()}`;
  try {
    renameSync(path, claimPath);
  } catch {
    return null;
  }
  const all = parseLines<T>(readFileSync(claimPath, "utf8"));
  const items = all.slice(-maxQueued);
  return {
    items,
    done: () => rmSync(claimPath, { force: true }),
    release: (unsent) => {
      rmSync(claimPath, { force: true });
      enqueue(path, unsent.slice(-maxQueued));
    },
  };
}

export function queuedCount(path: string): number {
  try {
    return readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

export function clearQueue(path: string) {
  writeFileSync(path, "");
}
