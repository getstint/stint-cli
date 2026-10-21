import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claim, enqueue, queuedCount } from "./queue";

describe("queue", () => {
  test("a large backlog is handed over in full, not truncated", () => {
    const file = join(mkdtempSync(join(tmpdir(), "stint-queue-")), "queue.jsonl");
    enqueue(
      file,
      Array.from({ length: 45_000 }, (_, index) => ({ index })),
    );
    const claimed = claim<{ index: number }>(file);
    expect(claimed?.items).toHaveLength(45_000);
    expect(claimed?.items[0].index).toBe(0);
    claimed?.done();
    expect(queuedCount(file)).toBe(0);
  });

  test("unsent items go back into the queue", () => {
    const file = join(mkdtempSync(join(tmpdir(), "stint-queue-")), "queue.jsonl");
    enqueue(file, [{ a: 1 }, { a: 2 }, { a: 3 }]);
    const claimed = claim<{ a: number }>(file);
    claimed?.release(claimed.items.slice(1));
    expect(queuedCount(file)).toBe(2);
  });
});
