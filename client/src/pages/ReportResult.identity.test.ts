import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ReportResult.tsx", import.meta.url), "utf8");

describe("ReportResult identity display", () => {
  it("prefers the saved site profile name before auth fallback names", () => {
    expect(source).toContain('supabase');
    expect(source).toContain('.from("users")');
    expect(source).toContain('.select("name")');
    expect(source).toContain("getFallbackDisplayName(user)");
    expect(source).toContain("user?.name");
    expect(source).toContain('user?.email?.split("@")[0]');
    expect(source).toContain('return "지원자"');
  });

  it("does not expose the development API test control on the result page", () => {
    expect(source).not.toContain("handleApiTest");
    expect(source).not.toContain("test-gemini");
    expect(source).not.toContain("UI_LABELS.API_TEST");
  });

  it("shows report navigation actions for saved resumes and the current profile", () => {
    expect(source).toContain("import AuthButton");
    expect(source).toContain("<AuthButton />");
    expect(source).toContain("내 지원서");
    expect(source).toContain('navigate("/my")');
  });

  it("renders lower mentor comments as a timestamped feedback thread", () => {
    const lowerMentorSection = source.split('id="section-pm-comment"')[1]

    expect(lowerMentorSection).toContain("mentor-comment-thread")
    expect(lowerMentorSection).toContain("Mentor Hansi")
    expect(lowerMentorSection).toContain("UI_LABELS.JUST_NOW")
    expect(lowerMentorSection).toContain("rounded-full")
    expect(lowerMentorSection).toContain("absolute left-5")
    expect(lowerMentorSection).toContain("text-[18px] font-semibold")
    expect(lowerMentorSection).toContain("{block.title}")
    expect(lowerMentorSection).toContain("{renderCleanText(block.text)}")
    expect(lowerMentorSection).not.toContain('String(index + 1).padStart(2, "0")')
    expect(lowerMentorSection).not.toContain("numberClassName")
  });

  it("renders sparse report emphasis as tone-specific underlines instead of colored text or pills", () => {
    expect(source).toContain("HIGHLIGHT_UNDERLINE_STYLES");
    expect(source).toContain("linear-gradient(to top");
    expect(source).toContain("rgba(105, 211, 177, 0.22)");
    expect(source).toContain("rgba(217, 185, 75, 0.22)");
    expect(source).toContain("rgba(123, 184, 255, 0.2)");
    expect(source).toContain("boxDecorationBreak: \"clone\"");
    expect(source).not.toContain("font-semibold text-cyan-200");
    expect(source).toContain('renderTextSegments(strengthHighlights[i], "strength")');
    expect(source).toContain('renderTextSegments(gapHighlights[i], "gap")');
    expect(source).toContain("renderTextSegments(parseHighlightedText(text), tone, false)");
    expect(source).toContain("limitSectionHighlights(reportData.strengths)");
    expect(source).toContain("limitSectionHighlights(reportData.gaps)");
  });

  it("sanitizes interview questions and follow ups through rich text rendering", () => {
    expect(source).toContain("{renderRichText(item.question)}");
    expect(source).toContain("{renderRichText(fu)}");
    expect(source).not.toContain("{item.question}</span>");
    expect(source).not.toContain(" />{fu}");
  });

  it("keeps the hero layout but improves hierarchy and tag affordance", () => {
    expect(source).toContain('text-[2.08rem] sm:text-[3.15rem] md:text-[4.05rem]');
    expect(source).toContain("{renderCleanText(heroSummary)}");
    expect(source).toContain("{heroPersona}라는 인상이 먼저 남습니다.");
    expect(source).not.toContain("emphasizeHeroSummaryCopy");
    expect(source).not.toContain("**${heroPersona}**");
    expect(source).toContain("hover:border-cyan-300/25");
    expect(source).toContain("hover:bg-cyan-300/[0.07]");
    expect(source).not.toContain("**${heroPersona}**라는 인상이 먼저 남습니다");
  });
});
