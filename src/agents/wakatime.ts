import { existsSync, readFileSync } from "node:fs";
import { readText } from "../lib/files";
import { paths } from "../lib/paths";

export const wakatimeApiUrl = (apiUrl: string) => `${apiUrl}/api/compat/wakatime/v1`;

export const readWakatimeConfig = () => readText(paths.wakatimeConfig()) ?? "";

const ending = (lines: string[]) => lines.join("\n").replace(/\n*$/, "\n");

export function setIniValue(text: string, section: string, key: string, value: string): string {
  const lines = text.length ? text.replace(/\r\n/g, "\n").split("\n") : [];
  const header = `[${section}]`;
  const start = lines.findIndex((line) => line.trim().toLowerCase() === header);
  if (start === -1) {
    if (lines.length && lines[lines.length - 1].trim() !== "") lines.push("");
    lines.push(header, `${key} = ${value}`);
    return ending(lines);
  }
  let end = lines.findIndex((line, index) => index > start && /^\s*\[.+\]\s*$/.test(line));
  if (end === -1) end = lines.length;
  const keyPattern = new RegExp(`^\\s*${key}\\s*=`, "i");
  const existing = lines.findIndex((line, index) => index > start && index < end && keyPattern.test(line));
  if (existing !== -1) lines[existing] = `${key} = ${value}`;
  else {
    let insertAt = end;
    while (insertAt - 1 > start && lines[insertAt - 1].trim() === "") insertAt -= 1;
    lines.splice(insertAt, 0, `${key} = ${value}`);
  }
  return ending(lines);
}

export function withStint(text: string, apiUrl: string, apiKey: string): string {
  return setIniValue(setIniValue(text, "settings", "api_url", apiUrl), "settings", "api_key", apiKey);
}

export function withoutStint(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const pointsAtStint = lines.some((line) => /^\s*api_url\s*=.*\/api\/compat\/wakatime\/v1\s*$/.test(line));
  if (!pointsAtStint) return text;
  return lines.filter((line) => !/^\s*api_(url|key)\s*=/.test(line)).join("\n");
}

export function restoredWakatimeConfig(): string {
  const backup = `${paths.wakatimeConfig()}.stint-backup`;
  return existsSync(backup) ? readFileSync(backup, "utf8") : withoutStint(readWakatimeConfig());
}
