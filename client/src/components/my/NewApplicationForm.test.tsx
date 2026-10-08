// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createApplication: vi.fn(), updateApplicationMeta: vi.fn() }));
vi.mock("@/lib/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/workspace")>()),
  createApplication: mocks.createApplication,
  updateApplicationMeta: mocks.updateApplicationMeta,
}));
// 공고 읽기는 서버를 부르니, 누르면 정리된 공고를 넘겨주는 버튼으로 바꿔 둔다.
vi.mock("@/components/analyze/JobPostingSection", () => ({
  default: ({ onChange }: { onChange: (record: unknown) => void }) => (
    <button
      type="button"
      onClick={() => onChange({ id: "jp-1", sourceUrl: "https://example.com/job", summary: { title: "마케팅 신입", company: "CJ제일제당", role: "브랜드 마케팅", responsibilities: [], requirements: [], preferred: [], keywords: [] } })}
    >
      공고 읽기(테스트)
    </button>
  ),
}));

import NewApplicationForm from "./NewApplicationForm";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const renderForm = () => {
  const onCreated = vi.fn();
  render(<NewApplicationForm onCreated={onCreated} onCancel={vi.fn()} onRequireLogin={vi.fn()} />);
  return onCreated;
};

describe("새 지원서", () => {
  it("공고를 읽으면 빈 회사·직무를 채우고, 만들면 공고를 붙인 뒤 작성 화면으로 넘긴다", async () => {
    mocks.createApplication.mockResolvedValue({ id: "p-new" });
    mocks.updateApplicationMeta.mockResolvedValue({});
    const onCreated = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "공고 읽기(테스트)" }));
    expect((screen.getByLabelText("회사") as HTMLInputElement).value).toBe("CJ제일제당");
    expect((screen.getByLabelText("직무") as HTMLInputElement).value).toBe("브랜드 마케팅");
    fireEvent.change(screen.getByLabelText("문항 1"), { target: { value: "지원 동기" } });
    fireEvent.click(screen.getByRole("button", { name: "만들고 쓰기 시작" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("p-new"));
    expect(mocks.createApplication).toHaveBeenCalledWith(expect.objectContaining({
      company: "CJ제일제당", jobKeyword: "브랜드 마케팅", questions: [{ prompt: "지원 동기", charLimit: null, answer: "" }],
    }));
    expect(mocks.updateApplicationMeta).toHaveBeenCalledWith("p-new", { jobPostingId: "jp-1" });
  });

  it("직접 적은 회사는 공고가 덮어쓰지 않는다", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("회사"), { target: { value: "CJ" } });
    fireEvent.click(screen.getByRole("button", { name: "공고 읽기(테스트)" }));
    expect((screen.getByLabelText("회사") as HTMLInputElement).value).toBe("CJ");
  });

  it("공고 없이도 만들고, 회사가 비면 만들지 않는다", async () => {
    mocks.createApplication.mockResolvedValue({ id: "p2" });
    const onCreated = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "만들고 쓰기 시작" }));
    expect(await screen.findByText("회사 이름을 적어 주세요.")).toBeTruthy();
    expect(mocks.createApplication).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("회사"), { target: { value: "한솔제지" } });
    fireEvent.click(screen.getByRole("button", { name: "만들고 쓰기 시작" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("p2"));
    expect(mocks.updateApplicationMeta).not.toHaveBeenCalled();
  });

  it("공고 붙이기에 실패해도 만든 지원서로는 넘어간다", async () => {
    mocks.createApplication.mockResolvedValue({ id: "p3" });
    mocks.updateApplicationMeta.mockRejectedValue(new Error("boom"));
    const onCreated = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "공고 읽기(테스트)" }));
    fireEvent.click(screen.getByRole("button", { name: "만들고 쓰기 시작" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("p3"));
  });
});
