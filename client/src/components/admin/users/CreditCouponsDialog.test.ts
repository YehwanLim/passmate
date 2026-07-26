// @vitest-environment jsdom

import { createElement } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CreditCoupon } from "@/lib/admin-credits";
import * as couponDialogModule from "./CreditCouponsDialog";

vi.mock("@/components/ui/dialog", async () => {
  const { createElement } = await import("react");
  const Wrapper = ({ children }: { children?: React.ReactNode }) =>
    createElement("div", null, children);
  return {
    Dialog: Wrapper,
    DialogContent: Wrapper,
    DialogDescription: Wrapper,
    DialogFooter: Wrapper,
    DialogHeader: Wrapper,
    DialogTitle: Wrapper,
    useDialogComposition: () => ({
      isComposing: () => false,
      setComposing: () => undefined,
      justEndedComposing: () => false,
      markCompositionEnd: () => undefined,
    }),
  };
});

vi.mock("@/components/ui/switch", async () => {
  const { createElement } = await import("react");
  return {
    Switch: ({
      checked,
      onCheckedChange,
      ...props
    }: {
      checked: boolean;
      onCheckedChange: (checked: boolean) => void;
      [key: string]: unknown;
    }) =>
      createElement("button", {
        ...props,
        type: "button",
        onClick: () => onCheckedChange(!checked),
      }),
  };
});

describe("credit coupon creation", () => {
  it("submits the actual dialog form with inactive state in one create", async () => {
    const created: CreditCoupon = {
      id: "coupon-id",
      code: "INACTIVE_2",
      creditsGranted: 2,
      maxUses: null,
      usedCount: 0,
      expiresAt: null,
      isActive: false,
      createdAt: "2026-07-26T00:00:00.000Z",
      updatedAt: "2026-07-26T00:00:00.000Z",
    };
    const onCreate = vi.fn().mockResolvedValue(created);
    const onUpdate = vi.fn();
    const onOpenChange = vi.fn();
    const { container } = render(
      createElement(couponDialogModule.CreditCouponsDialog, {
        open: true,
        onOpenChange,
        coupons: [],
        onCreate,
        onUpdate,
      })
    );

    fireEvent.change(container.querySelector("#coupon-code")!, {
      target: { value: "inactive_2" },
    });
    fireEvent.change(container.querySelector("#coupon-credits")!, {
      target: { value: "2" },
    });
    fireEvent.click(container.querySelector("#coupon-active")!);
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onCreate).toHaveBeenCalledWith({
      code: "INACTIVE_2",
      creditsGranted: 2,
      maxUses: null,
      expiresAt: null,
      isActive: false,
    });
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
