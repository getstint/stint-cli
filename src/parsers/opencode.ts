import type { UsageSample } from "../lib/payloads";
import { agentBeat, record, seconds, text, tokens, type ParseContext, type Parsed } from "./common";

export const opencodeAgent = "opencode";

export function opencodeSample(
  raw: unknown,
  context: ParseContext,
): { sample: UsageSample | null; time: number | null; session: string; project: string; model?: string } {
  const message = record(raw);
  const time = record(message.time);
  const path = record(message.path);
  const usage = record(message.tokens);
  const cache = record(usage.cache);
  const session = text(message.sessionID) ?? "opencode";
  const project = context.projectOf(text(path.root) ?? text(path.cwd));
  const finished = seconds(time.completed) ?? seconds(time.created);
  const id = text(message.id);
  const model = text(message.modelID);
  if (message.role !== "assistant" || !id || !finished || !model)
    return { sample: null, time: finished, session, project, model };
  const sample: UsageSample = {
    source_id: `opencode:${id}`,
    time: finished,
    agent: opencodeAgent,
    model,
    project,
    input_tokens: tokens(usage.input),
    output_tokens: tokens(usage.output) + tokens(usage.reasoning),
    cache_read_tokens: tokens(cache.read),
    cache_write_tokens: tokens(cache.write),
  };
  const empty = sample.input_tokens + sample.output_tokens + sample.cache_read_tokens + sample.cache_write_tokens === 0;
  return { sample: empty || !time.completed ? null : sample, time: finished, session, project, model };
}

export function parseOpencodeMessages(contents: string[], context: ParseContext): Parsed {
  const samples: UsageSample[] = [];
  const heartbeats: Parsed["heartbeats"] = [];
  for (const content of contents) {
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      continue;
    }
    const { sample, time, session, project, model } = opencodeSample(raw, context);
    if (sample) samples.push(sample);
    if (time && model) heartbeats.push(agentBeat(opencodeAgent, time, project, session, model));
  }
  return { samples, heartbeats, carry: {} };
}
