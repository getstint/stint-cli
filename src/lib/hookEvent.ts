import { isAbsolute, relative, resolve } from "node:path";
import { Category, type Heartbeat } from "./payloads";
import type { ProjectInfo } from "./project";

export type HookPayload = {
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  transcript_path?: string | null;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  file_path?: string;
  model?: string;
  message?: unknown;
  workspace_roots?: string[];
};

const writeTools =
  /^(write|edit|multiedit|notebookedit|apply_patch|write_file|replace|edit_file|create_file|str_replace|patch)$/i;

const turnEnds = new Set([
  "stop",
  "subagentstop",
  "sessionend",
  "afteragent",
  "session.idle",
  "session.deleted",
  "agent-turn-complete",
]);

export const isTurnEnd = (event: string | undefined) => turnEnds.has((event ?? "").toLowerCase());

function filePathOf(payload: HookPayload): string | undefined {
  const input = payload.tool_input ?? {};
  const candidate =
    payload.file_path ?? input.file_path ?? input.filePath ?? input.path ?? input.notebook_path ?? input.absolute_path;
  return typeof candidate === "string" && candidate.length < 1000 ? candidate : undefined;
}

export function heartbeatFromHook(
  agent: string,
  payload: HookPayload,
  now: number,
  project: ProjectInfo | null,
): Heartbeat {
  const session = (payload.session_id || "session").slice(0, 120);
  const base = {
    category: Category.AiCoding,
    time: now,
    project: project?.name,
    branch: project?.branch,
    agent,
    ai_session: session,
    ai_model: payload.model,
  };
  const file = filePathOf(payload);
  if (file && project) {
    const absolute = isAbsolute(file) ? file : resolve(payload.cwd ?? project.root, file);
    const inside = relative(project.root, absolute);
    if (inside && !inside.startsWith("..") && !isAbsolute(inside)) {
      return {
        ...base,
        entity: inside.replace(/\\/g, "/"),
        type: "file",
        is_write: writeTools.test(payload.tool_name ?? "") || payload.hook_event_name === "file.edited",
      };
    }
  }
  return { ...base, entity: `${agent}:${session}`, type: "app" };
}
