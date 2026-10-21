import * as p from "@clack/prompts";
import { hostname } from "node:os";
import pc from "picocolors";
import { api, ApiError, deviceClientId } from "../lib/api";
import { loadConfig, normalizeApiUrl, saveConfig, type Config } from "../lib/config";
import { ensureBin } from "../lib/runtime";
import { canOpenBrowser, copyToClipboard, isInteractive, link, openBrowser } from "../lib/ui";

export type LoginOptions = { key?: string; apiUrl?: string; browser?: boolean };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function verificationLink(config: Pick<Config, "apiUrl">, userCode: string): string {
  const url = new URL("/device", config.apiUrl);
  url.searchParams.set("user_code", userCode);
  url.searchParams.set("client", deviceClientId);
  return url.toString();
}

export const formatCode = (code: string) => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

async function finish(config: Config, apiKey: string): Promise<Config> {
  const me = await api.me({ ...config, apiKey });
  ensureBin();
  return saveConfig({ apiUrl: config.apiUrl, apiKey, username: me.username, email: me.email });
}

async function pollForToken(
  config: Config,
  deviceCode: string,
  intervalSeconds: number,
  expiresIn: number,
  spinner: ReturnType<typeof p.spinner>,
): Promise<string> {
  let interval = Math.max(intervalSeconds, 2) * 1000;
  const deadline = Date.now() + expiresIn * 1000;
  while (Date.now() < deadline) {
    await sleep(interval);
    try {
      const { access_token } = await api.deviceToken(config, deviceCode);
      return access_token;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.code === "authorization_pending" || error.status === 0) continue;
      if (error.code === "slow_down") {
        interval += 5000;
        continue;
      }
      if (error.code === "access_denied") throw new Error("Sign-in was denied in the browser.");
      if (error.code === "expired_token") throw new Error("The code expired. Run the command again for a new one.");
      throw error;
    }
  }
  spinner.stop("Timed out");
  throw new Error("The code expired before it was approved. Run the command again for a new one.");
}

export async function login(options: LoginOptions = {}): Promise<Config> {
  const base = loadConfig();
  const config = { ...base, apiUrl: options.apiUrl ? normalizeApiUrl(options.apiUrl) : base.apiUrl };

  if (options.key) {
    const spinner = p.spinner();
    spinner.start("Checking your key");
    try {
      const saved = await finish(config, options.key.trim());
      spinner.stop(`Signed in as ${pc.bold(saved.username ?? "you")}`);
      return saved;
    } catch (error) {
      spinner.stop("That key didn’t work", 1);
      throw error;
    }
  }

  const device = await api.deviceCode(config);
  const url = verificationLink(config, device.user_code);
  const code = formatCode(device.user_code);
  const browser = options.browser !== false && canOpenBrowser();
  const copied = isInteractive() && copyToClipboard(url);

  p.note(
    [
      `${pc.dim("Your code")}   ${pc.bold(pc.white(code))}`,
      "",
      browser
        ? "Approve this sign-in in the browser window that just opened."
        : "Open this link on any device and approve the sign-in:",
      link(url),
      copied ? pc.dim("The link is on your clipboard.") : "",
    ]
      .filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""))
      .join("\n"),
    "Connect this machine",
  );

  if (browser) {
    if (isInteractive()) {
      const go = await p.confirm({ message: "Open the browser now?", initialValue: true });
      if (p.isCancel(go)) throw new Error("Cancelled.");
      if (go) openBrowser(url);
    } else openBrowser(url);
  }

  const spinner = p.spinner();
  spinner.start("Waiting for you to approve in the browser");
  const sessionToken = await pollForToken(config, device.device_code, device.interval, device.expires_in, spinner);
  spinner.message("Creating a key for this machine");
  try {
    const { key } = await api.mintKey(config, sessionToken, `${hostname()} · CLI`.slice(0, 60));
    const saved = await finish(config, key);
    spinner.stop(`Signed in as ${pc.bold(saved.username ?? "you")}`);
    return saved;
  } finally {
    await api.signOutSession(config, sessionToken);
  }
}
