import { readJsonFile, writeJsonFile } from "./files";
import { paths } from "./paths";

export type Cursor = { offset: number; size: number; carry?: Record<string, string> };

export type State = {
  cursors: Record<string, Cursor>;
  lastFlush?: number;
  lastSync?: number;
  lastError?: { at: number; message: string };
  authFailed?: boolean;
};

export function loadState(): State {
  const stored = readJsonFile<Partial<State>>(paths.state()) ?? {};
  return {
    cursors: stored.cursors && typeof stored.cursors === "object" ? stored.cursors : {},
    lastFlush: stored.lastFlush,
    lastSync: stored.lastSync,
    lastError: stored.lastError,
    authFailed: stored.authFailed,
  };
}

export function saveState(state: State) {
  const entries = Object.entries(state.cursors);
  const trimmed = entries.length > 2000 ? Object.fromEntries(entries.slice(-2000)) : state.cursors;
  writeJsonFile(paths.state(), { ...state, cursors: trimmed });
}
