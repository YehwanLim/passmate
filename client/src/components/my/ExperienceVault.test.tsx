// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listExperiences: vi.fn(),
  createExperience: vi.fn(),
  updateExperience: vi.fn(),
  deleteExperience: vi.fn(),
  createExperiences: vi.fn(),
}));
vi.mock("@/lib/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/workspace")>()),
  ...mocks,
}));
const importMocks = vi.hoisted(() => ({ requestExperienceCandidates: vi.fn() }));
vi.mock("@/lib/experienceImport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/experienceImport")>()),
  requestExperienceCandidates: importMocks.requestExperienceCandidates,
}));

import { WorkspaceApiError } from "@/lib/workspace";
import ExperienceVault from "./ExperienceVault";

const EXP = {
  id: "e1", title: "카페 발주 개선", period: "2025.03-08", situation: "폐기 많음",
  action: "판매 데이터로 발주 조정", result: "폐기 30% 감소", tags: ["데이터"], updatedAt: "2026-10-03T00:00:00Z",
};

beforeEach(() => mocks.listExperiences.mockResolvedValue([EXP]));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

describe("내 경험", () => {
  it("빈 금고에서는 가운데에만 가져오기 버튼을 두고(위 줄 버튼은 숨김), 누르면 창이 열린다", async () => {
    mocks.listExperiences.mockResolvedValue([]);
    render(<ExperienceVault />);
    await screen.findByText(/아직 적어 둔 경험이 없어요/);
    const buttons = screen.getAllByRole("button", { name: "이력서·자소서로 경험 채우기" });
    expect(buttons).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "경험 추가" })).toBeNull();
    fireEvent.click(buttons[0]);
    const dialog = screen.getByRole("dialog", { name: "이력서·자소서로 경험 채우기" });
    // 빈 입력칸 아래에 넣을 글 → 나올 카드 예시가 보인다.
    expect(within(dialog).getByRole("region", { name: "예시" })).toBeTruthy();
  });

  it("경험이 있으면 위 줄에만 가져오기 버튼이 하나 있다", async () => {
    render(<ExperienceVault />);
    await screen.findByText("카페 발주 개선");
    expect(screen.getAllByRole("button", { name: "이력서·자소서로 경험 채우기" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "경험 추가" })).toBeTruthy();
  });

  it("가져와 저장한 경험이 목록 맨 위에 붙는다", async () => {
    importMocks.requestExperienceCandidates.mockResolvedValue({
      kind: "ok", remainingToday: 2,
      candidates: [{ title: "로그로 찾은 이탈 원인", period: "", situation: "s", action: "a", result: "r", tags: [], quotes: ["원문 문장입니다 여기"] }],
    });
    mocks.createExperiences.mockImplementation(async (inputs: object[]) => inputs.map((x, i) => ({ ...x, id: `n${i}`, updatedAt: "" })));
    render(<ExperienceVault />);
    await screen.findByText("카페 발주 개선");
    fireEvent.click(screen.getByRole("button", { name: "이력서·자소서로 경험 채우기" }));
    fireEvent.change(screen.getByLabelText("이력서·자소서 붙여넣기"), { target: { value: "가".repeat(220) } });
    fireEvent.click(screen.getByRole("button", { name: "경험 뽑기" }));
    fireEvent.click(await screen.findByRole("button", { name: "선택한 1개 저장" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(["로그로 찾은 이탈 원인", "카페 발주 개선"]);
  });

  it("적어 둔 경험을 보여 준다", async () => {
    render(<ExperienceVault />);
    expect(await screen.findByText("카페 발주 개선")).toBeTruthy();
    expect(screen.getByText("폐기 30% 감소")).toBeTruthy();
  });

  it("빈 상태 안내", async () => {
    mocks.listExperiences.mockResolvedValue([]);
    render(<ExperienceVault />);
    expect(await screen.findByText(/아직 적어 둔 경험이 없어요/)).toBeTruthy();
  });

  it("불러오기에 실패하면 안내를 보여 준다", async () => {
    mocks.listExperiences.mockRejectedValue(new Error("boom"));
    render(<ExperienceVault />);
    expect(await screen.findByText(/경험을 불러오지 못했어요/)).toBeTruthy();
  });

  it("새 경험을 저장하면 태그를 쉼표로 나눠 보내고 목록 맨 위에 붙인다", async () => {
    mocks.listExperiences.mockResolvedValue([]);
    mocks.createExperience.mockImplementation(async (input) => ({ ...input, id: "e2", updatedAt: "2026-10-03T01:00:00Z" }));
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "직접 적기" }));
    fireEvent.change(screen.getByLabelText("이 경험을 한 줄로 부르면"), { target: { value: "학회 리서치" } });
    fireEvent.change(screen.getByLabelText("키워드 (쉼표로 구분, 최대 5개)"), { target: { value: "리서치, 협업" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(mocks.createExperience).toHaveBeenCalledWith(expect.objectContaining({
      title: "학회 리서치", tags: ["리서치", "협업"],
    })));
    expect(await screen.findByText("학회 리서치")).toBeTruthy();
  });

  it("한 줄 이름이 비어 있으면 저장하지 않고 안내한다", async () => {
    mocks.listExperiences.mockResolvedValue([]);
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "직접 적기" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("이 경험을 한 줄로 부르는 이름을 적어 주세요.")).toBeTruthy();
    expect(mocks.createExperience).not.toHaveBeenCalled();
  });

  it("경험 100개 한도에 걸리면 한도 안내를 보여 준다", async () => {
    mocks.listExperiences.mockResolvedValue([]);
    mocks.createExperience.mockRejectedValue(new WorkspaceApiError("EXPERIENCE_LIMIT_REACHED", 409));
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "직접 적기" }));
    fireEvent.change(screen.getByLabelText("이 경험을 한 줄로 부르면"), { target: { value: "학회 리서치" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("경험은 100개까지 적어 둘 수 있어요.")).toBeTruthy();
  });

  it("수정하면 바뀐 내용으로 목록을 갱신한다", async () => {
    mocks.updateExperience.mockImplementation(async (id, input) => ({ ...EXP, ...input, id, updatedAt: "2026-10-03T02:00:00Z" }));
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "카페 발주 개선 수정" }));
    fireEvent.change(screen.getByLabelText("이 경험을 한 줄로 부르면"), { target: { value: "카페 폐기율 줄이기" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(mocks.updateExperience).toHaveBeenCalledWith("e1", expect.objectContaining({ title: "카페 폐기율 줄이기" })));
    expect(await screen.findByText("카페 폐기율 줄이기")).toBeTruthy();
    expect(screen.queryByText("카페 발주 개선")).toBeNull();
  });

  it("삭제하면 목록에서 빠진다", async () => {
    mocks.deleteExperience.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "카페 발주 개선 삭제" }));
    await waitFor(() => expect(screen.queryByText("카페 발주 개선")).toBeNull());
    expect(mocks.deleteExperience).toHaveBeenCalledWith("e1");
  });

  it("삭제 확인을 취소하면 아무 일도 없다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "카페 발주 개선 삭제" }));
    expect(mocks.deleteExperience).not.toHaveBeenCalled();
    expect(screen.getByText("카페 발주 개선")).toBeTruthy();
  });

  it("삭제에 실패하면 목록은 그대로 두고 안내한다", async () => {
    mocks.deleteExperience.mockRejectedValue(new Error("boom"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "카페 발주 개선 삭제" }));
    expect(await screen.findByText(/지우지 못했어요/)).toBeTruthy();
    expect(screen.getByText("카페 발주 개선")).toBeTruthy();
  });
});
