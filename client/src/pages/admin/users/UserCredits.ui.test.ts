import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("admin user credit management UI", () => {
  it("keeps credit granting and coupon application in the user detail page", () => {
    const page = read("client/src/pages/admin/users/UserDetailPage.tsx");
    const card = read(
      "client/src/components/admin/users/UserCreditManagementCard.tsx"
    );
    expect(page).toContain("UserCreditManagementCard");
    expect(card).toContain("직접 지급");
    expect(card).toContain("쿠폰 적용");
    expect(card).toContain("지급 이력");
  });

  it("moves coupon management out of Settings into Users", () => {
    expect(read("client/src/pages/admin/users/UsersPage.tsx")).toContain(
      "무료 이용권 쿠폰 관리"
    );
    expect(
      read("client/src/pages/admin/settings/SettingsPage.tsx")
    ).not.toContain("passmate_admin_coupons");
  });
});
