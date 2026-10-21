import { collectFile, projectName } from "../lib/collect";
import { loadConfig } from "../lib/config";
import { heartbeatFromHook, isTurnEnd, type HookPayload } from "../lib/hookEvent";
import { logLine } from "../lib/log";
import { projectFor } from "../lib/project";
import { runDetached } from "../lib/runtime";
import { queueHeartbeats, queueUsage } from "../lib/sender";
import { loadState, saveState } from "../lib/state";
import { opencodeAgent, opencodeSample } from "../parsers/opencode";

const flushEveryMs = 60_000;
export const syncEveryMs = 60 * 60_000;
const maxStdinBytes = 4 * 1024 * 1024;

async function readStdin(timeoutMs: number): Promise<string> {
  if (process.stdin.isTTY) return "";
  return new Promise((resolve) => {
    let data = "";
    const done = () => resolve(data);
    const timer = setTimeout(done, timeoutMs);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      if (data.length < maxStdinBytes) data += chunk;
    });
    process.stdin.on("end", () => {
      clearTimeout(timer);
      done();
    });
    process.stdin.on("error", () => {
      clearTimeout(timer);
      done();
    });
  });
}

export async function hook(agent: string | undefined) {
  try {
    if (!agent || !/^[a-z0-9-]{2,40}$/.test(agent)) return;
    const raw = await readStdin(2000);
    let payload: HookPayload = {};
    try {
      payload = raw.trim() ? (JSON.parse(raw) as HookPayload) : {};
    } catch {
      payload = {};
    }
    const config = loadConfig();
    if (!config.apiKey) return;
    const now = Date.now() / 1000;
    const cwd = payload.cwd ?? payload.workspace_roots?.[0] ?? process.cwd();
    const project = projectFor(cwd);
    queueHeartbeats([{ ...heartbeatFromHook(agent, { ...payload, cwd }, now, project), machine: config.machine }]);

    const state = loadState();
    const end = isTurnEnd(payload.hook_event_name);
    if (agent === opencodeAgent && payload.message) {
      const { sample } = opencodeSample(payload.message, { projectOf: projectName });
      if (sample) queueUsage([sample]);
    } else if (end && payload.transcript_path) {
      const parsed = collectFile(agent, payload.transcript_path, state, cwd);
      queueUsage(parsed.samples);
    }
    const syncDue = !state.lastSync || Date.now() - state.lastSync > syncEveryMs;
    if (syncDue) state.lastSync = Date.now();
    saveState(state);
    if (syncDue) runDetached(["sync", "--quiet"]);
    else if (end || !state.lastFlush || Date.now() - state.lastFlush > flushEveryMs)
      runDetached(["flush", "--quiet", `--agent=${agent}`]);
  } catch (error) {
    logLine(`hook ${agent}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  }
}
