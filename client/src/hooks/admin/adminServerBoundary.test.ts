import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const root = new URL("../../../../", import.meta.url);
const adminDataSources = [
  "client/src/hooks/admin/useDashboardData.ts",
  "client/src/hooks/admin/useUsersData.ts",
  "client/src/hooks/admin/useUserDetail.ts",
  "client/src/hooks/admin/useAnalysisDetail.ts",
  "client/src/hooks/admin/useAnalysesData.ts",
  "client/src/hooks/admin/useAiUsageData.ts",
  "client/src/hooks/admin/useErrorLogs.ts",
  "client/src/hooks/admin/usePrompts.ts",
  "client/src/pages/admin/analytics/AnalyticsPage.tsx",
  "client/src/pages/admin/ai-models/AiModelsPage.tsx",
];

function source(path: string) {
  return readFileSync(new URL(path, root), "utf8");
}

describe("admin client server boundary", () => {
  it("keeps Supabase table reads and writes out of admin data hooks and pages", () => {
    adminDataSources.forEach((path) => {
      const file = source(path);
      expect(file, path).not.toMatch(/\.from\(\s*["']/);
      expect(file, path).toContain("adminApiFetch");
    });
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

  it("does not present browser-backed settings as live administration", () => {
    ["client/src/pages/admin/settings/SettingsPage.tsx", "client/src/pages/admin/ai-settings/AiSettingsPage.tsx"].forEach((path) => {
      const file = source(path);
      expect(file, path).not.toContain("localStorage");
      expect(file, path).toContain("read-only");
      expect(file, path).toContain("adminApiFetch");
    });
  });
});
