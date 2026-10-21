import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export type ProjectInfo = { root: string; name: string; branch?: string };

function gitDirFor(root: string): string | null {
  const dotGit = join(root, ".git");
  try {
    if (statSync(dotGit).isDirectory()) return dotGit;
    const pointer = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, "utf8"))?.[1]?.trim();
    if (!pointer) return null;
    return isAbsolute(pointer) ? pointer : resolve(root, pointer);
  } catch {
    return null;
  }
}

export function findRepoRoot(start: string): string | null {
  let current = resolve(start);
  for (let depth = 0; depth < 64; depth += 1) {
    if (existsSync(join(current, ".git"))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

export function branchFor(root: string): string | undefined {
  const gitDir = gitDirFor(root);
  if (!gitDir) return undefined;
  try {
    const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
    const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head)?.[1];
    return ref ?? undefined;
  } catch {
    return undefined;
  }
}

export function projectFor(cwd: string | undefined): ProjectInfo | null {
  if (!cwd) return null;
  const root = findRepoRoot(cwd) ?? resolve(cwd);
  const name = basename(root);
  if (!name) return null;
  return { root, name, branch: branchFor(root) };
}
