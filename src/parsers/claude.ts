import type { UsageSample } from "../lib/payloads";
import { agentBeat, lines, record, seconds, text, tokens, type ParseContext, type Parsed } from "./common";

export const claudeAgent = "claude-code";

export function parseClaudeTranscript(content: string, context: ParseContext): Parsed {
  const byMessage = new Map<string, UsageSample>();
  const heartbeats: Parsed["heartbeats"] = [];
  const seenBeat = new Set<string>();
  for (const raw of lines(content)) {
    const line = record(raw);
    if (line.type !== "assistant") continue;
    const message = record(line.message);
    const usage = record(message.usage);
    const id = text(message.id) ?? text(line.requestId) ?? text(line.uuid);
    const model = text(message.model);
    const time = seconds(line.timestamp);
    if (!id || !time || !model || model.startsWith("<")) continue;
    const project = context.projectOf(text(line.cwd));
    const session = text(line.sessionId) ?? "claude";
    const sample: UsageSample = {
      source_id: `claude:${id}`,
      time,
      agent: claudeAgent,
      model,
      project,
      input_tokens: tokens(usage.input_tokens),
      output_tokens: tokens(usage.output_tokens),
      cache_read_tokens: tokens(usage.cache_read_input_tokens),
      cache_write_tokens: tokens(usage.cache_creation_input_tokens),
    };
    const previous = byMessage.get(sample.source_id);
    if (!previous || sample.output_tokens >= previous.output_tokens)
      byMessage.set(sample.source_id, previous ? { ...sample, time: previous.time } : sample);
    const beatKey = `${session}|${Math.floor(time)}`;
    if (!seenBeat.has(beatKey)) {
      seenBeat.add(beatKey);
      heartbeats.push(agentBeat(claudeAgent, time, project, session, model));
    }
  }
  return { samples: [...byMessage.values()], heartbeats, carry: {} };
}
