import { describe, expect, it, vi } from "vitest";
import { createAnalysisHandler } from "../../api/analysis/[id].js";
import { ApiError } from "../../lib/api-handler.js";
import {
  buildUserPrompt,
  normalizeRequest,
  requestHash,
  resumeAnalysisInput,
  verifyResumeRequest,
} from "../../lib/resume-analysis.js";
import { createResponse } from "../helpers/http.js";

const POSTING_ID = "7b1f0c7e-9a2b-4c3d-8e4f-5a6b7c8d9e0f";
const QUESTIONS = [{ question: "지원 동기", answer: "가".repeat(250) }];
const POSTING = {
  id: POSTING_ID,
  sourceUrl: "https://example.com/job/1",
  rawText: "수행 업무: 서비스 기획. 자격요건: 고객 데이터 분석 경험.",
  summaryJson: {
    title: "서비스 기획 신입",
    company: "현대자동차",
    role: "서비스 기획",
    responsibilities: ["고객 데이터 기반 서비스 개선"],
    requirements: ["고객 데이터 분석 경험", "유관 부서 조율"],
    preferred: ["SQL"],
    keywords: ["고객 데이터", "부서 조율"],
  },
};

describe("자소서 분석 요청 ↔ 채용공고 연결", () => {
  it("jobPostingId 는 선택이며 uuid 가 아니면 400", () => {
    expect(normalizeRequest({ questions: QUESTIONS }).jobPostingId).toBeNull();
    expect(normalizeRequest({ questions: QUESTIONS, jobPostingId: null }).jobPostingId).toBeNull();
    expect(normalizeRequest({ questions: QUESTIONS, jobPostingId: POSTING_ID }).jobPostingId).toBe(POSTING_ID);
    for (const jobPostingId of ["abc", 12, "", { id: POSTING_ID }]) {
      expect(() => normalizeRequest({ questions: QUESTIONS, jobPostingId })).toThrow(ApiError);
    }
  });

  it("공고 없는 요청의 해시는 이전 형식과 같고, 공고가 붙으면 달라진다", () => {
    const plain = normalizeRequest({ questions: QUESTIONS, company: "A" });
    const legacyShape = requestHash({ company: plain.company, jobKeyword: plain.jobKeyword, questions: plain.questions });
    expect(requestHash(plain)).toBe(legacyShape);
    const withPosting = normalizeRequest({ questions: QUESTIONS, company: "A", jobPostingId: POSTING_ID });
    expect(requestHash(withPosting)).not.toBe(requestHash(plain));
  });

  it("verifyResumeRequest 는 남의 공고·없는 공고를 404 로 막고, 내 공고는 request 에 붙인다", async () => {
    const findFirst = vi.fn(async ({ where }) => (where.userId === "owner" ? POSTING : null));
    const db = { jobPosting: { findFirst } };

    const mine = normalizeRequest({ questions: QUESTIONS, jobPostingId: POSTING_ID });
    await verifyResumeRequest(mine, { db, userId: "owner" });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: POSTING_ID, userId: "owner" } }));
    expect(mine.jobPosting).toEqual(POSTING);

    const theirs = normalizeRequest({ questions: QUESTIONS, jobPostingId: POSTING_ID });
    await expect(verifyResumeRequest(theirs, { db, userId: "intruder" })).rejects.toMatchObject({ statusCode: 404 });

    const none = normalizeRequest({ questions: QUESTIONS });
    await verifyResumeRequest(none, { db: {}, userId: "owner" });
    expect(none.jobPosting).toBeUndefined();
  });

  it("resumeAnalysisInput 은 jobPostingId 를 Analysis 컬럼으로 넘긴다", () => {
    expect(resumeAnalysisInput(normalizeRequest({ questions: QUESTIONS })).jobPostingId).toBeNull();
    expect(resumeAnalysisInput(normalizeRequest({ questions: QUESTIONS, jobPostingId: POSTING_ID })).jobPostingId).toBe(POSTING_ID);
  });

  it("buildUserPrompt 는 공고가 붙었을 때만 요약·원문 블록과 postingFit 지시를 넣는다", () => {
    const plain = buildUserPrompt(normalizeRequest({ questions: QUESTIONS, company: "현대자동차" }));
    expect(plain).not.toContain("[채용공고 요약]");
    expect(plain).toContain("postingFit 은 null");

    const request = normalizeRequest({ questions: QUESTIONS, company: "현대자동차", jobPostingId: POSTING_ID });
    request.jobPosting = POSTING;
    const prompt = buildUserPrompt(request);
    expect(prompt.indexOf("[채용공고 요약]")).toBeLessThan(prompt.indexOf("[문항 수]"));
    expect(prompt).toContain("- 공고: 현대자동차 · 서비스 기획");
    expect(prompt).toContain("- 자격요건: 고객 데이터 분석 경험 / 유관 부서 조율");
    expect(prompt).toContain(`[채용공고 원문]\n${POSTING.rawText}`);
    expect(prompt).toContain("postingFit 을 채우고");
  });
});

describe("GET /api/analysis/:id 의 job_posting", () => {
  function createHandler(analysis) {
    return createAnalysisHandler({
      db: { analysis: { findFirst: async () => analysis } },
      requireUser: async () => ({ applicationUser: { id: "user-1" } }),
    });
  }
  const base = {
    id: "analysis-1",
    questionText: "",
    inputText: "",
    aiResponseJson: { pmComment: "x" },
    status: "SUCCESS",
    totalChars: 300,
    createdAt: new Date("2026-09-14T00:00:00Z"),
    projectId: "project-1",
    kind: "RESUME",
    project: { company: "현대자동차", jobKeyword: "서비스 기획", title: "t" },
  };

  it("공고 없는 분석은 job_posting: null", async () => {
    const response = createResponse();
    await createHandler({ ...base, jobPosting: null })({ headers: {}, method: "GET", query: { id: "analysis-1" } }, response);
    expect(response.statusCode).toBe(200);
    expect(response.body.job_posting).toBeNull();
  });

  it("공고가 있으면 id·source_url·summary 를 돌려준다", async () => {
    const response = createResponse();
    await createHandler({ ...base, jobPosting: POSTING })({ headers: {}, method: "GET", query: { id: "analysis-1" } }, response);
    expect(response.body.job_posting).toEqual({
      id: POSTING_ID,
      source_url: POSTING.sourceUrl,
      summary: POSTING.summaryJson,
    });
  });
});
