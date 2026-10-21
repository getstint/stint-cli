export function opencodePluginSource(node: string, bin: string): string {
  return `import { spawn } from "node:child_process";

const NODE = ${JSON.stringify(node)};
const BIN = ${JSON.stringify(bin)};
const STINT_PLUGIN = "getstint";
const WATCHED = new Set(["session.created", "session.idle", "session.deleted", "message.updated", "file.edited"]);

function send(payload) {
  try {
    const child = spawn(NODE, [BIN, "hook", "opencode"], { stdio: ["pipe", "ignore", "ignore"], detached: true, windowsHide: true });
    child.on("error", () => {});
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(payload));
    child.unref();
  } catch {}
}

export const StintPlugin = async ({ directory, worktree }) => {
  const cwd = worktree || directory;
  return {
    event: async ({ event }) => {
      if (!event || !WATCHED.has(event.type)) return;
      const props = event.properties || {};
      const info = props.info || {};
      if (event.type === "message.updated" && (info.role !== "assistant" || !info.time || !info.time.completed)) return;
      send({ source: STINT_PLUGIN, hook_event_name: event.type, cwd, session_id: info.sessionID || props.sessionID || info.id || "", file_path: props.file, message: event.type === "message.updated" ? info : undefined });
    },
    "tool.execute.after": async (input, output) => {
      const args = (output && output.metadata && output.metadata.args) || (input && input.args) || {};
      send({ source: STINT_PLUGIN, hook_event_name: "tool.execute.after", cwd, session_id: (input && input.sessionID) || "", tool_name: input && input.tool, file_path: args.filePath || args.path });
    },
  };
};
`;
}
