import { closeSync, openSync, readSync, statSync } from "node:fs";
import type { Cursor } from "./state";

const maxChunk = 32 * 1024 * 1024;

export function readNewLines(path: string, cursor: Cursor | undefined): { content: string; cursor: Cursor } | null {
  let size: number;
  try {
    size = statSync(path).size;
  } catch {
    return null;
  }
  const start = cursor && cursor.offset <= size ? cursor.offset : 0;
  const carry = cursor && cursor.offset <= size ? cursor.carry : undefined;
  if (start === size) return { content: "", cursor: { offset: start, size, carry } };
  const length = Math.min(size - start, maxChunk);
  const buffer = Buffer.alloc(length);
  const fd = openSync(path, "r");
  try {
    readSync(fd, buffer, 0, length, start);
  } finally {
    closeSync(fd);
  }
  const lastNewline = buffer.lastIndexOf(0x0a);
  if (lastNewline === -1) return { content: "", cursor: { offset: start, size, carry } };
  const content = buffer.subarray(0, lastNewline + 1).toString("utf8");
  return { content, cursor: { offset: start + lastNewline + 1, size, carry } };
}
