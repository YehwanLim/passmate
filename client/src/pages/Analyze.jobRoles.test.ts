import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  JOB_ROLE_CATEGORIES,
  filterJobRoleCategories,
} from "@/constants/jobRoles";

describe("JOB_ROLE_CATEGORIES", () => {
  it("covers every hiring track a Korean new-grad applicant may target", () => {
    expect(JOB_ROLE_CATEGORIES.map(category => category.name)).toEqual([
      "기획·PM",
      "마케팅·브랜딩",
      "경영·사업",
      "재무·회계",
      "금융·투자",
      "구매·SCM",
      "생산·품질",
      "연구·개발",
      "데이터·IT",
      "디자인·콘텐츠",
      "영업·고객",
      "인사·총무",
      "법무·홍보",
      "의료·제약·바이오",
      "교육·공공",
      "건설·건축",
      "방송·언론",
      "서비스·항공",
    ]);
  });

  it("leads each category with the umbrella role postings often use alone", () => {
    const leadRoles = Object.fromEntries(
      JOB_ROLE_CATEGORIES.map(category => [category.name, category.roles[0]])
    );

    expect(leadRoles["기획·PM"]).toBe("기획");
    expect(leadRoles["마케팅·브랜딩"]).toBe("마케팅");
    expect(leadRoles["영업·고객"]).toBe("영업");
    expect(leadRoles["생산·품질"]).toBe("생산");
    expect(leadRoles["데이터·IT"]).toBe("개발");
    expect(leadRoles["디자인·콘텐츠"]).toBe("디자인");
  });

  it("lists no duplicated role across categories", () => {
    const roles = JOB_ROLE_CATEGORIES.flatMap(category => category.roles);

    expect(new Set(roles).size).toBe(roles.length);
    expect(roles.length).toBeGreaterThan(200);
  });

  it("carries the posting names applicants actually type", () => {
    const roles: string[] = JOB_ROLE_CATEGORIES.flatMap(
      category => category.roles
    );

    // 국내 공고에서 흔한 이름인데 한때 빠져 있었던 것들.
    for (const role of [
      "서버 개발",
      "웹 개발",
      "소프트웨어 개발",
      "안드로이드 개발",
      "iOS 개발",
      "네트워크 엔지니어",
      "영업지원",
      "회계감사",
    ]) {
      expect(roles).toContain(role);
    }
  });

  it("spells out aliases so an applicant's own wording still matches", () => {
    for (const query of ["R&D", "머신러닝", "ERP", "VMD", "데이터베이스"]) {
      expect(
        filterJobRoleCategories(query).flatMap(category => category.roles)
      ).not.toHaveLength(0);
    }
  });
});

describe("filterJobRoleCategories", () => {
  it("returns every category grouped when the query is empty", () => {
    expect(filterJobRoleCategories("")).toEqual(
      JOB_ROLE_CATEGORIES.map(category => ({
        name: category.name,
        roles: [...category.roles],
      }))
    );
    expect(filterJobRoleCategories("   ")).toHaveLength(
      JOB_ROLE_CATEGORIES.length
    );
  });

  it("matches roles across categories so the user never guesses a category", () => {
    const matched = filterJobRoleCategories("마케팅");

    expect(matched[0].name).toBe("마케팅·브랜딩");
    expect(matched[0].roles[0]).toBe("마케팅");
    expect(matched.flatMap(category => category.roles)).toContain(
      "메디컬 마케팅"
    );
  });

  it("keeps every role of a category whose name matches the query", () => {
    const matched = filterJobRoleCategories("SCM");

    expect(matched).toEqual([
      {
        name: "구매·SCM",
        roles: [
          "SCM",
          "구매",
          "전략구매",
          "물류",
          "유통관리",
          "자재관리",
          "수요예측",
          "무역",
          "수출입",
          "해외조달",
        ],
      },
    ]);
  });

  it("ranks roles starting with the query above partial matches", () => {
    const matched = filterJobRoleCategories("개발");

    // "사업개발"이 아니라 포괄 직무 "개발"이 맨 앞에 와야 한다.
    expect(matched[0].name).toBe("데이터·IT");
    expect(matched[0].roles[0]).toBe("개발");
    expect(matched.flatMap(category => category.roles)).toContain("사업개발");
  });

  it("ignores spacing and letter case", () => {
    expect(filterJobRoleCategories("ux ui").flatMap(c => c.roles)).toContain(
      "UX/UI 디자인"
    );
    expect(
      filterJobRoleCategories("데 이 터분석").flatMap(c => c.roles)
    ).toContain("데이터 분석");
    expect(filterJobRoleCategories("hr").flatMap(c => c.roles)).toContain(
      "인사(HR)"
    );
  });

  it("returns nothing when no preset matches so the typed role is used as-is", () => {
    expect(filterJobRoleCategories("우주비행사")).toEqual([]);
  });
});

describe("job role input", () => {
  it("uses a searchable combobox instead of collapsed category accordions", () => {
    const source = readFileSync(
      new URL("./Analyze.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("function JobRoleCombobox(");
    expect(source).toContain("filterJobRoleCategories(value)");
    expect(source).toContain("직무를 검색하거나 직접 입력하세요");
    expect(source).not.toContain("<Accordion");
    expect(source).not.toContain('from "@/components/ui/accordion"');
    expect(source).not.toContain("__custom__");
  });
});
