import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiAuth", () => ({ getAuthorizationHeader: vi.fn(async () => ({ Authorization: "Bearer t" })) }));

import {
  WorkspaceApiError,
  countChars,
  daysUntil,
  saveApplicationQuestions,
  sortApplications,
  applicationStatus,
  formatPeriod,
  updateApplicationMeta,
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

  it("작성 중인 지원서를 분석 끝난 것보다 위에 둔다(마감 지난 건 상태와 상관없이 맨 아래)", () => {
    const now = new Date("2026-10-03T03:00:00Z");
    const items = [
      { id: "done-soon", deadline: "2026-10-04T14:59:00Z", created_at: "2026-09-01T00:00:00Z", latest_analysis_id: "a", latest_status: "SUCCESS" },
      { id: "draft-far", deadline: "2026-10-19T08:00:00Z", created_at: "2026-09-01T00:00:00Z", latest_analysis_id: null },
      { id: "failed", deadline: null, created_at: "2026-09-01T00:00:00Z", latest_analysis_id: "b", latest_status: "FAILED" },
      { id: "draft-past", deadline: "2026-09-30T08:00:00Z", created_at: "2026-09-01T00:00:00Z", latest_analysis_id: null },
      { id: "pending", deadline: "2026-10-10T08:00:00Z", created_at: "2026-09-01T00:00:00Z", latest_analysis_id: "c", latest_status: "PENDING" },
    ];
    expect(sortApplications(items, now).map((i) => i.id)).toEqual(["draft-far", "failed", "done-soon", "pending", "draft-past"]);
  });
});

describe("applicationStatus", () => {
  it("분석 전·실패는 작성 중, 접수됨은 분석 중, 끝났거나 상태 없는 구버전은 분석 완료", () => {
    expect(applicationStatus({ latest_analysis_id: null })).toBe("draft");
    expect(applicationStatus({ latest_analysis_id: "a", latest_status: "FAILED" })).toBe("draft");
    expect(applicationStatus({ latest_analysis_id: "a", latest_status: "PENDING" })).toBe("analyzing");
    expect(applicationStatus({ latest_analysis_id: "a", latest_status: "SUCCESS" })).toBe("done");
    expect(applicationStatus({ latest_analysis_id: "a" })).toBe("done");
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

describe("updateApplicationMeta", () => {
  it("PATCH 로 메타를 보내고 서버가 돌려준 헤더 값을 돌려준다", async () => {
    const body = { id: "p1", title: "한솔제지 · 영업", company_name: "한솔제지", job_role: "영업", deadline: "2026-10-20T14:59:00.000Z" };
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await updateApplicationMeta("p1", { company: "한솔제지", jobKeyword: "영업", deadline: "2026-10-20T23:59:00+09:00" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/projects/p1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ company: "한솔제지", jobKeyword: "영업", deadline: "2026-10-20T23:59:00+09:00" });
    expect(result).toEqual(body);
  });
});

describe("formatPeriod", () => {
  it("연.월 기간을 YY.MM – YY.MM 로 줄이고, 모르는 형식은 그대로 둔다", () => {
    expect(formatPeriod("2024.07~2024.10")).toBe("24.07 – 24.10");
    expect(formatPeriod("2023.3 - 2023.12")).toBe("23.03 – 23.12");
    expect(formatPeriod("2025.01 ~ 2025.06.")).toBe("25.01 – 25.06");
    expect(formatPeriod("2024.7")).toBe("24.07");
    expect(formatPeriod("2024 여름 (8주)")).toBe("2024 여름 (8주)");
    expect(formatPeriod(null)).toBe("");
    expect(formatPeriod("  ")).toBe("");
  });
});
