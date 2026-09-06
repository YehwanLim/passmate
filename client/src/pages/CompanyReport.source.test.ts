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
});
