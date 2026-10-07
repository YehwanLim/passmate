import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiAuth", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  getAuthorizationHeader: vi.fn(async () => ({ Authorization: "Bearer t" })),
}));

import { isSimilarTitle, parseExtractResponse, parseTags, requestExperienceCandidates } from "./experienceImport";

const RAW = { title: "로그로 찾은 이탈", period: "", situation: "s", action: "a", result: "", tags: ["데이터"], quotes: ["원문 문장입니다 여기"] };

afterEach(() => vi.unstubAllGlobals());

describe("parseExtractResponse", () => {
  it("성공은 후보와 남은 횟수, 빈 배열은 empty", () => {
    expect(parseExtractResponse(200, { candidates: [RAW], remaining_today: 2 })).toEqual({ kind: "ok", candidates: [RAW], remainingToday: 2 });
    expect(parseExtractResponse(200, { candidates: [], remaining_today: 3 })).toEqual({ kind: "empty", remainingToday: 3 });
  });

  it("상태 코드를 화면용 종류로 바꾼다", () => {
    expect(parseExtractResponse(429, null).kind).toBe("rate_limited");
    expect(parseExtractResponse(409, { error: "EXPERIENCE_LIMIT_REACHED" }).kind).toBe("limit_reached");
    expect(parseExtractResponse(400, { error: "INVALID_REQUEST" }).kind).toBe("invalid");
    expect(parseExtractResponse(401, null).kind).toBe("auth_required");
    expect(parseExtractResponse(502, { error: "EXTRACT_FAILED" }).kind).toBe("failed");
    expect(parseExtractResponse(200, { nope: 1 }).kind).toBe("failed");
  });

  it("후보의 빠진 칸은 빈 값으로 채운다", () => {
    const result = parseExtractResponse(200, { candidates: [{ title: "제목만" }], remaining_today: 1 });
    expect(result).toEqual({
      kind: "ok",
      candidates: [{ title: "제목만", period: "", situation: "", action: "", result: "", tags: [], quotes: [] }],
      remainingToday: 1,
    });
  });
});

describe("requestExperienceCandidates", () => {
  it("POST /api/analyze/extract 로 text 만 보낸다", async () => {
    const fetchMock = vi.fn(async () => ({ status: 200, json: async () => ({ candidates: [RAW], remaining_today: 2 }) }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestExperienceCandidates("가".repeat(200));
    expect(result.kind).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/analyze/extract");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ text: "가".repeat(200) });
  });

  it("네트워크 오류는 network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect((await requestExperienceCandidates("가".repeat(200))).kind).toBe("network");
  });
});

describe("isSimilarTitle", () => {
  it("공백·문장부호·대소문자를 빼고 같거나 한쪽이 다른 쪽을 품으면 비슷하다", () => {
    expect(isSimilarTitle("카페 단골 만들기", "카페단골만들기!")).toBe(true);
    expect(isSimilarTitle("UX 리서치", "ux 리서치 프로젝트")).toBe(true);
    expect(isSimilarTitle("카페 단골 만들기", "동아리 회계")).toBe(false);
    expect(isSimilarTitle("", "동아리 회계")).toBe(false);
  });
});

describe("parseTags", () => {
  it("쉼표로 나눠 다듬고 20자·5개·중복 제거", () => {
    expect(parseTags(" 데이터, 실험 ,데이터,,a,b,c,d")).toEqual(["데이터", "실험", "a", "b", "c"]);
    expect(parseTags("가".repeat(25))).toEqual(["가".repeat(20)]);
  });
});
