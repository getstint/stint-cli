import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { paths } from "./paths";

const maxBytes = 1024 * 1024;

export function logLine(message: string) {
  const file = paths.log();
  try {
    mkdirSync(dirname(file), { recursive: true });
    try {
      if (statSync(file).size > maxBytes) renameSync(file, `${file}.1`);
    } catch {}
    appendFileSync(file, `${new Date().toISOString()} ${message.replace(/\s+/g, " ").slice(0, 2000)}\n`);
  } catch {}
}
