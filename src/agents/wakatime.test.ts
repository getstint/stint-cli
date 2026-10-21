import { describe, expect, test } from "bun:test";
import { setIniValue, withStint, withoutStint } from "./wakatime";

const url = "https://getstint.dev/api/compat/wakatime/v1";
const key = "3f2b8c1e-9a4d-4e7f-b1c2-5d6e7f8a9b0c";

describe("wakatime.cfg", () => {
  test("creates the settings section in an empty file", () => {
    expect(withStint("", url, key)).toBe(`[settings]\napi_url = ${url}\napi_key = ${key}\n`);
  });

  test("replaces only api_url and api_key and keeps everything else", () => {
    const before = "[settings]\napi_key = waka_old\ndebug = false\nhide_file_names = true\n\n[projects]\nfoo = bar\n";
    expect(withStint(before, url, key)).toBe(
      `[settings]\napi_key = ${key}\ndebug = false\nhide_file_names = true\napi_url = ${url}\n\n[projects]\nfoo = bar\n`,
    );
  });

  test("setting a value twice keeps one line", () => {
    const once = setIniValue("[settings]\n", "settings", "api_url", url);
    expect(setIniValue(once, "settings", "api_url", url)).toBe(once);
  });

  test("removing only strips our server and key", () => {
    expect(withoutStint(withStint("[settings]\ndebug = true\n", url, key))).toBe("[settings]\ndebug = true\n");
    const theirs = "[settings]\napi_url = https://wakapi.dev/api\napi_key = x\n";
    expect(withoutStint(theirs)).toBe(theirs);
  });
});
