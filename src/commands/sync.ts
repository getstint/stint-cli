import * as p from "@clack/prompts";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { collectFile, projectName } from "../lib/collect";
import { loadConfig } from "../lib/config";
import type { Heartbeat, UsageSample } from "../lib/payloads";
import { paths } from "../lib/paths";
import { flush, queueHeartbeats, queueUsage } from "../lib/sender";
import { loadState, saveState } from "../lib/state";
import { formatCount } from "../lib/ui";
import { claudeAgent } from "../parsers/claude";
import { codexAgent } from "../parsers/codex";
import { geminiAgent } from "../parsers/gemini";
import { opencodeAgent, parseOpencodeMessages } from "../parsers/opencode";

const maxAgeDays = 395;

function walk(dir: string, match: (name: string) => boolean, since: number, depth = 0, found: string[] = []): string[] {
  if (depth > 6) return found;
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, since, depth + 1, found);
    else if (match(entry.name)) {
      try {
        if (statSync(full).mtimeMs >= since) found.push(full);
      } catch {}
    }
  }
  return found;
}

export type SyncTotals = { agent: string; files: number; samples: number; tokens: number };

export function scanHistory(days = maxAgeDays): {
  samples: UsageSample[];
  heartbeats: Heartbeat[];
  totals: SyncTotals[];
} {
  const since = Date.now() - Math.min(days, maxAgeDays) * 86_400_000;
  const state = loadState();
  const samples: UsageSample[] = [];
  const heartbeats: Heartbeat[] = [];
  const totals: SyncTotals[] = [];
  const add = (agent: string, files: number, parsed: { samples: UsageSample[]; heartbeats: Heartbeat[] }) => {
    const fresh = parsed.samples.filter((sample) => sample.time * 1000 >= since);
    samples.push(...fresh);
    heartbeats.push(...parsed.heartbeats.filter((beat) => beat.time * 1000 >= since));
    const existing =
      totals.find((total) => total.agent === agent) ??
      totals[totals.push({ agent, files: 0, samples: 0, tokens: 0 }) - 1];
    existing.files += files;
    existing.samples += fresh.length;
    existing.tokens += fresh.reduce(
      (sum, sample) =>
        sum + sample.input_tokens + sample.output_tokens + sample.cache_read_tokens + sample.cache_write_tokens,
      0,
    );
  };

  for (const file of walk(paths.claudeProjects(), (name) => name.endsWith(".jsonl"), since))
    add(claudeAgent, 1, collectFile(claudeAgent, file, state));
  for (const root of [join(paths.codexHome(), "sessions"), join(paths.codexHome(), "archived_sessions")])
    for (const file of walk(root, (name) => name.endsWith(".jsonl"), since))
      add(codexAgent, 1, collectFile(codexAgent, file, state));
  for (const file of walk(
    join(paths.geminiHome(), "tmp"),
    (name) => name.endsWith(".json") && name.startsWith("session-"),
    since,
  ))
    add(geminiAgent, 1, collectFile(geminiAgent, file, state));

  const opencodeFiles = walk(
    join(paths.opencodeData(), "storage", "message"),
    (name) => name.endsWith(".json"),
    since,
  ).filter((file) => {
    try {
      const mtime = statSync(file).mtimeMs;
      if (state.cursors[file]?.size === mtime) return false;
      state.cursors[file] = { offset: 0, size: mtime };
      return true;
    } catch {
      return false;
    }
  });
  if (opencodeFiles.length) {
    const contents = opencodeFiles.map((file) => {
      try {
        return readFileSync(file, "utf8");
      } catch {
        return "";
      }
    });
    add(opencodeAgent, opencodeFiles.length, parseOpencodeMessages(contents, { projectOf: projectName }));
  }
  saveState(state);
  return { samples, heartbeats, totals };
}

export async function sync(options: { days?: number; quiet?: boolean } = {}) {
  const config = loadConfig();
  if (!config.apiKey) throw new Error("Sign in first: npx getstint login");
  const spinner = options.quiet ? null : p.spinner();
  spinner?.start("Reading your agent history");
  const { samples, heartbeats, totals } = scanHistory(options.days);
  queueUsage(samples);
  queueHeartbeats(heartbeats.map((beat) => ({ ...beat, machine: config.machine })));
  spinner?.message(`Sending ${formatCount(samples.length)} usage records`);
  const result = await flush(config);
  if (!spinner) return result;
  spinner.stop(
    result.error
      ? `Saved for later: ${result.error}`
      : `Synced ${formatCount(result.samples)} usage records and ${formatCount(result.sent)} activity events`,
  );
  for (const total of totals.filter((item) => item.samples > 0))
    p.log.info(
      `${pc.bold(total.agent)}  ${pc.dim(`${total.files} files · ${formatCount(total.samples)} records · ${formatCount(total.tokens)} tokens`)}`,
    );
  return result;
}
