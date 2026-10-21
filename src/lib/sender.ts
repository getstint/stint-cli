import { api, ApiError } from "./api";
import type { Config } from "./config";
import type { Heartbeat, UsageSample } from "./payloads";
import { paths } from "./paths";
import { claim, enqueue } from "./queue";
import { loadState, saveState } from "./state";

const heartbeatChunk = 200;
const usageChunk = 500;

export type FlushResult = { sent: number; samples: number; queued: boolean; error?: string };

const keepsQueue = (error: unknown) =>
  error instanceof ApiError &&
  (error.status === 0 || error.status === 401 || error.status === 429 || error.status >= 500);

async function drain<T>(
  path: string,
  size: number,
  send: (items: T[]) => Promise<unknown>,
): Promise<{ sent: number; error?: unknown }> {
  const claimed = claim<T>(path);
  if (!claimed) return { sent: 0 };
  let sent = 0;
  for (let index = 0; index < claimed.items.length; index += size) {
    const chunk = claimed.items.slice(index, index + size);
    try {
      await send(chunk);
      sent += chunk.length;
    } catch (error) {
      if (keepsQueue(error)) {
        claimed.release(claimed.items.slice(index));
        return { sent, error };
      }
    }
  }
  claimed.done();
  return { sent };
}

export function queueHeartbeats(heartbeats: Heartbeat[]) {
  enqueue(paths.queue(), heartbeats);
}

export function queueUsage(samples: UsageSample[]) {
  enqueue(paths.usageQueue(), samples);
}

export async function flush(config: Config, agent?: string): Promise<FlushResult> {
  const state = loadState();
  if (!config.apiKey) return { sent: 0, samples: 0, queued: true, error: "Not signed in. Run `npx getstint login`." };
  const beats = await drain<Heartbeat>(paths.queue(), heartbeatChunk, (items) => api.heartbeats(config, items, agent));
  const usage = beats.error
    ? { sent: 0, error: beats.error }
    : await drain<UsageSample>(paths.usageQueue(), usageChunk, (items) => api.usage(config, items));
  const error = beats.error ?? usage.error;
  const message = error instanceof Error ? error.message : undefined;
  saveState({
    ...state,
    lastFlush: error ? state.lastFlush : Date.now(),
    lastError: message ? { at: Date.now(), message } : undefined,
    authFailed: error instanceof ApiError && error.status === 401,
  });
  return { sent: beats.sent, samples: usage.sent, queued: Boolean(error), error: message };
}
