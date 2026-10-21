import * as p from "@clack/prompts";
import pc from "picocolors";
import { doctor } from "./commands/doctor";
import { hook } from "./commands/hook";
import { install, uninstall } from "./commands/install";
import { login } from "./commands/login";
import { run } from "./commands/run";
import { setup } from "./commands/setup";
import { status } from "./commands/status";
import { sync } from "./commands/sync";
import { parseArgs } from "./lib/args";
import { loadConfig, saveConfig } from "./lib/config";
import { flush } from "./lib/sender";
import { brand } from "./lib/ui";
import { version } from "./lib/version";

const help = `${brand()} ${pc.dim(`v${version}`)}  Coding time and AI agent tracking for getstint.dev

${pc.bold("Usage")}  npx getstint [command]

${pc.bold("Commands")}
  ${pc.cyan("(none)")}            Sign in, pick what to track, import past agent usage
  ${pc.cyan("login")}             Connect this machine ${pc.dim("--no-browser  --key <key>  --api-url <url>")}
  ${pc.cyan("logout")}            Forget the key on this machine
  ${pc.cyan("status")}            Who you are, today's time and what's connected
  ${pc.cyan("install")} [ids]     Connect agents and editors ${pc.dim("--all")}
  ${pc.cyan("uninstall")} [ids]   Disconnect them again
  ${pc.cyan("sync")}              Import token usage from past agent sessions ${pc.dim("--days <n>")}
  ${pc.cyan("run")} <agent>       Track any CLI agent by wrapping it ${pc.dim("stint run grok")}
  ${pc.cyan("flush")}             Send anything waiting in the offline queue
  ${pc.cyan("doctor")}            Check that everything is wired up

${pc.bold("Integrations")}  claude-code, codex, gemini-cli, opencode, editors, wakatime

Docs: https://github.com/getstint/stint-cli`;

async function main(): Promise<number> {
  const { command, positionals, flags } = parseArgs(process.argv.slice(2));
  if (flags.version) {
    console.info(version);
    return 0;
  }
  if (flags.help || command === "help") {
    console.info(help);
    return 0;
  }
  const loginOptions = {
    key: typeof flags.key === "string" ? flags.key : undefined,
    apiUrl: typeof flags["api-url"] === "string" ? flags["api-url"] : undefined,
    browser: flags.browser !== false,
  };
  switch (command) {
    case undefined:
    case "setup":
      await setup({ ...loginOptions, yes: flags.yes === true });
      return 0;
    case "login":
      p.intro(brand());
      await login(loginOptions);
      p.outro("This machine is connected. Run `npx getstint install` to pick what to track.");
      return 0;
    case "logout":
      saveConfig({ apiKey: undefined, username: undefined, email: undefined });
      p.log.success(
        "Signed out on this machine. Revoke the key at getstint.dev/dashboard/settings?tab=api if you want it gone for good.",
      );
      return 0;
    case "status":
    case "whoami":
      await status();
      return 0;
    case "install":
      p.intro(brand());
      await install(positionals, flags.all === true);
      p.outro("Done.");
      return 0;
    case "uninstall":
      uninstall(positionals);
      return 0;
    case "sync":
      await sync({
        days: typeof flags.days === "string" ? Number(flags.days) : undefined,
        quiet: flags.quiet === true,
      });
      return 0;
    case "flush": {
      const result = await flush(loadConfig(), typeof flags.agent === "string" ? flags.agent : undefined);
      if (!flags.quiet)
        console.info(
          result.error ? `Queued: ${result.error}` : `Sent ${result.sent} events and ${result.samples} usage records.`,
        );
      return 0;
    }
    case "hook":
      await hook(positionals[0]);
      return 0;
    case "run":
      return run(positionals);
    case "doctor":
      return (await doctor()) ? 0 : 1;
    default:
      console.error(`Unknown command "${command}".\n`);
      console.info(help);
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (process.argv[2] === "hook") process.exit(0);
    p.log.error(message);
    process.exit(1);
  });
