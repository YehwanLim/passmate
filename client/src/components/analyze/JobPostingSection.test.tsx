// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getAuthorizationHeader: vi.fn(),
}));

vi.mock("@/lib/apiAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiAuth")>()),
  getAuthorizationHeader: mocks.getAuthorizationHeader,
}));

import type { JobPostingRecord } from "@/types/jobPosting";
import JobPostingSection from "./JobPostingSection";

const RECORD: JobPostingRecord = {
  id: "jp_1",
  sourceUrl: "https://careers.example.com/jobs/1",
  charCount: 1830,
  summary: {
    title: "백엔드 엔지니어",
    company: "프리뷰",
    role: "백엔드",
    responsibilities: ["API 설계와 운영"],
    requirements: ["Node.js 3년 이상", "PostgreSQL 운영 경험"],
    preferred: ["Vercel 배포 경험"],
    keywords: ["Node.js", "PostgreSQL", "Vercel"],
  },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("JobPostingSection", () => {
  const fetchSpy = vi.fn();
  const onChange = vi.fn();
  const onRequireLogin = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    onChange.mockReset();
    onRequireLogin.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
    mocks.getAuthorizationHeader.mockResolvedValue({ Authorization: "Bearer t" });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("asks for login instead of calling the API when logged out", () => {
    render(
      <JobPostingSection
        value={null}
        onChange={onChange}
        isAuthenticated={false}
        onRequireLogin={onRequireLogin}
      />
    );

    fireEvent.change(screen.getByLabelText("채용공고 URL"), {
      target: { value: "https://careers.example.com/jobs/1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "공고 불러오기" }));

    expect(onRequireLogin).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the fetch button disabled until the URL is valid", () => {
    render(
      <JobPostingSection
        value={null}
        onChange={onChange}
        isAuthenticated
        onRequireLogin={onRequireLogin}
      />
    );
    const button = screen.getByRole("button", { name: "공고 불러오기" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("채용공고 URL"), { target: { value: "원티드 공고" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("채용공고 URL"), {
      target: { value: "https://www.wanted.co.kr/wd/1" },
    });
    expect(button.disabled).toBe(false);
  });

  it("shows the paste hint and switches to text mode when the URL is unreadable", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(422, { error: "POSTING_URL_UNREADABLE" }));
    render(
      <JobPostingSection
        value={null}
        onChange={onChange}
        isAuthenticated
        onRequireLogin={onRequireLogin}
      />
    );

    fireEvent.change(screen.getByLabelText("채용공고 URL"), {
      target: { value: "https://www.wanted.co.kr/wd/1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "공고 불러오기" }));

    await waitFor(() =>
      expect(
        screen.getByText("URL에서 공고 본문을 읽지 못했어요. 공고 내용을 복사해 텍스트로 붙여 주세요.")
      ).toBeTruthy()
    );
    expect(screen.getByRole("tab", { name: "텍스트 붙여넣기" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(screen.getByLabelText("채용공고 본문")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("hands the accepted record to onChange and renders the card", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        job_posting_id: RECORD.id,
        source_url: RECORD.sourceUrl,
        summary: RECORD.summary,
        char_count: RECORD.charCount,
      })
    );
    const view = render(
      <JobPostingSection
        value={null}
        onChange={onChange}
        isAuthenticated
        onRequireLogin={onRequireLogin}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "텍스트 붙여넣기" }));
    fireEvent.change(screen.getByLabelText("채용공고 본문"), {
      target: { value: "수행 업무와 자격요건이 담긴 공고 본문. ".repeat(20) },
    });
    fireEvent.click(screen.getByRole("button", { name: "공고 불러오기" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(RECORD));
    expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)).toHaveProperty("text");

    view.rerender(
      <JobPostingSection
        value={RECORD}
        onChange={onChange}
        isAuthenticated
        onRequireLogin={onRequireLogin}
      />
    );

    expect(screen.getByText("불러온 공고")).toBeTruthy();
    expect(screen.getByText("백엔드 엔지니어")).toBeTruthy();
    expect(screen.getByText("careers.example.com · 본문 1,830자")).toBeTruthy();
    expect(screen.getByText("Node.js 3년 이상")).toBeTruthy();
    expect(screen.getByText("Vercel 배포 경험")).toBeTruthy();
    expect(screen.getByText("PostgreSQL")).toBeTruthy();
    expect(screen.queryByText("책임 업무")).toBeNull();
  });

  it("clears the record with 다른 공고로 바꾸기", () => {
    render(
      <JobPostingSection
        value={RECORD}
        onChange={onChange}
        isAuthenticated
        onRequireLogin={onRequireLogin}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "다른 공고로 바꾸기" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
