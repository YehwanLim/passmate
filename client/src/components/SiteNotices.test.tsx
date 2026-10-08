// @vitest-environment jsdom

import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

import { SiteNotices } from "./SiteNotices";

const banner = { id: "b1", kind: "BANNER", title: "10월 점검 안내", body: "새벽 2시~3시", linkUrl: "/guide", linkLabel: "자세히", imageUrl: null };
const popup = { id: "p1", kind: "POPUP", title: "이벤트", body: "첫 분석 무료", linkUrl: null, linkLabel: null, imageUrl: null };

function renderAt(path: string) {
  const { hook } = memoryLocation({ path });
  return render(createElement(Router, { hook, children: createElement(SiteNotices) }));
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  };
}

describe("SiteNotices", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ banner, popup }), { status: 200, headers: { "content-type": "application/json" } })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("배너와 팝업을 띄우고, 오늘 하루 보지 않기를 누르면 팝업이 닫히고 기억된다", async () => {
    renderAt("/");
    await waitFor(() => expect(screen.getByText("10월 점검 안내")).toBeTruthy());
    expect(screen.getByText("자세히").getAttribute("href")).toBe("/guide");
    expect(screen.getByText("이벤트")).toBeTruthy();

    fireEvent.click(screen.getByText("오늘 하루 보지 않기"));
    await waitFor(() => expect(screen.queryByText("이벤트")).toBeNull());
    expect(window.localStorage.getItem("preview.notice.hideUntil.p1")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("공지 닫기"));
    expect(screen.queryByText("10월 점검 안내")).toBeNull();
    expect(window.sessionStorage.getItem("preview.notice.closed.b1")).toBe("1");
  });

  it("관리자 화면에서는 공지를 받아 오지도 않는다", () => {
    renderAt("/admin/notices");
    expect(fetch).not.toHaveBeenCalled();
  });
});
