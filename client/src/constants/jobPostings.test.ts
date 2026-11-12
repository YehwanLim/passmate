import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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
      expect(posting.roles.trim().length, posting.slug).toBeGreaterThan(0);
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
      const apply = detail.facts.find(fact => fact.label === "접수처");
      expect(apply?.href, `${posting.slug} 접수처 링크`).toMatch(/^https:\/\//);
      expect(detail.facts.some(fact => fact.label === "전형 절차"), posting.slug).toBe(false);
      expect(detail.facts.some(fact => typeof fact.value !== "string"), posting.slug).toBe(true);
      expect(detail.source.url, posting.slug).toMatch(/^https:\/\//);
      expect(detail.description.length, posting.slug).toBeLessThanOrEqual(160);
      expect(detail.facts.length, posting.slug).toBeGreaterThan(0);
      // 모집 직무는 공고마다 꼭 보인다.
      expect(detail.facts.some(fact => /직무|직군|부문|분야/.test(fact.label)), posting.slug).toBe(true);
    }
  });

  it("points each logo at a file in client/public/company-logos", () => {
    for (const posting of JOB_POSTINGS) {
      expect(posting.logo, `${posting.slug}: 로고가 없다 — 회사 공식 사이트에서 받아 넣는다`).toBeTruthy();
      expect(existsSync(resolve(process.cwd(), "client/public", posting.logo!.slice(1))), posting.slug).toBe(true);
    }
  });

  // 재발 방지: 다른 회사 로고(예: 코카콜라음료에 LG 로고)가 붙는 사고를 막는다.
  // 규칙 1) 로고 파일은 SOURCES.md 표에 '기업' 이름과 출처가 적혀 있어야 한다.
  // 규칙 2) 공고의 회사 이름이 그 '기업' 이름과 겹쳐야 한다(한쪽이 다른 쪽을 포함).
  // 규칙 3) 겹치지 않는데 쓰고 싶으면(같은 그룹 로고 공용) 아래 GROUP_LOGO_ALLOW 에 파일·회사를 직접 적는다.
  //         계열사라는 이유만으로 그룹 로고를 쓰지 말고, 회사 자체 로고가 있으면 그걸 쓴다.
  const GROUP_LOGO_ALLOW: Record<string, readonly string[]> = {
    "sk.svg": ["SK이노베이션 E&S 계열 도시가스사", "SK이터닉스", "SK키파운드리"],
    "bnk.svg": ["BNK투자증권"],
    "spc.svg": ["삼립"],
    "nonghyup.svg": ["농협양곡", "농협경제지주"],
    "gm.svg": ["GM테크니컬센터코리아"],
    "kyobo.svg": ["교보생명"],
    "hyundai-lnc.svg": ["현대L&C"],
  };
  const normalizeName = (name: string) => name.replace(/[\s·\-&]|그룹|주식회사|\(.*?\)/g, "").toLowerCase();

  it("never reuses another company's logo (SOURCES.md owner must match the posting's company)", () => {
    const sources = readFileSync(resolve(process.cwd(), "client/public/company-logos/SOURCES.md"), "utf8");
    const owners = new Map<string, string>();
    for (const row of sources.matchAll(/^\| `([^`]+\.svg)`\s*\|\s*([^|]+?)\s*\|/gm)) owners.set(row[1], row[2]);
    for (const posting of JOB_POSTINGS) {
      const file = posting.logo!.split("/").pop()!;
      const owner = owners.get(file);
      expect(owner, `${posting.slug}: ${file} 가 SOURCES.md 표에 없다`).toBeTruthy();
      const company = normalizeName(posting.company);
      const logoOwner = normalizeName(owner!);
      const matches = company.includes(logoOwner) || logoOwner.includes(company);
      const allowed = GROUP_LOGO_ALLOW[file]?.includes(posting.company) ?? false;
      expect(matches || allowed, `${posting.slug}: ${posting.company} 공고에 ${owner} 로고(${file})가 붙었다`).toBe(true);
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
