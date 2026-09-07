import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");

describe("Analyze company report link", () => {
  it("offers the company report quietly once a company is chosen", () => {
    expect(source).toContain("기업 분석 리포트 먼저 받기");
    expect(source).toContain("/company-analysis?company=${encodeURIComponent(company.trim())}&jobKeyword=${encodeURIComponent(jobRole.trim())}");
    expect(source).toContain("company.trim().length > 0 && (");
    // "noopener" 피처는 window.open 이 항상 null 을 돌려줘 폴백(같은 탭 이동)이 매번 발동한다 — 쓰지 않는다.
    expect(source).toContain('window.open(path, "_blank")');
    expect(source).not.toContain('"noopener"');
    expect(source).toContain("opened.opener = null");
  });

  it("sends an exhausted user to the standard tier by default", () => {
    expect(source).toContain('actionHref: "/entitlements#standard"');
    expect(source).not.toContain('actionHref: "/entitlements",');
  });
});
