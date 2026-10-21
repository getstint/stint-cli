import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const base = process.env.STINT_URL ?? "http://localhost:3210";
const cli = resolve("dist/stint.mjs");
const sandbox = mkdtempSync(join(tmpdir(), "stint-e2e-"));
const env = {
  ...process.env,
  STINT_HOME_OVERRIDE: sandbox,
  STINT_HOME: join(sandbox, ".stint"),
  CLAUDE_CONFIG_DIR: join(sandbox, ".claude"),
  CODEX_HOME: join(sandbox, ".codex"),
  XDG_CONFIG_HOME: join(sandbox, ".config"),
  XDG_DATA_HOME: join(sandbox, ".local", "share"),
  WAKATIME_HOME: sandbox,
  STINT_NO_BROWSER: "1",
};
delete (env as Record<string, string | undefined>).STINT_API_KEY;
delete (env as Record<string, string | undefined>).STINT_API_URL;
let failures = 0;
let cookie = "";

const check = (label: string, ok: boolean, detail?: unknown) => {
  console.info(
    `${ok ? "ok  " : "FAIL"} ${label}${ok || detail === undefined ? "" : ` → ${typeof detail === "string" ? detail.slice(0, 600) : JSON.stringify(detail).slice(0, 600)}`}`,
  );
  if (!ok) failures += 1;
};

const call = async (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  if (init.body) headers.set("content-type", "application/json");
  headers.set("origin", base);
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const set = response.headers.getSetCookie();
  if (set.length) cookie = set.map((value) => value.split(";")[0]).join("; ");
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: text };
  }
};

function runCli(
  args: string[],
  input?: string,
  onOutput?: (text: string) => void,
): Promise<{ code: number; output: string }> {
  return new Promise((done) => {
    const child = spawn(process.execPath.includes("bun") ? "node" : process.execPath, [cli, ...args], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      onOutput?.(output);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("exit", (code) => done({ code: code ?? 1, output }));
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const email = `cli-${Date.now()}@acme.dev`;
await call("/api/auth/sign-up/email", {
  method: "POST",
  body: JSON.stringify({ email, password: "correct horse battery", name: "Cli Tester" }),
});

let approved = false;
const login = await runCli(["login", "--no-browser", "--api-url", base], undefined, (output) => {
  const code = /\b([A-Z0-9]{4})-([A-Z0-9]{4})\b/.exec(output.replace(/\x1b\[[0-9;]*m/g, ""));
  if (code && !approved) {
    approved = true;
    const userCode = `${code[1]}${code[2]}`;
    void call(`/api/auth/device?user_code=${userCode}`)
      .then(() => call("/api/auth/device/approve", { method: "POST", body: JSON.stringify({ userCode }) }))
      .then((result) => check("approve the device code in the browser session", result.status === 200, result));
  }
});
const config = JSON.parse(readFileSync(join(sandbox, ".stint", "config.json"), "utf8"));
check(
  "device login finishes and saves a key",
  login.code === 0 && /^[0-9a-f-]{36}$/.test(config.apiKey) && config.username,
  login.output,
);
check("the hook script is installed", existsSync(join(sandbox, ".stint", "bin", "stint.mjs")));

const keys = await call("/api/v1/me/api-keys");
check(
  "the key is named after this machine",
  Array.isArray(keys.body.keys) && keys.body.keys.some((key: { name: string }) => key.name.endsWith("· CLI")),
  keys.body,
);

mkdirSync(join(sandbox, ".claude"), { recursive: true });
writeFileSync(
  join(sandbox, ".claude", "settings.json"),
  JSON.stringify({ model: "opus", hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } }, null, 2),
);
mkdirSync(join(sandbox, ".codex"), { recursive: true });
const install = await runCli(["install", "claude-code", "codex", "gemini-cli", "opencode", "wakatime"]);
check("install connects every agent", install.code === 0, install.output);
const claudeSettings = JSON.parse(readFileSync(join(sandbox, ".claude", "settings.json"), "utf8"));
check(
  "Claude settings keep the user's own hook and model",
  claudeSettings.model === "opus" &&
    claudeSettings.hooks.Stop.length === 2 &&
    claudeSettings.hooks.Stop[0].hooks[0].command === "echo mine",
  claudeSettings,
);
check(
  "Codex hooks.json written",
  JSON.parse(readFileSync(join(sandbox, ".codex", "hooks.json"), "utf8")).hooks.Stop.length === 1,
);
check(
  "Gemini settings written",
  JSON.parse(readFileSync(join(sandbox, ".gemini", "settings.json"), "utf8")).hooks.AfterAgent.length === 1,
);
check(
  "OpenCode plugin written",
  readFileSync(join(sandbox, ".config", "opencode", "plugins", "stint.js"), "utf8").includes("StintPlugin"),
);
const waka = readFileSync(join(sandbox, ".wakatime.cfg"), "utf8");
check(
  "WakaTime plugins point at Stint",
  waka.includes(`api_url = ${base}/api/compat/wakatime/v1`) && waka.includes(`api_key = ${config.apiKey}`),
  waka,
);
const again = await runCli(["install", "claude-code"]);
check(
  "installing again does not duplicate hooks",
  again.code === 0 &&
    JSON.parse(readFileSync(join(sandbox, ".claude", "settings.json"), "utf8")).hooks.Stop.length === 2,
);

const project = join(sandbox, "work", "acme-api");
mkdirSync(join(project, ".git"), { recursive: true });
writeFileSync(join(project, ".git", "HEAD"), "ref: refs/heads/feature/hooks\n");
const now = Date.now();
const transcript = join(sandbox, "transcript.jsonl");
writeFileSync(
  transcript,
  [0, 1]
    .map((index) =>
      JSON.stringify({
        type: "assistant",
        timestamp: new Date(now - 120_000 + index * 60_000).toISOString(),
        sessionId: "e2e",
        cwd: project,
        message: {
          id: `msg_e2e_${now}_${index}`,
          model: "claude-opus-5-5",
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_input_tokens: 1000,
            cache_creation_input_tokens: 10,
          },
        },
      }),
    )
    .join("\n") + "\n",
);
const bin = join(sandbox, ".stint", "bin", "stint.mjs");
const hookRun = (agent: string, payload: unknown) =>
  new Promise<number>((done) => {
    const started = Date.now();
    const child = spawn("node", [bin, "hook", agent], { env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (chunk: Buffer) => (out += chunk.toString()));
    child.on("exit", (code) => {
      check(`${agent} hook exits fast and silently`, code === 0 && out === "" && Date.now() - started < 3000, {
        code,
        out,
        ms: Date.now() - started,
      });
      done(code ?? 1);
    });
    child.stdin.end(JSON.stringify(payload));
  });
await hookRun("claude-code", { hook_event_name: "UserPromptSubmit", session_id: "e2e", cwd: project });
await hookRun("claude-code", {
  hook_event_name: "PostToolUse",
  session_id: "e2e",
  cwd: project,
  tool_name: "Edit",
  tool_input: { file_path: join(project, "src", "server.ts") },
});
await hookRun("claude-code", { hook_event_name: "Stop", session_id: "e2e", cwd: project, transcript_path: transcript });
await hookRun("opencode", {
  source: "getstint",
  hook_event_name: "message.updated",
  cwd: project,
  session_id: "oc",
  message: {
    id: `oc_${now}`,
    sessionID: "oc",
    role: "assistant",
    modelID: "claude-sonnet-5-5",
    time: { created: now - 5000, completed: now - 1000 },
    tokens: { input: 7, output: 3, reasoning: 0, cache: { read: 0, write: 0 } },
  },
});

let usageOk = false;
for (let attempt = 0; attempt < 20 && !usageOk; attempt += 1) {
  await sleep(500);
  const usage = await call("/api/v1/me/usage?days=1");
  const rows = (usage.body.days?.[0]?.usage ?? []) as { agent: string; input: number; cacheRead: number }[];
  usageOk =
    rows.some((row) => row.agent === "claude-code" && row.input === 200 && row.cacheRead === 2000) &&
    rows.some((row) => row.agent === "opencode" && row.input === 7);
  if (attempt === 19) check("token usage reached Stint from the hooks", usageOk, usage.body);
}
if (usageOk) check("token usage reached Stint from the hooks", true);

mkdirSync(join(sandbox, ".claude", "projects", "acme"), { recursive: true });
writeFileSync(join(sandbox, ".claude", "projects", "acme", "session.jsonl"), readFileSync(transcript));
const synced = await runCli(["sync"]);
check("sync backfills past sessions", synced.code === 0 && /claude-code/.test(synced.output), synced.output);
const resync = await runCli(["sync"]);
check("a second sync reads nothing new", resync.code === 0 && !/claude-code/.test(resync.output), resync.output);
const activity = await call("/api/v1/me/activity?days=1");
const today = activity.body.days?.[0];
check(
  "agent time is recorded for the project",
  today && today.agents["claude-code"] >= 60 && today.seconds === 0,
  today,
);

const status = await runCli(["status"]);
check("status shows the account", status.code === 0 && status.output.includes(config.username), status.output);
const doctor = await runCli(["doctor"]);
check("doctor passes", doctor.code === 0, doctor.output);

const uninstall = await runCli(["uninstall", "claude-code", "wakatime"]);
const cleaned = JSON.parse(readFileSync(join(sandbox, ".claude", "settings.json"), "utf8"));
check(
  "uninstall removes only Stint's hooks",
  uninstall.code === 0 &&
    JSON.stringify(cleaned.hooks) ===
      JSON.stringify({ Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] }),
  cleaned,
);
check(
  "uninstall restores the WakaTime config",
  !readFileSync(join(sandbox, ".wakatime.cfg"), "utf8").includes("api_compat"),
);

const offline = { ...env, STINT_API_URL: "http://localhost:1" };
await new Promise<void>((done) => {
  const child = spawn("node", [bin, "hook", "codex"], { env: offline, stdio: ["pipe", "ignore", "ignore"] });
  child.on("exit", () => done());
  child.stdin.end(JSON.stringify({ hook_event_name: "PostToolUse", session_id: "x", cwd: project }));
});
await sleep(1500);
const flushed = await runCli(["flush"]);
check("events made offline are sent later", flushed.code === 0 && /Sent [1-9]/.test(flushed.output), flushed.output);

await call("/api/v1/me", { method: "DELETE" });
console.info(
  failures === 0
    ? `\nAll CLI e2e checks passed (sandbox ${sandbox}).`
    : `\n${failures} CLI e2e checks failed (sandbox ${sandbox}).`,
);
process.exit(failures === 0 ? 0 : 1);
