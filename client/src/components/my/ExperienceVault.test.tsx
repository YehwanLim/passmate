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
  id: "e1", title: "카페 발주 개선", period: "2025.03~2025.08", situation: "",
  action: "판매 데이터로 발주 조정", result: "폐기 30% 감소", tags: ["데이터", "카페", "운영"], updatedAt: "2026-10-03T00:00:00Z",
};
const EXP2 = {
  id: "e2", title: "학회 카드뉴스 저장 수 분석", period: null, situation: "반응이 들쭉날쭉",
  action: "저장 수를 표로 정리", result: "", tags: ["데이터", "콘텐츠"], updatedAt: "2026-10-02T00:00:00Z",
};
const list = () => screen.getByRole("list", { name: "경험 목록" });
const listTitles = () => within(list()).getAllByRole("button").map((b) => b.querySelector("span")?.textContent);
const detail = () => screen.getByRole("article");

beforeEach(() => mocks.listExperiences.mockResolvedValue([EXP]));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

describe("내 경험", () => {
  it("빈 금고에서는 가운데에만 가져오기 버튼을 두고, 누르면 창이 열린다", async () => {
    mocks.listExperiences.mockResolvedValue([]);
    render(<ExperienceVault />);
    await screen.findByText(/아직 적어 둔 경험이 없어요/);
    const buttons = screen.getAllByRole("button", { name: "이력서·자소서로 자동 추가" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    const dialog = screen.getByRole("dialog", { name: "이력서·자소서로 자동 추가" });
    expect(within(dialog).getByRole("region", { name: "예시" })).toBeTruthy();
  });

  it("왼쪽 목록은 이름·짧은 기간·키워드 앞 2개(+나머지 수), 기간이 없으면 기간 줄이 없다", async () => {
    mocks.listExperiences.mockResolvedValue([EXP, EXP2]);
    render(<ExperienceVault onCountChange={vi.fn()} />);
    await screen.findByRole("list", { name: "경험 목록" });
    const [first, second] = within(list()).getAllByRole("button");
    expect(within(first).getByText("25.03 – 25.08")).toBeTruthy();
    expect(within(first).getByText("데이터")).toBeTruthy();
    expect(within(first).getByText("카페")).toBeTruthy();
    expect(within(first).queryByText("운영")).toBeNull();
    expect(within(first).getByText("+1")).toBeTruthy();
    expect(second.textContent).not.toMatch(/\d{2}\.\d{2}/);
  });

  it("처음엔 첫 경험을 오른쪽에 자세히 보여 주고, 채운 칸만 나온다", async () => {
    mocks.listExperiences.mockResolvedValue([EXP, EXP2]);
    render(<ExperienceVault />);
    await screen.findByRole("article");
    expect(within(detail()).getByRole("heading", { name: "카페 발주 개선" })).toBeTruthy();
    expect(within(detail()).getByText("내가 한 일")).toBeTruthy();
    expect(within(detail()).getByText("폐기 30% 감소")).toBeTruthy();
    expect(within(detail()).queryByText("상황")).toBeNull();
    fireEvent.click(within(list()).getAllByRole("button")[1]);
    expect(within(detail()).getByRole("heading", { name: "학회 카드뉴스 저장 수 분석" })).toBeTruthy();
    expect(within(detail()).getByText("상황")).toBeTruthy();
    expect(within(detail()).queryByText("결과")).toBeNull();
  });

  it("키워드 캡슐과 찾기로 거른다", async () => {
    mocks.listExperiences.mockResolvedValue([EXP, EXP2]);
    render(<ExperienceVault />);
    await screen.findByRole("list", { name: "경험 목록" });
    const group = screen.getByRole("group", { name: "키워드" });
    // 자주 쓴 키워드가 먼저
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["전체", "데이터", "운영", "카페", "콘텐츠"]);
    fireEvent.click(within(group).getByRole("button", { name: "콘텐츠" }));
    expect(listTitles()).toEqual(["학회 카드뉴스 저장 수 분석"]);
    fireEvent.click(within(group).getByRole("button", { name: "전체" }));
    fireEvent.change(screen.getByLabelText("경험 이름이나 내용으로 찾기"), { target: { value: "폐기" } });
    expect(listTitles()).toEqual(["카페 발주 개선"]);
    fireEvent.change(screen.getByLabelText("경험 이름이나 내용으로 찾기"), { target: { value: "없는 말" } });
    expect(screen.getAllByText("찾는 경험이 없어요.").length).toBeGreaterThan(0);
  });

  it("키워드가 5개를 넘으면 나머지는 '더 보기'로 접는다", async () => {
    mocks.listExperiences.mockResolvedValue([{ ...EXP, tags: ["가", "나", "다", "라", "마"] }, { ...EXP2, tags: ["바", "사"] }]);
    render(<ExperienceVault />);
    const group = await screen.findByRole("group", { name: "키워드" });
    expect(within(group).queryByRole("button", { name: "사" })).toBeNull();
    fireEvent.click(within(group).getByRole("button", { name: "+2 더 보기" }));
    expect(within(group).getByRole("button", { name: "사" })).toBeTruthy();
  });

  it("가져와 저장한 경험이 목록 맨 위에 붙는다", async () => {
    importMocks.requestExperienceCandidates.mockResolvedValue({
      kind: "ok", remainingToday: 2,
      candidates: [{ title: "로그로 찾은 이탈 원인", period: "", situation: "s", action: "a", result: "r", tags: [], quotes: ["원문 문장입니다 여기"] }],
    });
    mocks.createExperiences.mockImplementation(async (inputs: object[]) => inputs.map((x, i) => ({ ...x, id: `n${i}`, updatedAt: "" })));
    render(<ExperienceVault />);
    await screen.findByRole("list", { name: "경험 목록" });
    fireEvent.click(screen.getByRole("button", { name: "이력서·자소서로 자동 추가" }));
    fireEvent.change(screen.getByLabelText("이력서·자소서 붙여넣기"), { target: { value: "가".repeat(220) } });
    fireEvent.click(screen.getByRole("button", { name: "경험 뽑기" }));
    fireEvent.click(await screen.findByRole("button", { name: "선택한 1개 저장" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(listTitles()).toEqual(["로그로 찾은 이탈 원인", "카페 발주 개선"]);
  });

  it("불러오기에 실패하면 안내를 보여 준다", async () => {
    mocks.listExperiences.mockRejectedValue(new Error("boom"));
    render(<ExperienceVault />);
    expect(await screen.findByText(/경험을 불러오지 못했어요/)).toBeTruthy();
  });

  it("새 경험: 키워드는 Enter 로 캡슐을 쌓아 보내고, 저장하면 목록 맨 위·오른쪽에 보인다", async () => {
    mocks.createExperience.mockImplementation(async (input) => ({ ...input, id: "e9", updatedAt: "2026-10-03T01:00:00Z" }));
    const onCountChange = vi.fn();
    render(<ExperienceVault onCountChange={onCountChange} />);
    fireEvent.click(await screen.findByRole("button", { name: "+ 직접 추가" }));
    fireEvent.change(screen.getByLabelText("경험 이름"), { target: { value: "학회 리서치" } });
    const tagInput = screen.getByLabelText("키워드 (최대 5개)");
    fireEvent.change(tagInput, { target: { value: "리서치" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
    fireEvent.change(screen.getByLabelText("키워드 (최대 5개)"), { target: { value: "협업" } });
    fireEvent.keyDown(screen.getByLabelText("키워드 (최대 5개)"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "리서치 키워드 빼기" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(mocks.createExperience).toHaveBeenCalledWith(expect.objectContaining({ title: "학회 리서치", tags: ["협업"] })));
    await waitFor(() => expect(listTitles()[0]).toBe("학회 리서치"));
    expect(within(detail()).getByRole("heading", { name: "학회 리서치" })).toBeTruthy();
    expect(onCountChange).toHaveBeenLastCalledWith(2);
  });

  it("새로 적기는 자유 양식이 기본 — 글 한 칸만 있고, 저장하면 body 로 보내고 칸은 비운다", async () => {
    mocks.createExperience.mockImplementation(async (input) => ({ ...input, id: "e9", updatedAt: "" }));
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "+ 직접 추가" }));
    expect(screen.queryByLabelText("어떤 상황이었나요")).toBeNull();
    fireEvent.change(screen.getByLabelText("경험 이름"), { target: { value: "오답 노트 습관" } });
    fireEvent.change(screen.getByLabelText("어떤 경험이었나요"), { target: { value: "틀린 문제를 유형별로 정리했다." } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(mocks.createExperience).toHaveBeenCalledWith(expect.objectContaining({
      title: "오답 노트 습관", body: "틀린 문제를 유형별로 정리했다.", situation: "", action: "", result: "",
    })));
    // 자세히에는 글 그대로(칸 이름 없이)
    await waitFor(() => expect(within(detail()).getByText("틀린 문제를 유형별로 정리했다.")).toBeTruthy());
    expect(within(detail()).queryByText("내가 한 일")).toBeNull();
  });

  it("'칸 나눠 쓰기'로 바꾸면 쓴 글이 '내가 한 일'로 옮겨지고, 다시 바꾸면 채운 칸을 이어 붙인다", async () => {
    mocks.createExperience.mockImplementation(async (input) => ({ ...input, id: "e9", updatedAt: "" }));
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "+ 직접 추가" }));
    fireEvent.change(screen.getByLabelText("경험 이름"), { target: { value: "학회 리서치" } });
    fireEvent.change(screen.getByLabelText("어떤 경험이었나요"), { target: { value: "설문 120건을 정리했다." } });
    fireEvent.click(screen.getByRole("button", { name: "칸 나눠 쓰기" }));
    expect((screen.getByLabelText("나는 무엇을 판단하고 했나요") as HTMLTextAreaElement).value).toBe("설문 120건을 정리했다.");
    fireEvent.change(screen.getByLabelText("어떤 상황이었나요"), { target: { value: "응답이 흩어져 있었다." } });
    fireEvent.click(screen.getByRole("button", { name: "한 칸에 자유롭게 쓰기" }));
    expect((screen.getByLabelText("어떤 경험이었나요") as HTMLTextAreaElement).value).toBe("응답이 흩어져 있었다.\n\n설문 120건을 정리했다.");
    fireEvent.click(screen.getByRole("button", { name: "칸 나눠 쓰기" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(mocks.createExperience).toHaveBeenCalledWith(expect.objectContaining({ body: "" })));
  });

  it("칸으로 쓴 경험을 고치면 칸으로, 자유 글로 쓴 경험은 자유 양식으로 열린다", async () => {
    mocks.listExperiences.mockResolvedValue([EXP, { ...EXP2, situation: "", action: "", result: "", body: "자유 글" }]);
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "카페 발주 개선 더보기" }));
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect((screen.getByLabelText("나는 무엇을 판단하고 했나요") as HTMLTextAreaElement).value).toBe("판매 데이터로 발주 조정");
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(within(list()).getAllByRole("button")[1]);
    expect(within(detail()).getByText("자유 글")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "학회 카드뉴스 저장 수 분석 더보기" }));
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect((screen.getByLabelText("어떤 경험이었나요") as HTMLTextAreaElement).value).toBe("자유 글");
  });

  it("빈 금고의 '직접 추가'로 적고, 이름이 비면 저장하지 않는다", async () => {
    mocks.listExperiences.mockResolvedValue([]);
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "직접 추가" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("경험 이름을 적어 주세요.")).toBeTruthy();
    expect(mocks.createExperience).not.toHaveBeenCalled();
  });

  it("경험 100개 한도에 걸리면 한도 안내를 보여 준다", async () => {
    mocks.createExperience.mockRejectedValue(new WorkspaceApiError("EXPERIENCE_LIMIT_REACHED", 409));
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "+ 직접 추가" }));
    fireEvent.change(screen.getByLabelText("경험 이름"), { target: { value: "학회 리서치" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("경험은 100개까지 적어 둘 수 있어요.")).toBeTruthy();
  });

  it("⋯ → 수정하면 바뀐 내용으로 목록과 자세히를 갱신한다", async () => {
    mocks.updateExperience.mockImplementation(async (id, input) => ({ ...EXP, ...input, id, updatedAt: "2026-10-03T02:00:00Z" }));
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "카페 발주 개선 더보기" }));
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("경험 이름"), { target: { value: "카페 폐기율 줄이기" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(mocks.updateExperience).toHaveBeenCalledWith("e1", expect.objectContaining({ title: "카페 폐기율 줄이기" })));
    await waitFor(() => expect(listTitles()).toEqual(["카페 폐기율 줄이기"]));
    expect(within(detail()).getByRole("heading", { name: "카페 폐기율 줄이기" })).toBeTruthy();
  });

  it("⋯ → 삭제하면 목록에서 빠진다", async () => {
    mocks.listExperiences.mockResolvedValue([EXP, EXP2]);
    mocks.deleteExperience.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "카페 발주 개선 더보기" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(listTitles()).toEqual(["학회 카드뉴스 저장 수 분석"]));
    expect(mocks.deleteExperience).toHaveBeenCalledWith("e1");
  });

  it("삭제 확인을 취소하면 아무 일도 없다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "카페 발주 개선 더보기" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(mocks.deleteExperience).not.toHaveBeenCalled();
    expect(listTitles()).toEqual(["카페 발주 개선"]);
  });

  it("삭제에 실패하면 목록은 그대로 두고 안내한다", async () => {
    mocks.deleteExperience.mockRejectedValue(new Error("boom"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ExperienceVault />);
    fireEvent.click(await screen.findByRole("button", { name: "카페 발주 개선 더보기" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(await screen.findByText(/삭제하지 못했어요/)).toBeTruthy();
    expect(listTitles()).toEqual(["카페 발주 개선"]);
  });
});
