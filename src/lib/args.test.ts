import { describe, expect, test } from "bun:test";
import { parseArgs } from "./args";

describe("parseArgs", () => {
  test("commands, positionals and flags", () => {
    expect(parseArgs(["install", "codex", "claude-code", "--yes"])).toEqual({
      command: "install",
      positionals: ["codex", "claude-code"],
      flags: { yes: true },
    });
  });

  test("value flags with = or a following value", () => {
    expect(parseArgs(["login", "--key", "abc", "--api-url=http://localhost:3210"]).flags).toEqual({
      key: "abc",
      "api-url": "http://localhost:3210",
    });
  });

  test("negated flags", () => {
    expect(parseArgs(["login", "--no-browser"]).flags).toEqual({ browser: false });
  });

  test("everything after -- is passed through", () => {
    expect(parseArgs(["run", "grok", "--", "grok", "--model", "x"]).positionals).toEqual([
      "grok",
      "--",
      "grok",
      "--model",
      "x",
    ]);
  });

  test("no command means setup", () => {
    expect(parseArgs([]).command).toBeUndefined();
  });
});
