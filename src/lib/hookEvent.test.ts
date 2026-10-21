import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { heartbeatFromHook, isTurnEnd } from "./hookEvent";
import { Category } from "./payloads";

const root = join("/work", "stint");
const project = { root, name: "stint", branch: "main" };

describe("heartbeatFromHook", () => {
  test("file edits become write heartbeats with a project-relative path", () => {
    const beat = heartbeatFromHook(
      "claude-code",
      {
        hook_event_name: "PostToolUse",
        session_id: "s1",
        cwd: root,
        tool_name: "Edit",
        tool_input: { file_path: join(root, "src", "app.ts") },
      },
      100,
      project,
    );
    expect(beat).toEqual({
      entity: "*.ts",
      type: "file",
      is_write: true,
      category: Category.AiCoding,
      time: 100,
      project: "stint",
      branch: "main",
      agent: "claude-code",
      ai_session: "s1",
      ai_model: undefined,
    });
  });

  test("reads are not writes", () => {
    const beat = heartbeatFromHook(
      "codex",
      { tool_name: "Read", tool_input: { file_path: "src/a.go" }, cwd: root },
      1,
      project,
    );
    expect(beat).toMatchObject({ entity: "*.go", type: "file", is_write: false });
  });

  test("files outside the project never leak their path", () => {
    const beat = heartbeatFromHook(
      "claude-code",
      { session_id: "s1", tool_name: "Read", tool_input: { file_path: join("/home", "me", ".ssh", "config") } },
      1,
      project,
    );
    expect(beat.entity).toBe("claude-code:s1");
    expect(beat.type).toBe("app");
  });

  test("events without a file are app heartbeats for the session", () => {
    expect(
      heartbeatFromHook(
        "gemini-cli",
        { hook_event_name: "BeforeAgent", session_id: "g", model: "gemini-3.1-pro" },
        5,
        null,
      ),
    ).toEqual({
      entity: "gemini-cli:g",
      type: "app",
      category: Category.AiCoding,
      time: 5,
      project: undefined,
      branch: undefined,
      agent: "gemini-cli",
      ai_session: "g",
      ai_model: "gemini-3.1-pro",
    });
  });
});

describe("isTurnEnd", () => {
  test("knows each agent's end-of-turn event", () => {
    for (const event of ["Stop", "SessionEnd", "AfterAgent", "session.idle", "agent-turn-complete"])
      expect(isTurnEnd(event)).toBe(true);
    for (const event of ["PostToolUse", "UserPromptSubmit", undefined]) expect(isTurnEnd(event)).toBe(false);
  });
});
