// @vitest-environment jsdom

import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const apiMocks = vi.hoisted(() => ({
  fetchPremiumSalesSettings: vi.fn(),
  updatePremiumSalesEnabled: vi.fn(),
}));

vi.mock("@/lib/admin-entitlements", () => apiMocks);

vi.mock("@/components/ui/switch", async () => {
  const { createElement: element } = await import("react");
  return {
    Switch: ({
      checked,
      disabled,
      id,
      onCheckedChange,
    }: {
      checked: boolean;
      disabled?: boolean;
      id?: string;
      onCheckedChange: (next: boolean) => void;
    }) => element("input", {
      checked,
      disabled,
      id,
      onChange: () => onCheckedChange(!checked),
      type: "checkbox",
    }),
  };
});

vi.mock("@/components/ui/alert-dialog", async () => {
  const { createElement: element } = await import("react");
  const PassThrough = ({ children }: { children?: React.ReactNode }) => element("div", null, children);
  return {
    AlertDialog: ({ open, children }: { open: boolean; children?: React.ReactNode }) => (
      open ? element("div", { role: "dialog" }, children) : null
    ),
    AlertDialogAction: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
      element("button", { onClick, type: "button" }, children)
    ),
    AlertDialogCancel: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
      element("button", { onClick, type: "button" }, children)
    ),
    AlertDialogContent: PassThrough,
    AlertDialogDescription: PassThrough,
    AlertDialogFooter: PassThrough,
    AlertDialogHeader: PassThrough,
    AlertDialogTitle: PassThrough,
  };
});

import PaymentsPage from "./PaymentsPage";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("PaymentsPage premium sales control", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("requires confirmation before disabling new premium sales", async () => {
    apiMocks.fetchPremiumSalesSettings.mockResolvedValue({ premiumEnabled: true });
    apiMocks.updatePremiumSalesEnabled.mockResolvedValue({ premiumEnabled: false });
    const { container } = render(createElement(PaymentsPage));

    await waitFor(() => expect(screen.getByText("판매 중")).toBeTruthy());
    fireEvent.click(container.querySelector("#premium-sales-toggle")!);

    expect(screen.getByText("결제 판매를 중지할까요?")).toBeTruthy();
    expect(apiMocks.updatePremiumSalesEnabled).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "판매 중지" }));
    await waitFor(() => {
      expect(apiMocks.updatePremiumSalesEnabled).toHaveBeenCalledWith(false);
    });
    expect(screen.getByText("판매 중지")).toBeTruthy();
  });

  it("keeps the last confirmed setting after a failed enable", async () => {
    apiMocks.fetchPremiumSalesSettings.mockResolvedValue({ premiumEnabled: false });
    apiMocks.updatePremiumSalesEnabled.mockRejectedValue(new Error("저장 실패"));
    const { container } = render(createElement(PaymentsPage));

    await waitFor(() => expect(screen.getByText("판매 중지")).toBeTruthy());
    fireEvent.click(container.querySelector("#premium-sales-toggle")!);

    await waitFor(() => expect(screen.getByText("저장 실패")).toBeTruthy());
    expect(container.querySelector("#premium-sales-toggle")).toHaveProperty("checked", false);
  });

  it("reloads the persisted state when an update fails", async () => {
    apiMocks.fetchPremiumSalesSettings
      .mockResolvedValueOnce({ premiumEnabled: false })
      .mockResolvedValueOnce({ premiumEnabled: true });
    apiMocks.updatePremiumSalesEnabled.mockRejectedValue(new Error("저장 실패"));
    const { container } = render(createElement(PaymentsPage));

    await waitFor(() => expect(screen.getByText("판매 중지")).toBeTruthy());
    fireEvent.click(container.querySelector("#premium-sales-toggle")!);
    await waitFor(() => expect(screen.getByText("저장 실패")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(screen.getByText("판매 중")).toBeTruthy());
    expect(apiMocks.fetchPremiumSalesSettings).toHaveBeenCalledTimes(2);
  });

  it("disables the control while a sales update is pending", async () => {
    const update = deferred<{ premiumEnabled: boolean }>();
    apiMocks.fetchPremiumSalesSettings.mockResolvedValue({ premiumEnabled: false });
    apiMocks.updatePremiumSalesEnabled.mockReturnValue(update.promise);
    const { container } = render(createElement(PaymentsPage));

    await waitFor(() => expect(screen.getByText("판매 중지")).toBeTruthy());
    fireEvent.click(container.querySelector("#premium-sales-toggle")!);

    expect(container.querySelector("#premium-sales-toggle")).toHaveProperty("disabled", true);
    update.resolve({ premiumEnabled: true });
    await waitFor(() => expect(screen.getByText("판매 중")).toBeTruthy());
  });

  it("shows a retry action instead of an editable unknown state when loading fails", async () => {
    apiMocks.fetchPremiumSalesSettings
      .mockRejectedValueOnce(new Error("조회 실패"))
      .mockResolvedValueOnce({ premiumEnabled: true });
    const { container } = render(createElement(PaymentsPage));

    await waitFor(() => expect(screen.getByText("조회 실패")).toBeTruthy());
    expect(container.querySelector("#premium-sales-toggle")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(screen.getByText("판매 중")).toBeTruthy());
    expect(apiMocks.fetchPremiumSalesSettings).toHaveBeenCalledTimes(2);
  });
});
