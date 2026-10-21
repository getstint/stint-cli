import * as p from "@clack/prompts";
import pc from "picocolors";
import { api } from "../lib/api";
import { loadConfig } from "../lib/config";
import { brand, isInteractive, link } from "../lib/ui";
import { version } from "../lib/version";
import { applyIntegrations, pickIntegrations } from "./install";
import { login, type LoginOptions } from "./login";
import { sync } from "./sync";

export async function setup(options: LoginOptions & { yes?: boolean }) {
  p.intro(`${brand()} ${pc.dim(`v${version}`)}`);
  let config = loadConfig();
  let signedIn = false;
  if (config.apiKey && !options.key && !options.apiUrl) {
    try {
      const me = await api.me(config);
      p.log.success(`Signed in as ${pc.bold(me.username)}`);
      signedIn = true;
    } catch {
      p.log.warn("Your saved key no longer works, so let’s sign in again.");
    }
  }
  if (!signedIn) config = await login(options);

  if (!isInteractive() || options.yes) {
    const { install } = await import("./install");
    await install([], true);
  } else {
    const picked = await pickIntegrations();
    if (picked === null) {
      p.cancel("Signed in. Connect tools any time with `npx getstint install`.");
      return;
    }
    if (picked.length) applyIntegrations(picked);
    const backfill = await p.confirm({
      message: "Import token usage from your past agent sessions?",
      initialValue: true,
    });
    if (!p.isCancel(backfill) && backfill) await sync();
  }

  p.outro(`You’re set. Your dashboard: ${link(`${config.apiUrl}/dashboard`)}`);
}
