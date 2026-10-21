import type { UsageSample } from "../lib/payloads";
import { agentBeat, record, seconds, text, tokens, type ParseContext, type Parsed } from "./common";

export const geminiAgent = "gemini-cli";

export function parseGeminiChat(content: string, context: ParseContext & { cwd?: string }): Parsed {
  let chat: Record<string, unknown>;
  try {
    chat = record(JSON.parse(content));
  } catch {
    return { samples: [], heartbeats: [], carry: {} };
  }
  const session = text(chat.sessionId) ?? "gemini";
  const project = context.projectOf(context.cwd);
  const samples: UsageSample[] = [];
  const heartbeats: Parsed["heartbeats"] = [];
  for (const raw of Array.isArray(chat.messages) ? chat.messages : []) {
    const message = record(raw);
    if (message.type !== "gemini") continue;
    const id = text(message.id);
    const time = seconds(message.timestamp);
    const usage = record(message.tokens);
    if (!id || !time) continue;
    const model = text(message.model) ?? "gemini";
    const cached = tokens(usage.cached);
    const sample: UsageSample = {
      source_id: `gemini:${session}:${id}`,
      time,
      agent: geminiAgent,
      model,
      project,
      input_tokens: Math.max(0, tokens(usage.input) - cached),
      output_tokens: tokens(usage.output) + tokens(usage.thoughts),
      cache_read_tokens: cached,
      cache_write_tokens: 0,
    };
    if (sample.input_tokens + sample.output_tokens + sample.cache_read_tokens > 0) samples.push(sample);
    heartbeats.push(agentBeat(geminiAgent, time, project, session, model));
  }
  return { samples, heartbeats, carry: {} };
}
