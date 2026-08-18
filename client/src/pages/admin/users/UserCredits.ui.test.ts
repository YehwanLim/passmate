import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("beta admin user interface", () => {
  it("does not expose credit granting or coupon application", () => {
    const page = read("client/src/pages/admin/users/UserDetailPage.tsx");
    expect(page).not.toContain("UserCreditManagementCard");
    expect(read("client/src/pages/admin/users/UsersPage.tsx")).not.toContain(
      "무료 이용권 쿠폰 관리"
    );
  });

  it("does not preserve a legacy coupon setting", () => {
    expect(
      read("client/src/pages/admin/settings/SettingsPage.tsx")
    ).not.toContain("passmate_admin_coupons");
  });
});
