import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ProjectCard.tsx", import.meta.url), "utf8");

describe("ProjectCard kind handling", () => {
  it("labels company projects and hides résumé-only affordances", () => {
    expect(source).toContain('project.kind === "COMPANY"');
    expect(source).toContain("기업 분석 리포트");
    expect(source).toContain("작성한 자소서 보기");
    // 자소서 보기 버튼은 기업 프로젝트에서 그리지 않는다.
    expect(source).toMatch(/isCompany\s*\?\s*null\s*:/);
  });

  it("only says an analysis is waiting when the latest analysis is actually pending", () => {
    // 서버가 keywords를 안 주던 시절의 폴백 — 완료된 리포트에도 항상 "분석 대기중"이 떴다.
    expect(source).not.toMatch(/project\.keywords && project\.keywords\.length > 0 \? \([\s\S]*?분석 대기중/);
    expect(source).toContain('project.latest_status === "PENDING"');
    expect(source).toContain('project.latest_status === "FAILED"');
    expect(source).toContain("분석 대기중");
  });
});
