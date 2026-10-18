// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listExperiences: vi.fn(),
  sendFunnelEvent: vi.fn(),
  dialogProps: vi.fn(),
}));
vi.mock("@/lib/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/workspace")>()),
  listExperiences: mocks.listExperiences,
}));
vi.mock("@/lib/siteVisits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/siteVisits")>()),
  sendFunnelEvent: mocks.sendFunnelEvent,
}));
// 창 자체는 ExperienceImportDialog.test 가 본다. 여기선 무엇을 넘겨 여는지와 저장 뒤 카드만 본다.
vi.mock("@/components/my/ExperienceImportDialog", () => ({
  default: (props: { open: boolean; initialText?: string; onSaved: (created: unknown[]) => void; onClose: () => void }) => {
    mocks.dialogProps(props);
    if (!props.open) return null;
    return (
      <button type="button" onClick={() => { props.onSaved([{ id: "a" }, { id: "b" }]); props.onClose(); }}>
        가짜 저장
      </button>
    );
  },
}));

import SaveExperiencesCard, { resumeTextForExtract } from "./SaveExperiencesCard";

const ANSWER = "동아리 추천 서비스의 재방문율이 낮아 화면별 로그를 직접 모았습니다. ".repeat(6).trim();
const INPUT = `[문항 1]\n${ANSWER}\n\n[문항 2]\n${ANSWER}`;

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("resumeTextForExtract", () => {
  it("[문항 N] 표시를 지우고 답변만 이어 붙인다", () => {
    expect(resumeTextForExtract(INPUT)).toBe(`${ANSWER}\n\n${ANSWER}`);
  });

  it("200자보다 짧으면 빈 문자열(카드를 숨긴다)", () => {
    expect(resumeTextForExtract("[문항 1]\n짧은 답변")).toBe("");
    expect(resumeTextForExtract(null)).toBe("");
  });

  it("가져오기 한도(2만 자)보다 길면 잘라 보낸다", () => {
    expect(resumeTextForExtract("가".repeat(25000))).toHaveLength(20000);
  });
});

describe("리포트 끝 경험 저장 카드", () => {
  it("누르면 지금 경험 목록을 읽고, 리포트 원문으로 가져오기 창을 연다", async () => {
    mocks.listExperiences.mockResolvedValue([{ id: "e1", title: "카페 단골 만들기" }]);
    render(<SaveExperiencesCard resumeText={ANSWER} />);

    fireEvent.click(screen.getByRole("button", { name: "경험 저장해 두기" }));

    await screen.findByRole("button", { name: "가짜 저장" });
    expect(mocks.sendFunnelEvent).toHaveBeenCalledWith("report_experience_save_click", "report");
    expect(mocks.dialogProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: true, initialText: ANSWER, existingTitles: ["카페 단골 만들기"], ownedCount: 1 }),
    );
  });

  it("저장하면 카드가 저장 개수와 내 경험 링크로 바뀐다", async () => {
    mocks.listExperiences.mockResolvedValue([]);
    render(<SaveExperiencesCard resumeText={ANSWER} />);

    fireEvent.click(screen.getByRole("button", { name: "경험 저장해 두기" }));
    fireEvent.click(await screen.findByRole("button", { name: "가짜 저장" }));

    expect(await screen.findByText("경험 2개를 저장했어요")).toBeTruthy();
    expect(screen.getByRole("link", { name: /내 경험 보기/ }).getAttribute("href")).toBe("/my#experiences");
    expect(screen.queryByRole("button", { name: "경험 저장해 두기" })).toBeNull();
    expect(mocks.sendFunnelEvent).toHaveBeenCalledWith("report_experience_saved", "2");
  });

  it("경험 목록을 못 읽으면 창을 열지 않고 다시 눌러 달라고 한다", async () => {
    mocks.listExperiences.mockRejectedValue(new Error("network"));
    render(<SaveExperiencesCard resumeText={ANSWER} />);

    fireEvent.click(screen.getByRole("button", { name: "경험 저장해 두기" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("button", { name: "가짜 저장" })).toBeNull());
    expect((screen.getByRole("button", { name: "경험 저장해 두기" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
