// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/components/ui/tabs", async () => {
  const { createElement: element } = await import("react");
  const Container = ({ children }: { children?: ReactNode }) => element("div", null, children);

  return {
    Tabs: Container,
    TabsContent: Container,
    TabsList: Container,
    TabsTrigger: Container,
  };
});

import SettingsPage from "./SettingsPage";

const storage = new Map<string, string>();

describe("SettingsPage feature flags", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      get length() {
        return storage.size;
      },
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not offer a local payment-module switch in Feature Flag settings", async () => {
    render(createElement(SettingsPage));

    expect(screen.getByText("AI 상세 피드백 Beta")).toBeTruthy();
    expect(screen.getByText("AI 리라이트(Rewrite) 개선 엔진 v2")).toBeTruthy();
    expect(screen.queryByText("결제 모듈 활성화")).toBeNull();
  });
});
