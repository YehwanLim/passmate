import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Analyze loading icon", () => {
  it("uses a time-based icon for each loading step", () => {
    const page = read("client/src/pages/Analyze.tsx");

    expect(page).toContain("LOADING_STEPS");
    expect(page).toContain("FileSearch");
    expect(page).toContain("BarChart3");
    expect(page).toContain("FileText");
    expect(page).toContain('title: "자소서를 한 줄씩 읽고 있어요"');
    expect(page).toContain('title: "합격 신호를 찾는 중이에요"');
    expect(page).toContain('title: "인사이트 리포트를 정리하고 있어요"');
    expect(page).toContain("const LoadingIcon = currentLoadingStep.icon");
    expect(page).toContain("{currentLoadingStep.title}");
    expect(page).not.toContain("인사이트 리포트를 생성하고 있습니다");
    expect(page).not.toContain('<Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />');
  });
});
