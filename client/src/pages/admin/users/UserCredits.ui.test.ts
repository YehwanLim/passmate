import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("admin user credit management", () => {
  it("exposes the credit management card on the user detail page", () => {
    const page = read("client/src/pages/admin/users/UserDetailPage.tsx");
    expect(page).toContain("UserCreditManagementCard");
    expect(page).toContain("userId={userId}");
  });

  it("grants bonus credits that work regardless of the premium sales switch", () => {
    const card = read(
      "client/src/components/admin/users/UserCreditManagementCard.tsx"
    );
    expect(card).toContain("bonusRemaining");
    expect(card).toContain("크레딧 지급");
    expect(read("client/src/lib/admin-credits.ts")).toContain("/api/admin/credits");
  });

  it("does not resurrect the coupon feature", () => {
    const page = read("client/src/pages/admin/users/UserDetailPage.tsx");
    expect(page).not.toContain("CreditCouponsDialog");
    expect(read("client/src/pages/admin/users/UsersPage.tsx")).not.toContain(
      "무료 이용권 쿠폰 관리"
    );
    expect(
      read("client/src/pages/admin/settings/SettingsPage.tsx")
    ).not.toContain("passmate_admin_coupons");
  });
});
