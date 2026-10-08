// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestExperienceCandidates: vi.fn(),
  createExperiences: vi.fn(),
}));
vi.mock("@/lib/experienceImport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/experienceImport")>()),
  requestExperienceCandidates: mocks.requestExperienceCandidates,
}));
vi.mock("@/lib/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/workspace")>()),
  createExperiences: mocks.createExperiences,
}));

import ExperienceImportDialog from "./ExperienceImportDialog";

const TEXT = "동아리 추천 서비스의 재방문율을 로그로 분석했습니다. ".repeat(8);
const cand = (title: string, over = {}) => ({
  title, period: "", situation: "상황", action: "한 일", result: "", tags: ["데이터"], quotes: ["재방문율을 로그로 분석했습니다."], ...over,
});

function setup(props: Partial<Parameters<typeof ExperienceImportDialog>[0]> = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<ExperienceImportDialog open existingTitles={["카페 단골 만들기"]} ownedCount={1} onSaved={onSaved} onClose={onClose} {...props} />);
  return { onSaved, onClose };
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("이력서·자소서로 경험 채우기", () => {
  it("200자 미만이면 뽑기 버튼이 막혀 있다", () => {
    setup();
    fireEvent.change(screen.getByLabelText("이력서·자소서 붙여넣기"), { target: { value: "짧은 글" } });
    expect(screen.getByRole("button", { name: "경험 뽑기" })).toHaveProperty("disabled", true);
    expect(screen.getByText("하루 3번까지 무료예요.")).toBeTruthy();
  });

  it("뽑은 후보에서 고른 것만 한꺼번에 저장한다(비슷한 경험은 체크 해제로 시작)", async () => {
    mocks.requestExperienceCandidates.mockResolvedValue({
      kind: "ok",
      remainingToday: 2,
      candidates: [cand("로그로 찾은 이탈 원인"), cand("카페 단골 만들기 3개월")],
    });
    mocks.createExperiences.mockImplementation(async (inputs) => inputs.map((x: object, i: number) => ({ ...x, id: `n${i}`, updatedAt: "" })));
    const { onSaved, onClose } = setup();

    fireEvent.change(screen.getByLabelText("이력서·자소서 붙여넣기"), { target: { value: TEXT } });
    fireEvent.click(screen.getByRole("button", { name: "경험 뽑기" }));

    expect(await screen.findByText("경험 2개를 찾았어요. 저장할 것만 골라 주세요.")).toBeTruthy();
    expect(screen.getByText("오늘 2번 남았어요.")).toBeTruthy();
    expect(screen.getByText("비슷한 경험이 이미 있어요")).toBeTruthy();
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map((b) => b.checked)).toEqual([true, false]);

    fireEvent.click(screen.getByRole("button", { name: "선택한 1개 저장" }));
    await waitFor(() => expect(mocks.createExperiences).toHaveBeenCalledTimes(1));
    expect(mocks.createExperiences.mock.calls[0][0]).toEqual([
      { title: "로그로 찾은 이탈 원인", period: null, situation: "상황", action: "한 일", result: "", tags: ["데이터"] },
    ]);
    expect(onSaved).toHaveBeenCalledWith([expect.objectContaining({ id: "n0" })]);
    expect(onClose).toHaveBeenCalled();
  });

  it("한도를 다 쓰면 안내하고 입력 화면에 머문다", async () => {
    mocks.requestExperienceCandidates.mockResolvedValue({ kind: "rate_limited" });
    setup();
    fireEvent.change(screen.getByLabelText("이력서·자소서 붙여넣기"), { target: { value: TEXT } });
    fireEvent.click(screen.getByRole("button", { name: "경험 뽑기" }));
    expect(await screen.findByText("오늘 가져오기를 다 썼어요. 내일 오전 9시에 다시 쓸 수 있어요.")).toBeTruthy();
    expect(screen.getByLabelText("이력서·자소서 붙여넣기")).toBeTruthy();
  });

  it("0개면 횟수가 차감되지 않았다고 알린다", async () => {
    mocks.requestExperienceCandidates.mockResolvedValue({ kind: "empty", remainingToday: 3 });
    setup();
    fireEvent.change(screen.getByLabelText("이력서·자소서 붙여넣기"), { target: { value: TEXT } });
    fireEvent.click(screen.getByRole("button", { name: "경험 뽑기" }));
    expect(await screen.findByText(/이 글에서는 경험을 찾지 못했어요/)).toBeTruthy();
  });

  it("금고 한도를 넘게 고르면 저장 전에 남은 개수를 알려 준다", async () => {
    mocks.requestExperienceCandidates.mockResolvedValue({ kind: "ok", remainingToday: 2, candidates: [cand("가 경험"), cand("나 경험")] });
    setup({ ownedCount: 99, existingTitles: [] });
    fireEvent.change(screen.getByLabelText("이력서·자소서 붙여넣기"), { target: { value: TEXT } });
    fireEvent.click(screen.getByRole("button", { name: "경험 뽑기" }));
    fireEvent.click(await screen.findByRole("button", { name: "선택한 2개 저장" }));
    expect(await screen.findByText("경험은 100개까지 담을 수 있어요. 지금 1개 더 담을 수 있어요.")).toBeTruthy();
    expect(mocks.createExperiences).not.toHaveBeenCalled();
  });
});
