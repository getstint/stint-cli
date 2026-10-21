import { describe, expect, test } from "bun:test";
import { addHooks, hasHooks, removeHooks, type HookSettings } from "./hookConfig";

const command = 'node "C:/Users/dev/.stint/bin/stint.mjs" hook claude-code';
const specs = [
  { event: "Stop", handler: { type: "command" as const, command, async: true } },
  { event: "PostToolUse", matcher: "*", handler: { type: "command" as const, command, async: true } },
];

describe("hook settings", () => {
  const existing: HookSettings = {
    model: "opus",
    hooks: {
      Stop: [{ hooks: [{ type: "command", command: "say done" }] }],
      PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "guard.sh" }] }],
    },
  };

  test("adds ours next to the user's own hooks and keeps other settings", () => {
    const next = addHooks(existing, "claude-code", specs);
    expect(next.model).toBe("opus");
    expect(next.hooks?.Stop).toHaveLength(2);
    expect(next.hooks?.Stop?.[0].hooks[0].command).toBe("say done");
    expect(next.hooks?.PreToolUse).toEqual(existing.hooks?.PreToolUse);
    expect(next.hooks?.PostToolUse?.[0]).toEqual({ matcher: "*", hooks: [{ type: "command", command, async: true }] });
    expect(hasHooks(next, "claude-code")).toBe(true);
  });

  test("installing twice changes nothing", () => {
    const once = addHooks(existing, "claude-code", specs);
    expect(addHooks(once, "claude-code", specs)).toEqual(once);
  });

  test("removing takes only ours and drops empty events", () => {
    const removed = removeHooks(addHooks(existing, "claude-code", specs), "claude-code");
    expect(removed).toEqual(existing);
    expect(hasHooks(removed, "claude-code")).toBe(false);
  });

  test("never touches another agent's stint hooks", () => {
    const both = addHooks(
      addHooks({}, "codex", [{ event: "Stop", handler: { type: "command", command: "node stint.mjs hook codex" } }]),
      "claude-code",
      specs,
    );
    const removed = removeHooks(both, "claude-code");
    expect(hasHooks(removed, "codex")).toBe(true);
    expect(hasHooks(removed, "claude-code")).toBe(false);
  });

  test("works from an empty file", () => {
    expect(hasHooks(null, "claude-code")).toBe(false);
    expect(Object.keys(addHooks({}, "claude-code", specs).hooks ?? {})).toEqual(["Stop", "PostToolUse"]);
  });
});
