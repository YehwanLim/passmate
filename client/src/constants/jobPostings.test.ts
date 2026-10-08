import { describe, expect, it } from "vitest";
import { MAX_POSTING_CHARS, MIN_POSTING_CHARS } from "@/lib/jobPosting";
import { findJobPosting, jobPostingPath, JOB_POSTINGS } from "./jobPostings";
import { JOB_POSTING_DETAILS, postingTextOf } from "./jobPostingDetails";

describe("JOB_POSTINGS", () => {
  it("has unique url-safe slugs, each with exactly one detail", () => {
    const slugs = JOB_POSTINGS.map(posting => posting.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(Object.keys(JOB_POSTING_DETAILS).sort()).toEqual([...slugs].sort());
  });

  it("uses KST deadlines and plain dates", () => {
    for (const posting of JOB_POSTINGS) {
      expect(posting.closesAt, posting.slug).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/);
      expect(posting.opensAt, posting.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(posting.updated, posting.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(posting.opensAt < posting.closesAt.slice(0, 10), posting.slug).toBe(true);
    }
  });

  it("is written in deadline order (the prerendered list relies on it)", () => {
    const deadlines = JOB_POSTINGS.map(posting => new Date(posting.closesAt).getTime());
    expect(deadlines).toEqual([...deadlines].sort((a, b) => a - b));
  });

  it("gives the posting reader enough text and cites an official https source", () => {
    for (const posting of JOB_POSTINGS) {
      const detail = JOB_POSTING_DETAILS[posting.slug];
      const text = postingTextOf(posting, detail);
      expect(text.length, posting.slug).toBeGreaterThanOrEqual(MIN_POSTING_CHARS);
      expect(text.length, posting.slug).toBeLessThanOrEqual(MAX_POSTING_CHARS);
      // 기업 분석 폼(CompanyAnalyze)의 채용공고 칸 상한도 넘지 않는다.
      expect(text.length, posting.slug).toBeLessThanOrEqual(4000);
      expect(detail.process.length, posting.slug).toBeGreaterThan(0);
      expect(detail.facts.some(fact => fact.label === "전형 절차"), posting.slug).toBe(false);
      expect(detail.facts.some(fact => typeof fact.value !== "string"), posting.slug).toBe(true);
      expect(detail.source.url, posting.slug).toMatch(/^https:\/\//);
      expect(detail.description.length, posting.slug).toBeLessThanOrEqual(160);
      expect(detail.facts.length, posting.slug).toBeGreaterThan(0);
      // 모집 직무는 공고마다 꼭 보인다.
      expect(detail.facts.some(fact => /직무|직군|부문|분야/.test(fact.label)), posting.slug).toBe(true);
    }
  });

  it("finds a posting by slug and builds its path", () => {
    const [first] = JOB_POSTINGS;
    expect(findJobPosting(first.slug)).toBe(first);
    expect(findJobPosting("no-such-posting")).toBeUndefined();
    expect(findJobPosting(null)).toBeUndefined();
    expect(jobPostingPath(first)).toBe(`/jobs/${first.slug}`);
  });
});
