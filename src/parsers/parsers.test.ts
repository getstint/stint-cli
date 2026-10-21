import { describe, expect, test } from "bun:test";
import { parseClaudeTranscript } from "./claude";
import { parseCodexSession } from "./codex";
import { parseGeminiChat } from "./gemini";
import { parseOpencodeMessages } from "./opencode";

const context = { projectOf: (cwd: string | undefined) => (cwd ? (cwd.split(/[\\/]/).pop() ?? "") : "") };
const jsonl = (...items: unknown[]) => items.map((item) => JSON.stringify(item)).join("\n") + "\n";

describe("Claude Code transcripts", () => {
  const assistant = (id: string, output: number, timestamp: string, model = "claude-opus-5-5") => ({
    type: "assistant",
    timestamp,
    sessionId: "s1",
    cwd: "D:\\Projects\\stint",
    requestId: `req_${id}`,
    message: {
      id,
      model,
      usage: {
        input_tokens: 2,
        output_tokens: output,
        cache_read_input_tokens: 28871,
        cache_creation_input_tokens: 11309,
      },
    },
  });

  test("one sample per message, keeping the final output count", () => {
    const parsed = parseClaudeTranscript(
      jsonl(
        assistant("msg_1", 100, "2026-10-20T23:50:58.858Z"),
        assistant("msg_1", 349, "2026-10-20T23:50:59.060Z"),
        assistant("msg_2", 10, "2026-10-20T23:52:00.000Z"),
        { type: "user", message: {} },
      ),
      context,
    );
    expect(parsed.samples).toHaveLength(2);
    expect(parsed.samples[0]).toEqual({
      source_id: "claude:msg_1",
      time: Date.parse("2026-10-20T23:50:58.858Z") / 1000,
      agent: "claude-code",
      model: "claude-opus-5-5",
      project: "stint",
      input_tokens: 2,
      output_tokens: 349,
      cache_read_tokens: 28871,
      cache_write_tokens: 11309,
    });
  });

  test("skips synthetic messages and broken lines", () => {
    const parsed = parseClaudeTranscript(
      jsonl(assistant("msg_x", 5, "2026-10-20T23:50:58Z", "<synthetic>")) + "{not json\n",
      context,
    );
    expect(parsed.samples).toHaveLength(0);
  });

  test("emits agent heartbeats at message times", () => {
    const parsed = parseClaudeTranscript(
      jsonl(assistant("a", 1, "2026-10-20T10:00:00Z"), assistant("b", 1, "2026-10-20T10:03:00Z")),
      context,
    );
    expect(parsed.heartbeats.map((beat) => beat.agent)).toEqual(["claude-code", "claude-code"]);
    expect(parsed.heartbeats[0]).toMatchObject({
      category: "ai coding",
      type: "app",
      project: "stint",
      ai_session: "s1",
    });
  });
});

describe("Codex sessions", () => {
  const meta = {
    timestamp: "2026-09-27T16:19:43.308Z",
    type: "session_meta",
    payload: { id: "thread-1", cwd: "D:\\Projects\\clipthat" },
  };
  const turn = (id: string, model: string) => ({
    timestamp: "2026-09-27T16:19:50Z",
    type: "turn_context",
    payload: { turn_id: id, model, cwd: "D:\\Projects\\clipthat" },
  });
  const usage = {
    input_tokens: 14826,
    cached_input_tokens: 4864,
    cache_write_input_tokens: 0,
    output_tokens: 140,
    reasoning_output_tokens: 77,
    total_tokens: 14966,
  };
  const recordLine = (response: string, turnId: string) => ({
    timestamp: "2026-09-27T16:19:57Z",
    type: "token_usage_record",
    payload: { turn_id: turnId, response_id: response, usage },
  });
  const count = (total: number) => ({
    timestamp: "2026-09-27T16:19:58Z",
    type: "event_msg",
    payload: {
      type: "token_count",
      info: { total_token_usage: { ...usage, total_tokens: total }, last_token_usage: usage },
    },
  });

  test("prefers per-response usage records and subtracts cached input", () => {
    const parsed = parseCodexSession(
      jsonl(meta, turn("t1", "gpt-6-luna"), recordLine("resp_1", "t1"), count(14966)),
      context,
    );
    expect(parsed.samples).toEqual([
      {
        source_id: "codex:resp_1",
        time: Date.parse("2026-09-27T16:19:57Z") / 1000,
        agent: "codex",
        model: "gpt-6-luna",
        project: "clipthat",
        input_tokens: 9962,
        output_tokens: 140,
        cache_read_tokens: 4864,
        cache_write_tokens: 0,
      },
    ]);
  });

  test("falls back to token_count events and ignores repeats", () => {
    const parsed = parseCodexSession(
      jsonl(meta, turn("t1", "gpt-5.5"), count(14966), count(14966), count(29932)),
      context,
    );
    expect(parsed.samples.map((sample) => sample.source_id)).toEqual(["codex:thread-1:14966", "codex:thread-1:29932"]);
    expect(parsed.samples[0].model).toBe("gpt-5.5");
  });

  test("carries the session and model across incremental reads", () => {
    const first = parseCodexSession(jsonl(meta, turn("t1", "gpt-5.5")), context);
    const second = parseCodexSession(jsonl(count(100)), { ...context, carry: first.carry });
    expect(second.samples[0]).toMatchObject({ source_id: "codex:thread-1:100", model: "gpt-5.5", project: "clipthat" });
  });
});

describe("Gemini CLI chats", () => {
  test("reads gemini messages with cached and thought tokens", () => {
    const chat = {
      sessionId: "g1",
      messages: [
        { id: "u1", type: "user", timestamp: "2026-10-01T10:00:00Z" },
        {
          id: "m1",
          type: "gemini",
          timestamp: "2026-10-01T10:00:05Z",
          model: "gemini-3.1-pro",
          tokens: { input: 1200, output: 300, cached: 1000, thoughts: 50, tool: 0, total: 1550 },
        },
      ],
    };
    const parsed = parseGeminiChat(JSON.stringify(chat), { ...context, cwd: "/home/dev/app" });
    expect(parsed.samples).toEqual([
      {
        source_id: "gemini:g1:m1",
        time: Date.parse("2026-10-01T10:00:05Z") / 1000,
        agent: "gemini-cli",
        model: "gemini-3.1-pro",
        project: "app",
        input_tokens: 200,
        output_tokens: 350,
        cache_read_tokens: 1000,
        cache_write_tokens: 0,
      },
    ]);
  });

  test("survives a half-written file", () => {
    expect(parseGeminiChat('{"sessionId":"g1","messages":[', context).samples).toEqual([]);
  });
});

describe("OpenCode messages", () => {
  test("counts completed assistant messages only", () => {
    const done = {
      id: "msg_1",
      sessionID: "ses_1",
      role: "assistant",
      modelID: "claude-sonnet-5-5",
      time: { created: 1790000000000, completed: 1790000004000 },
      path: { cwd: "/w/site", root: "/w/site" },
      tokens: { input: 10, output: 20, reasoning: 5, cache: { read: 300, write: 40 } },
    };
    const streaming = { ...done, id: "msg_2", time: { created: 1790000005000 } };
    const user = { id: "msg_3", sessionID: "ses_1", role: "user", time: { created: 1790000006000 } };
    const parsed = parseOpencodeMessages(
      [JSON.stringify(done), JSON.stringify(streaming), JSON.stringify(user), "{bad"],
      context,
    );
    expect(parsed.samples).toEqual([
      {
        source_id: "opencode:msg_1",
        time: 1790000004,
        agent: "opencode",
        model: "claude-sonnet-5-5",
        project: "site",
        input_tokens: 10,
        output_tokens: 25,
        cache_read_tokens: 300,
        cache_write_tokens: 40,
      },
    ]);
  });
});
