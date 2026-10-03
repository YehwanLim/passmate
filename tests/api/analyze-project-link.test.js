import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-handler.js";
import { allocateAnalysisRequest } from "../../lib/analysis-request-lifecycle.js";
import { normalizeRequest, requestHash, verifyResumeRequest } from "../../lib/resume-analysis.js";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const QUESTIONS = [{ question: "지원 동기", answer: "가".repeat(250) }];

describe("분석 요청 ↔ 지원서 연결", () => {
  it("projectId 는 선택이고 uuid 가 아니면 400", () => {
    expect(normalizeRequest({ questions: QUESTIONS }).projectId).toBeNull();
    expect(normalizeRequest({ questions: QUESTIONS, projectId: PROJECT_ID }).projectId).toBe(PROJECT_ID);
    for (const projectId of ["abc", 1, "", { id: PROJECT_ID }]) {
      expect(() => normalizeRequest({ questions: QUESTIONS, projectId })).toThrow(ApiError);
    }
  });

  it("projectId 없는 요청 해시는 그대로, 있으면 달라진다", () => {
    const plain = normalizeRequest({ questions: QUESTIONS, company: "A" });
    const legacy = requestHash({ company: plain.company, jobKeyword: plain.jobKeyword, questions: plain.questions });
    expect(requestHash(plain)).toBe(legacy);
    const linked = normalizeRequest({ questions: QUESTIONS, company: "A", projectId: PROJECT_ID });
    expect(requestHash(linked)).not.toBe(requestHash(plain));
  });

  it("verifyResumeRequest 는 남의 지원서를 404 로 막는다", async () => {
    const findFirst = vi.fn(async ({ where }) => (where.userId === "owner" ? { id: PROJECT_ID } : null));
    const db = { project: { findFirst } };
    const mine = normalizeRequest({ questions: QUESTIONS, projectId: PROJECT_ID });
    await verifyResumeRequest(mine, { db, userId: "owner" });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: PROJECT_ID, userId: "owner" } }));

    const theirs = normalizeRequest({ questions: QUESTIONS, projectId: PROJECT_ID });
    await expect(verifyResumeRequest(theirs, { db, userId: "intruder" })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("allocateAnalysisRequest 와 projectId", () => {
  function createTx({ ownedProject }) {
    const tx = {
      analysisRequest: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), count: vi.fn(async () => 0), create: vi.fn(async () => ({ id: "req-1" })) },
      project: {
        findFirst: vi.fn(async () => ownedProject),
        create: vi.fn(async () => ({ id: "p-created" })),
      },
      analysis: { create: vi.fn(async () => ({ id: "a-1" })) },
    };
    return { $transaction: vi.fn(async (work) => work(tx)), tx };
  }

  const base = {
    analysisInput: () => ({ questionText: "q", inputText: "a", totalChars: 250, jobPostingId: null }),
    buildProjectTitle: () => "A 지원서",
    consumeRateLimit: vi.fn(async () => ({ allowed: true })),
    getSummary: vi.fn(async () => ({})),
    getThroughputPolicy: () => ({ concurrencyLimit: 1, rateLimit: { route: "x", limit: 3, windowMs: 1000 } }),
    hash: "h",
    idempotencyKey: "k",
    kind: "RESUME",
    userId: "owner",
  };

  it("projectId 가 있으면 새 Project 를 만들지 않고 그 지원서에 붙인다", async () => {
    const { $transaction, tx } = createTx({ ownedProject: { id: PROJECT_ID } });
    const reserve = vi.fn(async () => ({ reservationId: "r-1" }));
    const result = await allocateAnalysisRequest({
      ...base, db: { $transaction }, reserve,
      request: { company: "A", jobKeyword: null, projectId: PROJECT_ID },
    });
    expect(tx.project.create).not.toHaveBeenCalled();
    expect(tx.analysis.create.mock.calls[0][0].data.projectId).toBe(PROJECT_ID);
    expect(result.project.id).toBe(PROJECT_ID);
  });

  it("그 사이 지원서가 지워졌으면 크레딧을 예약하지 않고 404", async () => {
    const { $transaction } = createTx({ ownedProject: null });
    const reserve = vi.fn();
    await expect(allocateAnalysisRequest({
      ...base, db: { $transaction }, reserve,
      request: { company: "A", jobKeyword: null, projectId: PROJECT_ID },
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(reserve).not.toHaveBeenCalled();
  });
});
