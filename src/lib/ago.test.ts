import { describe, expect, test } from "bun:test";
import { ago } from "./ago";

describe("ago", () => {
  test("rounds to the largest sensible unit", () => {
    const now = 1_000_000_000_000;
    expect(ago(now - 5_000, now)).toBe("just now");
    expect(ago(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(ago(now - 3 * 3_600_000, now)).toBe("3 h ago");
    expect(ago(now - 3 * 86_400_000, now)).toBe("3 days ago");
    expect(ago(now + 60_000, now)).toBe("just now");
  });
});
