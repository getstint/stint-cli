import { spawn, spawnSync } from "node:child_process";
import pc from "picocolors";

const truecolor =
  /truecolor|24bit/i.test(process.env.COLORTERM ?? "") ||
  process.env.TERM_PROGRAM === "vscode" ||
  process.env.WT_SESSION !== undefined;

export const amber = (text: string) =>
  !pc.isColorSupported ? text : truecolor ? `\x1b[38;2;255;178;36m${text}\x1b[39m` : pc.yellow(text);

export const mark = () => amber("◔");

export const brand = () => `${mark()} ${pc.bold("stint")}`;

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 1) return "0m";
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function formatCount(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

export const isInteractive = () => Boolean(process.stdin.isTTY && process.stdout.isTTY) && process.env.CI === undefined;

export function canOpenBrowser(): boolean {
  if (process.env.STINT_NO_BROWSER || process.env.CI || process.env.SSH_CONNECTION || process.env.SSH_TTY) return false;
  if (process.platform === "linux")
    return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY) && !process.env.WSL_DISTRO_NAME;
  return true;
}

function detached(command: string, args: string[]): boolean {
  try {
    const child = spawn(command, args, { stdio: "ignore", detached: true, windowsHide: true });
    child.on("error", () => undefined);
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export function openBrowser(url: string): boolean {
  if (!/^https?:\/\//.test(url)) return false;
  if (process.platform === "win32") return detached("rundll32", ["url.dll,FileProtocolHandler", url]);
  if (process.platform === "darwin") return detached("open", [url]);
  return detached("xdg-open", [url]);
}

export function copyToClipboard(text: string): boolean {
  const attempts: [string, string[]][] =
    process.platform === "win32"
      ? [["clip", []]]
      : process.platform === "darwin"
        ? [["pbcopy", []]]
        : [
            ["wl-copy", []],
            ["xclip", ["-selection", "clipboard"]],
            ["xsel", ["--clipboard", "--input"]],
          ];
  for (const [command, args] of attempts) {
    try {
      const result = spawnSync(command, args, {
        input: text,
        stdio: ["pipe", "ignore", "ignore"],
        windowsHide: true,
        timeout: 2000,
      });
      if (result.status === 0) return true;
    } catch {}
  }
  return false;
}

export function link(url: string, label = url): string {
  if (!process.stdout.isTTY || process.env.TERM === "dumb") return url;
  return `\x1b]8;;${url}\x07${pc.underline(label)}\x1b]8;;\x07`;
}
