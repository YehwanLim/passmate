import { describe, expect, it, vi } from "vitest";
import type {
  CreateCreditCouponInput,
  CreditCoupon,
} from "@/lib/admin-credits";
import * as couponDialogModule from "./CreditCouponsDialog";

describe("credit coupon creation", () => {
  it("provides the atomic creation operation used by the dialog", () => {
    expect(couponDialogModule).toHaveProperty("createCouponAtomically");
  });

  it("persists an inactive coupon with exactly one create call", async () => {
    const created: CreditCoupon = {
      id: "coupon-id",
      code: "WELCOME_2",
      creditsGranted: 2,
      maxUses: null,
      usedCount: 0,
      expiresAt: null,
      isActive: false,
      createdAt: "2026-07-26T00:00:00.000Z",
      updatedAt: "2026-07-26T00:00:00.000Z",
    };
    const onCreate = vi.fn().mockResolvedValue(created);
    const input = {
      code: "WELCOME_2",
      creditsGranted: 2,
      maxUses: null,
      expiresAt: null,
      isActive: false,
    } as CreateCreditCouponInput;
    const createAtomically =
      couponDialogModule.createCouponAtomically as unknown as (
        create: (value: CreateCreditCouponInput) => Promise<CreditCoupon>,
        value: CreateCreditCouponInput
      ) => Promise<CreditCoupon>;

    await expect(createAtomically(onCreate, input)).resolves.toEqual(created);
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledWith(input);
  });
});
