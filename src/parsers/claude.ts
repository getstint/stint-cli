import type { UsageSample } from "../lib/payloads";
import { agentBeat, fileBeat, lines, record, seconds, text, tokens, type ParseContext, type Parsed } from "./common";

export const claudeAgent = "claude-code";
const writeTools = /^(write|edit|multiedit|notebookedit)$/i;

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
    const base = agentBeat(claudeAgent, time, project, session, model);
    const cwd = text(line.cwd);
    const files = (Array.isArray(message.content) ? message.content : [])
      .map(record)
      .filter((part) => part.type === "tool_use")
      .map((part) => {
        const input = record(part.input);
        const file = text(input.file_path) ?? text(input.notebook_path) ?? text(input.path);
        return file ? fileBeat(base, context.rootOf?.(cwd), cwd, file, writeTools.test(text(part.name) ?? "")) : null;
      })
      .filter((beat): beat is NonNullable<typeof beat> => beat !== null);
    if (files.length) heartbeats.push(...files);
    else if (!seenBeat.has(beatKey)) heartbeats.push(base);
    seenBeat.add(beatKey);
  }
  return { samples: [...byMessage.values()], heartbeats, carry: {} };
}
