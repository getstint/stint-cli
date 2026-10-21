# Stint API for integrations

Everything an editor extension, agent hook or CLI needs. All paths are relative to the server origin (`https://getstint.dev` by default). Requests and responses are JSON.

## Authentication

| Method                  | Header                                 | Used by                                   |
| ----------------------- | -------------------------------------- | ----------------------------------------- |
| API key                 | `Authorization: Bearer <key>`          | The CLI and the editor extensions         |
| API key, WakaTime style | `Authorization: Basic base64(<key>)`   | Stock WakaTime plugins and `wakatime-cli` |
| API key, other          | `X-API-Key: <key>` or `?api_key=<key>` | Scripts                                   |

Keys are UUID v4 strings (`3f2b8c1e-9a4d-4e7f-b1c2-5d6e7f8a9b0c`), the format `wakatime-cli` requires. A `waka_` prefix is accepted and ignored. Create and revoke keys in **Settings › API key**, or get one through the device flow below.

## Signing in a device

Stint implements the OAuth 2.0 device authorization grant ([RFC 8628](https://www.rfc-editor.org/rfc/rfc8628)).

**1. Ask for a code**

```http
POST /api/auth/device/code
{ "client_id": "stint-cli", "scope": "heartbeats usage" }
```

```json
{
  "device_code": "ytAyUa1t3VQcshnsApXpccyVUWXuy9OiM0zNdhlp",
  "user_code": "V3C7M9KF",
  "verification_uri": "https://getstint.dev/device",
  "verification_uri_complete": "https://getstint.dev/device?user_code=V3C7M9KF",
  "expires_in": 900,
  "interval": 5
}
```

Known client ids: `stint-cli`, `stint-vscode`, `stint-jetbrains`, `stint-neovim`, `stint-zed`, `stint-agents`. Others get `invalid_client`. Add `&client=<client_id>` to the verification link so the approval page names your app.

**2. Show the code and link**, open the browser when there is one, and poll:

```http
POST /api/auth/device/token
{ "grant_type": "urn:ietf:params:oauth:grant-type:device_code", "device_code": "…", "client_id": "stint-cli" }
```

| Response                                   | Meaning                                      |
| ------------------------------------------ | -------------------------------------------- |
| `200 { "access_token": "…" }`              | Approved. The token is a short-lived session |
| `400 { "error": "authorization_pending" }` | Keep polling every `interval` seconds        |
| `400 { "error": "slow_down" }`             | Add 5 seconds to the interval                |
| `400 { "error": "access_denied" }`         | The user pressed Deny                        |
| `400 { "error": "expired_token" }`         | Start again                                  |

**3. Exchange the session for a long-lived key**, then end the session:

```http
POST /api/v1/me/api-keys
Authorization: Bearer <access_token>
{ "name": "adams-macbook · CLI" }
```

```json
{ "id": "key_…", "key": "3f2b8c1e-9a4d-4e7f-b1c2-5d6e7f8a9b0c", "name": "adams-macbook · CLI", "lastFour": "9b0c" }
```

```http
POST /api/auth/sign-out
Authorization: Bearer <access_token>
```

## Sending activity

### `POST /api/v1/heartbeats`

One heartbeat or an array of up to 1000. Same shape as WakaTime, plus Stint's agent fields.

```json
[
  {
    "entity": "src/server.ts",
    "type": "file",
    "category": "coding",
    "time": 1792548129.4,
    "project": "acme-api",
    "branch": "main",
    "language": "TypeScript",
    "is_write": true,
    "editor": "cursor",
    "machine": "adams-macbook"
  },
  {
    "entity": "claude-code:016f0906",
    "type": "app",
    "category": "ai coding",
    "time": 1792548131.0,
    "project": "acme-api",
    "agent": "claude-code",
    "ai_session": "016f0906",
    "ai_model": "claude-opus-5-5"
  }
]
```

| Field                                                           | Notes                                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `entity`                                                        | A file path (send it relative to the project root) or an app label. Stint stores only a hash of it for de-duplication                |
| `type`                                                          | `file`, `app` or `domain`                                                                                                            |
| `category`                                                      | `coding`, `debugging`, `building`, `ai coding`, … Anything containing `ai` is agent time and never counts toward the user's own time |
| `time`                                                          | Unix seconds, fractions allowed                                                                                                      |
| `language`                                                      | Optional. Inferred from the file extension when missing                                                                              |
| `editor`                                                        | Optional. Inferred from the `User-Agent` (`vscode/1.105.0 vscode-wakatime/25.3.0`) when missing                                      |
| `agent`                                                         | Required for agent time: `claude-code`, `codex`, `gemini-cli`, `opencode`, `grok-cli`, `copilot-cli`, …                              |
| `ai_input_tokens`, `ai_output_tokens`, `ai_cached_input_tokens` | Optional token counts carried on a heartbeat, as `wakatime-cli` sends them                                                           |

Response `202`:

```json
{
  "responses": [
    [{ "id": "…" }, 201],
    [{ "error": "Invalid time." }, 400]
  ]
}
```

Durations come from the gaps between heartbeats, up to 15 minutes, credited to the earlier one. Send a heartbeat when the file changes, on every save, and at least every two minutes while the user keeps working in the same file.

### `POST /api/v1/usage`

Token usage. Up to 5000 samples per request.

```json
{
  "samples": [
    {
      "source_id": "claude:msg_011CgEPNSG5X7Pdm2Wegfpiy",
      "time": 1792548129.4,
      "agent": "claude-code",
      "model": "claude-opus-5-5",
      "project": "acme-api",
      "input_tokens": 2,
      "output_tokens": 349,
      "cache_read_tokens": 28871,
      "cache_write_tokens": 11309
    }
  ]
}
```

`source_id` must be unique per billed request: use the provider's message or response id. Resending a sample is safe. Response `202 { "inserted": 1, "duplicates": 0, "errors": [] }`.

`input_tokens` excludes cached reads, so Codex and Gemini counts (which include them) need the cached part subtracted.

## Reading

| Route                                                       | Returns                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET /api/v1/me`                                            | `{ id, name, email, username, timezone, workDays, … }`                                           |
| `GET /api/v1/me/activity?days=7`                            | Per day: total seconds, and seconds by project, language, editor and agent, plus an hourly curve |
| `GET /api/v1/me/usage?days=7`                               | Per day: tokens by agent and model                                                               |
| `GET /api/v1/me/goals?progress=1`                           | Goals with their progress and status                                                             |
| `GET /api/v1/pricing`                                       | Current price per million tokens for every known model                                           |
| `GET /api/compat/wakatime/v1/users/current/statusbar/today` | Today's total in WakaTime's status-bar format, for editor status bars                            |
| `GET /api/health`                                           | `{ ok: true }`                                                                                   |

## WakaTime compatibility

Point any WakaTime plugin at Stint by setting this in `~/.wakatime.cfg`:

```ini
[settings]
api_url = https://getstint.dev/api/compat/wakatime/v1
api_key = <your Stint key>
```

`npx getstint install wakatime` does this for you and keeps a backup. Supported endpoints under `/api/compat/wakatime/v1`: `users/current`, `users/current/heartbeats`, `users/current/heartbeats.bulk`, `users/current/statusbar/today`, `users/current/summaries` and `users/current/file_experts`.

## Errors and limits

Errors are `{ "error": "Human readable message." }` with a matching status. `401` means the key is wrong or revoked, `413` means the body is over 2 MB, and `429` means slow down. Clients should queue on network errors, `429` and `5xx`, and drop anything the server rejects with another `4xx`.
