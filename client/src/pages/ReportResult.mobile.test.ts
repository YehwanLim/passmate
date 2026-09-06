import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ReportResult.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const labels = readFileSync(new URL("../constants/labels.ts", import.meta.url), "utf8");

describe("ReportResult mobile layout", () => {
  it("replaces the desktop-only table of contents with a horizontal chip bar below xl", () => {
    const chipBar = source.split("function SectionChipBar")[1]?.split("function isRenderableReport")[0] ?? "";
    expect(chipBar).toContain("xl:hidden");
    expect(chipBar).toContain("REPORT_NAV_SECTIONS.map");
    expect(chipBar).toContain("overflow-x-auto");
    expect(chipBar).toContain("aria-current");
    expect(chipBar).toContain("scrollChildIntoHorizontalView");
    // 칩 바는 sticky 헤더 래퍼 안에 있어야 헤더와 한 덩어리로 고정된다.
    const stickyHeader = source.split("TOP NAV (Global Sticky)")[1]?.split("</div>\n            </div>")[0] ?? "";
    expect(stickyHeader).toContain("<SectionChipBar");
  });

  it("gives every section anchor a scroll margin so the sticky header does not cover it", () => {
    expect(css).toContain("scroll-margin-top");
    expect(css).toMatch(/#section-first-impression[\s\S]*#section-pm-comment[\s\S]*scroll-margin-top/);
  });

  it("switches sentence feedback to a bottom sheet on compact layouts", () => {
    expect(source).toContain('from "@/components/ui/drawer"');
    expect(source).toContain('"(max-width: 1023px)"');
    expect(source).toContain("isCompactLayout");
    expect(source).toContain("isSheetOpen");
    expect(source).toContain("getNeighborCardIndex");
    // 프로그램 스크롤이 막히지 않도록 vaul 모달 잠금 대신 자체 오버레이를 쓴다.
    expect(source).toContain("modal={false}");
  });

  it("shares one feedback card body between focus mode, list mode and the sheet", () => {
    expect(source).toContain("function FeedbackCardBody");
    expect(source.match(/<FeedbackCardBody/g)?.length).toBe(3);
  });

  it("hides the view mode toggle and forces list mode below lg", () => {
    expect(source).toContain('className="view-mode-toggle print:hidden hidden lg:flex"');
    expect(source).toContain("(viewMode === 'list' || isPrinting || isCompactLayout)");
    expect(source).toContain("viewMode === 'focus' && !isPrinting && !isCompactLayout");
  });

  it("lets question tabs scroll horizontally instead of overflowing", () => {
    const tabs = source.split("Section Navigator Tabs")[1]?.split("Question Prompt")[0] ?? "";
    expect(tabs).toContain("overflow-x-auto");
    expect(css).toMatch(/\.section-tab \{[^}]*white-space: nowrap/);
    expect(css).toMatch(/\.section-tab \{[^}]*flex-shrink: 0/);
  });

  it("shows a one-time tap coach mark above the first highlighted sentence", () => {
    expect(labels).toContain("TAP_HIGHLIGHT_GUIDE:");
    expect(labels).toContain("TAP_HIGHLIGHT_COACH:");
    expect(source).toContain("UI_LABELS.TAP_HIGHLIGHT_GUIDE");
    expect(source).toContain("UI_LABELS.TAP_HIGHLIGHT_COACH");
    expect(source).toContain("resolveCoachPlacement");
    expect(source).toContain('"preview:report-tap-coach-seen-v2"');
    // 프라이빗 모드에서 localStorage 접근이 throw 할 수 있으므로 try/catch로 감싼다.
    const coachStorage = source.split('"preview:report-tap-coach-seen-v2"');
    expect(coachStorage.length).toBeGreaterThanOrEqual(3);
    expect(source).toMatch(/try \{[^}]*preview:report-tap-coach-seen-v2/);
    // 긴 원문은 본문의 20%가 한 화면에 들어오지 않으므로 첫 하이라이트 자체를 관찰한다.
    expect(source).toContain("const firstHighlight = document.getElementById(`source-sentence-${firstCardIndex}`)");
    expect(source).toContain("observer.observe(firstHighlight)");
    // 실제로 보여준 적이 있을 때만 "봤음"을 저장한다. 말풍선 전에 문장을 누른 사용자는 다음 방문에 다시 본다.
    expect(source).toMatch(/if \(!coachShownRef\.current\)[\s\S]{0,200}return[\s\S]{0,400}localStorage\.setItem\("preview:report-tap-coach-seen-v2"/);
  });
});
