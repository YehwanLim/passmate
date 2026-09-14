// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYZE_DRAFT_KEY,
  ANALYZE_DRAFT_TTL_MS,
  saveAnalyzeDraft,
  takeAnalyzeDraft,
} from "./analyzeDraft";

const DRAFT = {
  company: "토스",
  jobRole: "프로덕트 디자이너",
  questions: [{ id: "q1", question: "지원 동기", answer: "사용자 문제를 푸는 일이 좋아서요." }],
  jobPosting: {
    id: "jp1",
    sourceUrl: "https://example.com/job",
    summary: {
      title: "PD",
      company: "토스",
      role: "디자이너",
      responsibilities: [],
      requirements: [],
      preferred: [],
      keywords: [],
    },
  },
};

describe("analyzeDraft", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips the form through sessionStorage and removes it once taken", () => {
    saveAnalyzeDraft(DRAFT);

    expect(takeAnalyzeDraft()).toEqual(DRAFT);
    expect(window.sessionStorage.getItem(ANALYZE_DRAFT_KEY)).toBeNull();
    expect(takeAnalyzeDraft()).toBeNull();
  });

  it("returns null when nothing was saved", () => {
    expect(takeAnalyzeDraft()).toBeNull();
  });

  it("drops a draft that outlived the login round-trip window", () => {
    saveAnalyzeDraft(DRAFT);
    vi.setSystemTime(new Date(Date.now() + ANALYZE_DRAFT_TTL_MS + 1));

    expect(takeAnalyzeDraft()).toBeNull();
    expect(window.sessionStorage.getItem(ANALYZE_DRAFT_KEY)).toBeNull();
  });

  it("ignores malformed or foreign payloads instead of throwing", () => {
    window.sessionStorage.setItem(ANALYZE_DRAFT_KEY, "{not json");
    expect(takeAnalyzeDraft()).toBeNull();

    window.sessionStorage.setItem(
      ANALYZE_DRAFT_KEY,
      JSON.stringify({ savedAt: Date.now(), company: 1, questions: "nope" })
    );
    expect(takeAnalyzeDraft()).toBeNull();
    expect(window.sessionStorage.getItem(ANALYZE_DRAFT_KEY)).toBeNull();
  });

  it("keeps only string question fields and tolerates a missing job posting", () => {
    window.sessionStorage.setItem(
      ANALYZE_DRAFT_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        company: "네이버",
        jobRole: "",
        questions: [
          { id: "a", question: "Q", answer: "A" },
          { id: 2, question: "bad", answer: "row" },
        ],
      })
    );

    expect(takeAnalyzeDraft()).toEqual({
      company: "네이버",
      jobRole: "",
      questions: [{ id: "a", question: "Q", answer: "A" }],
      jobPosting: null,
    });
  });

  it("does not throw when storage is unavailable", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    expect(() => saveAnalyzeDraft(DRAFT)).not.toThrow();
    setItem.mockRestore();
  });
});
