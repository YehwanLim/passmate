import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiAuth", () => ({ getAuthorizationHeader: vi.fn(async () => ({ Authorization: "Bearer t" })) }));

import {
  WorkspaceApiError,
  countChars,
  daysUntil,
  saveApplicationQuestions,
  sortApplications,
} from "./workspace";

afterEach(() => vi.unstubAllGlobals());

describe("countChars", () => {
  it("공백 포함·제외 글자 수를 센다", () => {
    expect(countChars("가 나\n다")).toEqual({ withSpaces: 5, withoutSpaces: 3 });
    expect(countChars("")).toEqual({ withSpaces: 0, withoutSpaces: 0 });
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-10-03T03:00:00Z"); // KST 10-03 12:00
  it("KST 날짜 기준 D-day", () => {
    expect(daysUntil("2026-10-03T14:59:00Z", now)).toBe(0); // KST 10-03 23:59
    expect(daysUntil("2026-10-11T14:59:00Z", now)).toBe(8);
    expect(daysUntil("2026-10-02T14:59:00Z", now)).toBe(-1);
    expect(daysUntil(null, now)).toBeNull();
  });
});

describe("sortApplications", () => {
  it("다가오는 마감 → 마감 없음(최근 수정순) → 지난 마감", () => {
    const now = new Date("2026-10-03T03:00:00Z");
    const items = [
      { id: "past", deadline: "2026-09-30T08:00:00Z", created_at: "2026-09-01T00:00:00Z" },
      { id: "none-old", deadline: null, updated_at: "2026-09-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z" },
      { id: "far", deadline: "2026-10-19T08:00:00Z", created_at: "2026-09-01T00:00:00Z" },
      { id: "none-new", deadline: null, updated_at: "2026-10-02T00:00:00Z", created_at: "2026-09-01T00:00:00Z" },
      { id: "soon", deadline: "2026-10-05T14:59:00Z", created_at: "2026-09-01T00:00:00Z" },
    ];
    expect(sortApplications(items, now).map((i) => i.id)).toEqual(["soon", "far", "none-new", "none-old", "past"]);
  });
});

describe("saveApplicationQuestions", () => {
  it("PUT 으로 문항과 기준 시각을 보내고, 409 는 STALE_DRAFT 오류로 바꾼다", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ questions_updated_at: "2026-10-03T02:00:00.000Z" }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    await saveApplicationQuestions("p1", [{ prompt: "q", charLimit: null, answer: "a" }], "2026-10-03T01:00:00.000Z");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/projects/p1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      questions: [{ prompt: "q", charLimit: null, answer: "a" }],
      baseUpdatedAt: "2026-10-03T01:00:00.000Z",
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "STALE_DRAFT" }), {
      status: 409, headers: { "content-type": "application/json" },
    })));
    await expect(saveApplicationQuestions("p1", [], null)).rejects.toMatchObject({ code: "STALE_DRAFT", status: 409 });
    await expect(saveApplicationQuestions("p1", [], null)).rejects.toBeInstanceOf(WorkspaceApiError);
  });
});
