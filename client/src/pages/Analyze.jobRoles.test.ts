import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { JOB_ROLE_CATEGORIES } from "./Analyze";

describe("JOB_ROLE_CATEGORIES", () => {
  it("groups the requested default roles and replaces service PM", () => {
    const roles = JOB_ROLE_CATEGORIES.flatMap((category) => category.roles);

    expect(JOB_ROLE_CATEGORIES.map((category) => category.name)).toEqual([
      "기획·PM",
      "마케팅·브랜딩",
      "경영·사업",
      "재무·회계",
      "구매·SCM",
      "인사·총무",
      "영업·고객",
      "데이터·IT",
      "디자인·콘텐츠",
    ]);
    expect(roles).toEqual(
      expect.arrayContaining([
        "서비스 기획",
        "제품/상품 기획",
        "브랜드 마케팅",
        "경영전략",
        "재무",
        "구매",
      ])
    );
    expect(roles).not.toContain("서비스 PM");
    expect(new Set(roles).size).toBe(roles.length);
  });

  it("renders every category before the shared custom input control", () => {
    const source = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");

    expect(source).toContain("JOB_ROLE_CATEGORIES.map((category) => (");
    expect(source).toContain("{category.name}");
    expect(source).toContain("category.roles.map((role) => {");
    expect(source.indexOf("JOB_ROLE_CATEGORIES.map((category) => (")).toBeLessThan(
      source.indexOf("{/* 직접 입력 태그 */}")
    );
  });
});
