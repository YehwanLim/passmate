import { describe, expect, it } from "vitest";

import { AI_SECTION_TABS, isSectionTabActive } from "./AdminSectionTabs";

describe("isSectionTabActive", () => {
  const prompts = AI_SECTION_TABS.find((tab) => tab.label === "프롬프트")!;

  it("자기 주소와 그 아래 상세 주소에서 활성", () => {
    expect(isSectionTabActive("/admin/prompts", prompts)).toBe(true);
    expect(isSectionTabActive("/admin/prompts/resume-analysis", prompts)).toBe(true);
  });

  it("이름만 비슷한 다른 주소에서는 비활성", () => {
    expect(isSectionTabActive("/admin/prompts-archive", prompts)).toBe(false);
    expect(isSectionTabActive("/admin/ai-usage", prompts)).toBe(false);
  });
});
