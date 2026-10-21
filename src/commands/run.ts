import { spawn } from "node:child_process";
import { loadConfig } from "../lib/config";
import { heartbeatFromHook } from "../lib/hookEvent";
import { projectFor } from "../lib/project";
import { runDetached } from "../lib/runtime";
import { queueHeartbeats } from "../lib/sender";

const pulseMs = 60_000;

export const wrappedAgents: Record<string, string> = {
  grok: "grok-cli",
  copilot: "copilot-cli",
  amp: "amp",
  qwen: "qwen-code",
  kiro: "kiro",
  cline: "cline",
};

export async function run(args: string[]): Promise<number> {
  const separator = args.indexOf("--");
  const [name, ...rest] = separator === -1 ? args : [args[0], ...args.slice(separator + 1)];
  if (!name) throw new Error("Usage: stint run <agent> [-- command args]   e.g. stint run grok");
  const agent = wrappedAgents[name] ?? name;
  const command = separator === -1 ? [name, ...rest] : rest;
  const config = loadConfig();
  const session = `${agent}-${Date.now().toString(36)}`;
  const project = projectFor(process.cwd());
  const pulse = () => {
    if (!config.apiKey) return;
    queueHeartbeats([
      {
        ...heartbeatFromHook(agent, { session_id: session, cwd: process.cwd() }, Date.now() / 1000, project),
        machine: config.machine,
      },
    ]);
    runDetached(["flush", "--quiet", `--agent=${agent}`]);
  };
  pulse();
  const timer = setInterval(pulse, pulseMs);
  const child = spawn(command[0], command.slice(1), { stdio: "inherit", shell: process.platform === "win32" });
  const code = await new Promise<number>((resolve) => {
    child.on("exit", (exitCode) => resolve(exitCode ?? 0));
    child.on("error", () => resolve(127));
  });
  clearInterval(timer);
  pulse();
  return code;
}
