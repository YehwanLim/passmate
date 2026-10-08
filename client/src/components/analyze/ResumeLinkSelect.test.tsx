// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ResumeLinkSelect from "./ResumeLinkSelect";
import type { ProjectSummary } from "@/types/my";

afterEach(() => cleanup());

const project = (id: string, company: string, updated: string): ProjectSummary => ({
  id,
  title: company,
  company_name: company,
  job_role: "국내영업",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: updated,
  analysis_count: 1,
  latest_analysis_id: `a-${id}`,
  total_chars: 900,
  summary: null,
});

describe("기업 분석 > 내 자소서 분석과 연결", () => {
  it("고른 자소서는 회사·직무 아래에 날짜까지 보여 같은 회사끼리 헷갈리지 않는다", () => {
    render(
      <ResumeLinkSelect
        resumes={[project("1", "한솔제지", "2026-10-03T03:00:00Z"), project("2", "한솔제지", "2026-09-20T03:00:00Z")]}
        value="a-2"
        onChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "연결할 자소서 분석" });
    expect(trigger.textContent).toContain("한솔제지 · 국내영업");
    expect(trigger.textContent).toContain("2026.09.20");
  });

  it("아무것도 고르지 않았으면 '연결하지 않기'", () => {
    render(<ResumeLinkSelect resumes={[project("1", "한솔제지", "2026-10-03T03:00:00Z")]} value="" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "연결할 자소서 분석" }).textContent).toContain("연결하지 않기");
  });
});
