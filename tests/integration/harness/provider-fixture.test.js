import { afterEach, describe, expect, it } from "vitest";

import {
  SUCCESS_REPORT_TEXT,
  UnexpectedNetworkCallError,
  installProviderFixture,
} from "./provider-fixture.js";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=fake";

describe("provider fixture", () => {
  let fixture;

  afterEach(() => {
    fixture?.restore();
    fixture = undefined;
  });

  it("gemini 성공 응답을 봉투 형태로 돌려주고 호출을 센다", async () => {
    fixture = installProviderFixture();
    fixture.respondWith({ text: SUCCESS_REPORT_TEXT });

    const response = await fetch(GEMINI_URL, { method: "POST" });
    const body = await response.json();

    expect(response.ok).toBe(true);
    expect(body.candidates[0].content.parts[0].text).toBe(SUCCESS_REPORT_TEXT);
    expect(fixture.calls).toEqual([{ provider: "gemini", modelName: "gemini-2.5-flash-lite" }]);
  });

  it("HTTP 오류 상태를 그대로 돌려준다", async () => {
    fixture = installProviderFixture();
    fixture.respondWith({ status: 429 });

    const response = await fetch(GEMINI_URL, { method: "POST" });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(429);
  });

  it("abort 시나리오는 AbortError 를 던진다", async () => {
    fixture = installProviderFixture();
    fixture.respondWith({ abort: true });

    await expect(fetch(GEMINI_URL, { method: "POST" })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("배열 시나리오를 호출 순서대로 소비하고 마지막 응답을 유지한다", async () => {
    fixture = installProviderFixture();
    fixture.respondWith([{ status: 429 }, { text: SUCCESS_REPORT_TEXT }]);

    expect((await fetch(GEMINI_URL, { method: "POST" })).status).toBe(429);
    expect((await fetch(GEMINI_URL, { method: "POST" })).status).toBe(200);
    expect((await fetch(GEMINI_URL, { method: "POST" })).status).toBe(200);
    expect(fixture.calls).toHaveLength(3);
  });

  it("provider 가 아닌 호스트로 나가는 호출은 실패시킨다", async () => {
    fixture = installProviderFixture();
    fixture.respondWith({ text: SUCCESS_REPORT_TEXT });

    await expect(fetch("https://example.invalid/anything")).rejects.toBeInstanceOf(
      UnexpectedNetworkCallError,
    );
  });

  it("restore 후에는 원래 fetch 가 돌아온다", async () => {
    const before = globalThis.fetch;
    fixture = installProviderFixture();
    fixture.restore();
    expect(globalThis.fetch).toBe(before);
    fixture = undefined;
  });

  it("성공 리포트 텍스트는 파싱 가능한 JSON 이다", () => {
    expect(() => JSON.parse(SUCCESS_REPORT_TEXT)).not.toThrow();
    expect(JSON.parse(SUCCESS_REPORT_TEXT).questionTabs).toBeInstanceOf(Array);
  });
});
