import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function readJsonFile<T>(path: string): T | null {
  const text = readText(path);
  if (text === null) return null;
  try {
    return JSON.parse(stripJsonComments(text)) as T;
  } catch {
    return null;
  }
}

export function writeFileAtomic(path: string, content: string, mode?: number) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, content, mode === undefined ? undefined : { mode });
  renameSync(temp, path);
  if (mode !== undefined && process.platform !== "win32") chmodSync(path, mode);
}

export function writeJsonFile(path: string, value: unknown, mode?: number) {
  writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`, mode);
}

export function backupOnce(path: string, suffix = ".stint-backup"): string | null {
  if (!existsSync(path) || existsSync(path + suffix)) return null;
  writeFileSync(path + suffix, readFileSync(path));
  return path + suffix;
}

export function stripJsonComments(text: string): string {
  let out = "";
  let inString = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inString) {
      out += char;
      if (char === "\\") {
        out += next ?? "";
        index += 1;
      } else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
    } else if (char === "/" && next === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
      out += "\n";
    } else if (char === "/" && next === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
      index += 1;
    } else out += char;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}
