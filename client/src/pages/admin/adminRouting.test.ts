import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("admin routing", () => {
  it("routes resume analysis detail URLs through the top-level app router", () => {
    const app = read("client/src/App.tsx");

    expect(app).toContain('"/admin/resume-analysis/:id"');
    expect(app).toContain(
      "<Route key={path} path={path} component={AdminRoot} />"
    );
  });

  it("routes resume analysis detail URLs inside AdminRoot before the list route", () => {
    const adminRoot = read("client/src/pages/admin/AdminRoot.tsx");

    const detailIndex = adminRoot.indexOf('path="/admin/resume-analysis/:id"');
    const listIndex = adminRoot.indexOf('path="/admin/resume-analysis"');

    expect(detailIndex).toBeGreaterThan(-1);
    expect(listIndex).toBeGreaterThan(-1);
    expect(detailIndex).toBeLessThan(listIndex);
  });

  it("routes AI Settings and exposes it in the admin sidebar", () => {
    const adminRoot = read("client/src/pages/admin/AdminRoot.tsx");
    const sidebar = read("client/src/components/admin/layout/AdminSidebar.tsx");

    expect(adminRoot).toContain(
      'import AiSettingsPage from "./ai-settings/AiSettingsPage";'
    );
    expect(adminRoot).toContain(
      'path="/admin/ai-settings" component={AiSettingsPage}'
    );
    expect(sidebar).toContain('key: "ai-settings"');
    expect(sidebar).toContain('label: "AI Settings"');
    expect(sidebar).toContain('href: "/admin/ai-settings"');
  });

  it("keeps default and fallback model selection only in AI Models", () => {
    const aiModelsPage = read(
      "client/src/pages/admin/ai-models/AiModelsPage.tsx"
    );
    const aiSettingsPage = read(
      "client/src/pages/admin/ai-settings/AiSettingsPage.tsx"
    );

    expect(aiModelsPage).toContain("Default Model");
    expect(aiModelsPage).toContain("Fallback Model");
    expect(aiSettingsPage).not.toContain("Default Model");
    expect(aiSettingsPage).not.toContain("Fallback Model");
    expect(aiSettingsPage).not.toContain("defaultModel");
    expect(aiSettingsPage).not.toContain("fallbackModel");
  });
});
