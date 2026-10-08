import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const root = new URL("../../../../", import.meta.url);
// 관리자 데이터는 adminApiFetch(lib/adminApi.ts) 한 통로로만 나간다. 목록·스냅샷 훅은
// 그 위에 얹힌 useAdminPagedResource / useAdminResource 를 거쳐도 된다.
const ADMIN_TRANSPORT = /adminApiFetch|useAdminResource|useAdminPagedResource/;
const adminDataSources = [
  "client/src/hooks/admin/useAdminResource.ts",
  "client/src/hooks/admin/useAdminPagedResource.ts",
  "client/src/hooks/admin/useDashboardData.ts",
  "client/src/hooks/admin/useUsersData.ts",
  "client/src/hooks/admin/useUserDetail.ts",
  "client/src/hooks/admin/useAnalysisDetail.ts",
  "client/src/hooks/admin/useAnalysesData.ts",
  "client/src/hooks/admin/useAiUsageData.ts",
  "client/src/hooks/admin/useErrorLogs.ts",
  "client/src/hooks/admin/useBehaviorData.ts",
  "client/src/hooks/admin/useAdminNotifications.ts",
  "client/src/hooks/admin/usePrompts.ts",
  "client/src/pages/admin/ai-models/AiModelsPage.tsx",
  "client/src/pages/admin/notices/NoticesPage.tsx",
];

function source(path: string) {
  return readFileSync(new URL(path, root), "utf8");
}

describe("admin client server boundary", () => {
  it("keeps Supabase table reads and writes out of admin data hooks and pages", () => {
    adminDataSources.forEach((path) => {
      const file = source(path);
      expect(file, path).not.toMatch(/\.from\(\s*["']/);
      expect(file, path).toMatch(ADMIN_TRANSPORT);
    });
    // 공용 훅 둘은 실제 전송 함수를 직접 써야 한다.
    expect(source("client/src/hooks/admin/useAdminResource.ts")).toContain("adminApiFetch");
    expect(source("client/src/hooks/admin/useAdminPagedResource.ts")).toContain("adminApiFetch");
  });

  it("uses the active-user endpoint for admin guard and login routing", () => {
    [
      "client/src/hooks/useRequireAdmin.ts",
      "client/src/pages/admin/login/AdminLoginPage.tsx",
    ].forEach((path) => {
      const file = source(path);
      expect(file, path).toContain("/api/auth/me");
      expect(file, path).not.toContain('.from("users")');
    });
  });

  it("keeps the settings screen to server-backed controls", () => {
    const file = source("client/src/pages/admin/settings/SettingsPage.tsx");
    expect(file).not.toContain("localStorage");
    expect(file).not.toContain("SettingsMockPanel");
    expect(file).toContain("ServerToggleCard");
  });
});
