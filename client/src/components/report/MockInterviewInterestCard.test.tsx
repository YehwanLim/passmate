// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendFunnelEvent: vi.fn() }));
vi.mock("@/lib/siteVisits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/siteVisits")>()),
  sendFunnelEvent: mocks.sendFunnelEvent,
}));

import MockInterviewInterestCard from "./MockInterviewInterestCard";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const openDetails = () => fireEvent.click(screen.getByRole("button", { name: "어떤 건지 보기" }));

describe("리포트 안 모의면접 수요 시험 카드", () => {
  it("처음엔 가격을 보여 주지 않고, 글로 답하는 연습이라고 밝힌다", () => {
    render(<MockInterviewInterestCard />);

    expect(screen.getByText("이 질문들, 직접 답해 보고 싶나요?")).toBeTruthy();
    expect(screen.getByText(/글로 답하면/)).toBeTruthy();
    expect(screen.queryByText(/4,900원/)).toBeNull();
    expect(mocks.sendFunnelEvent).not.toHaveBeenCalled();
  });

  it("보기를 누르면 클릭을 남기고, 아직 없는 기능·가격·결제 없음·수신 동의를 알린다", () => {
    render(<MockInterviewInterestCard />);

    openDetails();

    expect(mocks.sendFunnelEvent).toHaveBeenCalledWith("report_mock_interview_click", "report");
    expect(screen.getByText("아직 만들고 있어요")).toBeTruthy();
    expect(screen.getByText(/1회 4,900원/)).toBeTruthy();
    expect(screen.getByText(/지금 결제되는 건 없어요/)).toBeTruthy();
    expect(screen.getByText(/광고성 정보/)).toBeTruthy();
    expect(mocks.sendFunnelEvent).not.toHaveBeenCalledWith("report_mock_interview_apply", expect.anything());
  });

  it("알려 주세요를 누르고 기록되면 신청 완료로 바뀐다", async () => {
    mocks.sendFunnelEvent.mockResolvedValue(true);
    render(<MockInterviewInterestCard />);

    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "알려 주세요" }));

    expect(await screen.findByText("신청했어요")).toBeTruthy();
    expect(mocks.sendFunnelEvent).toHaveBeenCalledWith("report_mock_interview_apply", "report");
    expect(screen.queryByRole("button", { name: "알려 주세요" })).toBeNull();
  });

  it("기록에 실패하면 완료라고 말하지 않고 다시 누르게 한다", async () => {
    mocks.sendFunnelEvent.mockResolvedValue(false);
    render(<MockInterviewInterestCard trackingActive />);

    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "알려 주세요" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("신청했어요")).toBeNull();
    expect((screen.getByRole("button", { name: "알려 주세요" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("기록을 보내지 않는 환경(개발 서버·운영자 브라우저)에선 실패로 치지 않는다", async () => {
    mocks.sendFunnelEvent.mockResolvedValue(false);
    render(<MockInterviewInterestCard trackingActive={false} />);

    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "알려 주세요" }));

    expect(await screen.findByText("신청했어요")).toBeTruthy();
  });

  it("괜찮아요를 누르면 카드가 사라지고 신청은 남지 않는다", () => {
    render(<MockInterviewInterestCard />);

    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "괜찮아요" }));

    expect(screen.queryByText("아직 만들고 있어요")).toBeNull();
    expect(screen.queryByRole("button", { name: "알려 주세요" })).toBeNull();
    expect(mocks.sendFunnelEvent).not.toHaveBeenCalledWith("report_mock_interview_apply", expect.anything());
  });
});
