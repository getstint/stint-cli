import type { Config } from "./config";
import type { Heartbeat, UsageSample } from "./payloads";
import { userAgent } from "./version";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; token?: string; timeoutMs?: number; agent?: string };

export const deviceClientId = "stint-cli";
const defaultTimeoutMs = 10_000;

export async function request<T>(
  config: Pick<Config, "apiUrl" | "apiKey">,
  path: string,
  options: Options = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json", "user-agent": options.agent ?? userAgent() };
  const token = options.token ?? config.apiKey;
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs ?? defaultTimeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "couldn't connect";
    throw new ApiError(`Stint ${reason} (${config.apiUrl}).`, 0, "network");
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  if (!response.ok) {
    const record = (body ?? {}) as { error?: string; error_description?: string; message?: string };
    const code = typeof record.error === "string" && /^[a-z_]+$/.test(record.error) ? record.error : undefined;
    throw new ApiError(
      record.error_description ?? record.message ?? record.error ?? `Stint answered ${response.status}.`,
      response.status,
      code,
    );
  }
  return body as T;
}

export type DeviceCode = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
};

export type Me = { id: string; name: string; email: string; username: string; timezone: string };

export type Today = { data: { grand_total: { total_seconds: number; text: string } } };

export const api = {
  deviceCode: (config: Pick<Config, "apiUrl">, clientId = deviceClientId) =>
    request<DeviceCode>({ apiUrl: config.apiUrl }, "/api/auth/device/code", {
      body: { client_id: clientId, scope: "heartbeats usage" },
    }),
  deviceToken: (config: Pick<Config, "apiUrl">, deviceCode: string, clientId = deviceClientId) =>
    request<{ access_token: string }>({ apiUrl: config.apiUrl }, "/api/auth/device/token", {
      body: {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
        client_id: clientId,
      },
    }),
  mintKey: (config: Pick<Config, "apiUrl">, sessionToken: string, name: string) =>
    request<{ key: string; id: string }>({ apiUrl: config.apiUrl }, "/api/v1/me/api-keys", {
      token: sessionToken,
      body: { name },
    }),
  signOutSession: (config: Pick<Config, "apiUrl">, sessionToken: string) =>
    request<unknown>({ apiUrl: config.apiUrl }, "/api/auth/sign-out", { token: sessionToken, body: {} }).catch(
      () => undefined,
    ),
  me: (config: Config) => request<Me>(config, "/api/v1/me"),
  today: (config: Config) => request<Today>(config, "/api/compat/wakatime/v1/users/current/statusbar/today"),
  activityToday: (config: Config) =>
    request<{ days: { seconds: number; agents: Record<string, number> }[] }>(config, "/api/v1/me/activity?days=1").then(
      (body) => body.days[body.days.length - 1] ?? { seconds: 0, agents: {} },
    ),
  heartbeats: (config: Config, heartbeats: Heartbeat[], agent?: string) =>
    request<{ responses: [unknown, number][] }>(config, "/api/v1/heartbeats", {
      body: heartbeats,
      agent,
      timeoutMs: 60_000,
    }),
  usage: (config: Config, samples: UsageSample[]) =>
    request<{ inserted: number; duplicates: number }>(config, "/api/v1/usage", {
      body: { samples },
      timeoutMs: 60_000,
    }),
};
