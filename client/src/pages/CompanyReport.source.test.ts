import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CompanyReport.tsx", import.meta.url), "utf8");
const parts = readFileSync(new URL("./companyReportParts.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("CompanyReport page", () => {
  it("is view-only: no print, download, or share controls", () => {
    for (const forbidden of ["window.print", "isPrinting", "Download", "Printer", "Share2", "navigator.share"]) {
      expect(source).not.toContain(forbidden);
      expect(parts).not.toContain(forbidden);
    }
  });

  it("keeps report data out of browser storage", () => {
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
  });

  it("renders the Google search suggestion chips verbatim and strips markup from model text", () => {
    expect(source).toContain("searchEntryPointHtml");
    expect(source).toContain("dangerouslySetInnerHTML");
    expect(parts).toContain("parseHighlightedText");
  });

  it("uses the shared anchor class instead of extending the résumé id list", () => {
    expect(source).toContain("report-section-anchor");
    expect(css).toMatch(/\.report-section-anchor\s*\{[^}]*scroll-margin-top/);
    expect(source).not.toContain("section-first-impression");
  });

  it("is routed at /company-report right after /company-analysis", () => {
    expect(appSource).toContain('path={"/company-report"} component={CompanyReport}');
    expect(appSource.indexOf('path={"/company-analysis"}')).toBeLessThan(appSource.indexOf('path={"/company-report"}'));
    expect(appSource.indexOf('path={"/company-report"}')).toBeLessThan(appSource.indexOf('path={"/my"}'));
  });

  it("only links model-provided source URLs when they are http/https", () => {
    expect(source).toContain("ExternalSourceLink");
    // 08 각주와 09 부록 링크가 더 이상 원시 <a href=...> 로 렌더되지 않는다(ExternalSourceLink 가 스킴을 검사한다).
    expect(source).not.toContain("<a href={source.url}");
    expect(source).not.toContain("<a href={primary.url}");
  });

  it("never uses the .container class name here (검색 제안 칩의 인라인 스타일이 .container 를 전역으로 덮으므로 이 페이지에서는 그 클래스를 쓰지 않는다)", () => {
    expect(source).not.toContain('className="container"');
  });
});
