import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("admin payment history", () => {
  it("replaces the placeholder card on the user detail page", () => {
    const page = read("client/src/pages/admin/users/UserDetailPage.tsx");

    expect(page).toContain("UserPaymentsCard");
    // 결제 테이블이 없다는 옛 안내는 사실이 아니게 됐다.
    expect(page).not.toContain("추후 구현 예정");
    expect(page).not.toContain("결제 테이블이 없어");
  });

  it("labels every amount as an estimate because the amount is not stored", () => {
    const card = read("client/src/components/admin/users/UserPaymentsCard.tsx");

    expect(card).toContain("estimatedAmountFor");
    expect(card).toContain("productLabel");
    expect(card).toContain("추정");
  });

  it("separates completed payments from abandoned checkout attempts", () => {
    const card = read("client/src/components/admin/users/UserPaymentsCard.tsx");

    expect(card).toContain("pending_purchases");
    expect(card).toContain("결제 시도");
  });

  it("carries the payment projection through the detail hook types", () => {
    const hook = read("client/src/hooks/admin/useUserDetail.ts");

    expect(hook).toContain("payments");
    expect(hook).toContain("pending_purchases");
    expect(hook).toContain("credits_granted");
  });

  it("shows a purchase count column in the users table", () => {
    const table = read("client/src/components/admin/users/UsersTable.tsx");

    expect(table).toContain("payment_count");
    expect(table).toContain("구매");
  });

  it("surfaces the payment summary on the admin dashboard", () => {
    const grid = read("client/src/components/admin/dashboard/KpiGrid.tsx");

    expect(grid).toContain("paymentSummary");
    expect(grid).toContain("추정");
  });
});
