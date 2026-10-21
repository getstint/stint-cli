import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { paths } from "./paths";
import { version } from "./version";

export function onPath(command: string): boolean {
  const probe =
    process.platform === "win32"
      ? spawnSync("where", [command], { stdio: "ignore", windowsHide: true })
      : spawnSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
  return probe.status === 0;
}

function currentScript(): string | null {
  try {
    const file = realpathSync(fileURLToPath(import.meta.url));
    return extname(file) === ".mjs" ? file : null;
  } catch {
    return null;
  }
}

const versionFile = () => `${paths.bin()}.version`;

export function installedBinVersion(): string | null {
  try {
    return readFileSync(versionFile(), "utf8").trim();
  } catch {
    return null;
  }
}

export function ensureBin(): string {
  const target = paths.bin();
  const source = currentScript();
  if (source && source !== target && (installedBinVersion() !== version || !existsSync(target))) {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    writeFileSync(versionFile(), version);
  }
  return target;
}

export function nodeCommand(): string {
  return onPath("node") ? "node" : process.execPath;
}

const quote = (value: string) => (/[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value);

export function hookCommand(agent: string): string {
  return `${quote(nodeCommand())} ${quote(paths.bin().replace(/\\/g, "/"))} hook ${agent}`;
}

export function runDetached(args: string[]) {
  const bin = existsSync(paths.bin()) ? paths.bin() : currentScript();
  if (!bin) return;
  try {
    const child = spawn(nodeCommand(), [bin, ...args], {
      stdio: "ignore",
      detached: true,
      windowsHide: true,
      env: process.env,
    });
    child.on("error", () => undefined);
    child.unref();
  } catch {}
}
