import { readFileSync, statSync } from "node:fs";
import { claudeAgent, parseClaudeTranscript } from "../parsers/claude";
import { codexAgent, parseCodexSession } from "../parsers/codex";
import type { Parsed } from "../parsers/common";
import { geminiAgent, parseGeminiChat } from "../parsers/gemini";
import { projectFor } from "./project";
import type { State } from "./state";
import { readNewLines } from "./tail";

const projects = new Map<string, string>();

export function projectName(cwd: string | undefined): string {
  if (!cwd) return "";
  if (!projects.has(cwd)) projects.set(cwd, projectFor(cwd)?.name ?? "");
  return projects.get(cwd)!;
}

const empty: Parsed = { samples: [], heartbeats: [], carry: {} };

export function collectFile(agent: string, file: string, state: State, cwd?: string): Parsed {
  if (agent === geminiAgent) {
    let size = 0;
    try {
      size = statSync(file).size;
    } catch {
      return empty;
    }
    if (state.cursors[file]?.size === size) return empty;
    state.cursors[file] = { offset: size, size };
    try {
      return parseGeminiChat(readFileSync(file, "utf8"), { projectOf: projectName, cwd });
    } catch {
      return empty;
    }
  }
  const parse = agent === claudeAgent ? parseClaudeTranscript : agent === codexAgent ? parseCodexSession : null;
  if (!parse) return empty;
  const read = readNewLines(file, state.cursors[file]);
  if (!read || !read.content) {
    if (read) state.cursors[file] = read.cursor;
    return empty;
  }
  const parsed = parse(read.content, { projectOf: projectName, carry: read.cursor.carry });
  state.cursors[file] = { ...read.cursor, carry: Object.keys(parsed.carry).length ? parsed.carry : undefined };
  return parsed;
}
