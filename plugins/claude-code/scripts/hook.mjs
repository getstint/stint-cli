import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const agent = process.argv[2] ?? "claude-code";
const local = join(process.env.STINT_HOME ?? join(homedir(), ".stint"), "bin", "stint.mjs");
const [command, args] = existsSync(local)
  ? [process.execPath, [local, "hook", agent]]
  : [process.platform === "win32" ? "npx.cmd" : "npx", ["--yes", "getstint@latest", "hook", agent]];

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  try {
    const child = spawn(command, args, {
      stdio: ["pipe", "ignore", "ignore"],
      windowsHide: true,
      shell: process.platform === "win32" && command.endsWith(".cmd"),
    });
    child.on("error", () => process.exit(0));
    child.on("exit", () => process.exit(0));
    child.stdin.on("error", () => {});
    child.stdin.end(Buffer.concat(chunks));
  } catch {
    process.exit(0);
  }
});
process.stdin.on("error", () => process.exit(0));
setTimeout(() => process.exit(0), 25_000).unref();
