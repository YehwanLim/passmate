// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import InAppBrowserNotice from "./InAppBrowserNotice";

const URL_ = "https://pre-view.me/analyze";
const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID = "Mozilla/5.0 (Linux; Android 13; SM-S908N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

describe("InAppBrowserNotice", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("어느 앱인지 말해 주고, 카카오톡은 외부 브라우저 열기 링크를 준다", () => {
    render(<InAppBrowserNotice kind="kakaotalk" url={URL_} userAgent={`${IOS} KAKAOTALK 10.4.0`} />);

    expect(screen.getByText(/카카오톡 안의 브라우저/)).toBeTruthy();
    expect(screen.getByText(/Google 로그인이 막혀/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "외부 브라우저로 열기" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(`kakaotalk://web/openExternal?url=${encodeURIComponent(URL_)}`);
  });

  it("Android 인앱은 Chrome intent 링크를 준다", () => {
    render(<InAppBrowserNotice kind="instagram" url={URL_} userAgent={`${ANDROID} Instagram 300.0.0.0`} />);

    const link = screen.getByRole("link", { name: "외부 브라우저로 열기" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")?.startsWith("intent://pre-view.me/analyze#Intent;")).toBe(true);
  });

  it("iOS 의 다른 앱은 링크 복사 버튼과 메뉴 안내로 대신하고, 누르면 주소를 복사한다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<InAppBrowserNotice kind="instagram" url={URL_} userAgent={`${IOS} Instagram 300.0.0.0`} />);

    expect(screen.queryByRole("link", { name: "외부 브라우저로 열기" })).toBeNull();
    expect(screen.getByText(/브라우저에서 열기/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
    expect(writeText).toHaveBeenCalledWith(URL_);
    await waitFor(() => expect(screen.getByText("복사했어요")).toBeTruthy());
  });
});
