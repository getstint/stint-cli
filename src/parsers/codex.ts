import type { UsageSample } from "../lib/payloads";
import { agentBeat, fileBeat, lines, record, seconds, text, tokens, type ParseContext, type Parsed } from "./common";

export const codexAgent = "codex";
const patchFile = /\*\*\* (Add|Update|Delete) File: ([^\n\\"]+)/g;

function sampleFrom(
  usage: Record<string, unknown>,
  base: Omit<UsageSample, "input_tokens" | "output_tokens" | "cache_read_tokens" | "cache_write_tokens">,
): UsageSample {
  const cached = tokens(usage.cached_input_tokens);
  return {
    ...base,
    input_tokens: Math.max(0, tokens(usage.input_tokens) - cached),
    output_tokens: tokens(usage.output_tokens),
    cache_read_tokens: cached,
    cache_write_tokens: tokens(usage.cache_write_input_tokens),
  };
}

export function parseCodexSession(content: string, context: ParseContext): Parsed {
  const carry = { ...(context.carry ?? {}) };
  const turnModels = new Map<string, string>();
  const records: UsageSample[] = [];
  const counts: UsageSample[] = [];
  const heartbeats: Parsed["heartbeats"] = [];
  for (const raw of lines(content)) {
    const line = record(raw);
    const payload = record(line.payload);
    const time = seconds(line.timestamp);
    if (line.type === "session_meta") {
      carry.session = text(payload.id) ?? carry.session ?? "";
      carry.cwd = text(payload.cwd) ?? carry.cwd ?? "";
      if (record(payload.source).subagent) carry.subagent = "1";
      continue;
    }
    if (line.type === "turn_context") {
      const model = text(payload.model);
      if (model) {
        carry.model = model;
        const turn = text(payload.turn_id);
        if (turn) turnModels.set(turn, model);
      }
      carry.cwd = text(payload.cwd) ?? carry.cwd ?? "";
      continue;
    }
    if (!time) continue;
    const project = context.projectOf(carry.cwd || undefined);
    const session = carry.session || "codex";
    if (line.type === "token_usage_record") {
      const response = text(payload.response_id);
      if (!response) continue;
      carry.records = "1";
      const model = turnModels.get(text(payload.turn_id) ?? "") ?? carry.model ?? "unknown";
      records.push(
        sampleFrom(record(payload.usage), { source_id: `codex:${response}`, time, agent: codexAgent, model, project }),
      );
      heartbeats.push(agentBeat(codexAgent, time, project, session, model));
      continue;
    }
    if (line.type === "response_item" && (payload.type === "function_call" || payload.type === "custom_tool_call")) {
      const body = text(payload.arguments) ?? text(payload.input) ?? "";
      const base = agentBeat(codexAgent, time, project, session, carry.model);
      const root = context.rootOf?.(carry.cwd || undefined);
      for (const match of body.matchAll(patchFile)) {
        const beat = fileBeat(base, root, carry.cwd || undefined, match[2].trim(), match[1] !== "Delete");
        if (beat) heartbeats.push(beat);
      }
      continue;
    }
    if (line.type === "event_msg" && payload.type === "token_count") {
      const info = record(payload.info);
      const total = record(info.total_token_usage);
      const last = record(info.last_token_usage);
      const cumulative = tokens(total.total_tokens);
      if (!cumulative || !Object.keys(last).length || carry.lastTotal === String(cumulative)) continue;
      carry.lastTotal = String(cumulative);
      counts.push(
        sampleFrom(last, {
          source_id: `codex:${session}:${cumulative}`,
          time,
          agent: codexAgent,
          model: carry.model ?? "unknown",
          project,
        }),
      );
      if (carry.records !== "1") heartbeats.push(agentBeat(codexAgent, time, project, session, carry.model));
    }
  }
  const samples = carry.records === "1" ? records : counts;
  return {
    samples: samples.filter((sample) => sample.input_tokens + sample.output_tokens + sample.cache_read_tokens > 0),
    heartbeats,
    carry,
  };
}
