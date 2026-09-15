import { describe, expect, it } from "vitest";
import { findGuide, GUIDES, guideMeta, guidePrerenderRoute, parseFrontmatter, parseGuideFile, renderGuideHtml } from "./guides";
import { GUIDE_SUMMARIES, guideCategories, guideCoverStyle, readingMinutes } from "./guideSummaries";

// 타깃은 신입 공채 지원자뿐이다(.agents/product-marketing.md). 가이드 본문에서도 경력직 키워드를 쓰지 않는다.
const FORBIDDEN_KEYWORDS = /이직|경력직|경력기술서|커리어 전환/;
// 제품 원칙: 점수·퍼센트·합격 보장을 말하지 않는다.
const FORBIDDEN_CLAIMS = /합격 보장|합격률|적합도 \d|\d+점/;

describe("parseFrontmatter", () => {
  it("splits the frontmatter block from the body and strips quotes", () => {
    const { data, body } = parseFrontmatter('---\ntitle: "제목: 콜론 포함"\ndate: 2026-09-14\n---\n\n# 본문\n');
    expect(data).toEqual({ title: "제목: 콜론 포함", date: "2026-09-14" });
    expect(body).toBe("# 본문");
  });

  it("rejects files without a frontmatter block", () => {
    expect(() => parseFrontmatter("# 본문만")).toThrow(/frontmatter/);
  });
});

describe("parseGuideFile", () => {
  const raw = "---\ntitle: t\ndescription: d\ncategory: 첫인상\ndate: 2026-09-14\nkeywords: 자소서 첨삭, 자소서 피드백\n---\n본문";

  it("derives the slug from the file name and defaults updated to date", () => {
    const guide = parseGuideFile("/content/guides/my-guide.md", raw);
    expect(guide.slug).toBe("my-guide");
    expect(guide.updated).toBe("2026-09-14");
    expect(guide.category).toBe("첫인상");
    expect(guide.keywords).toEqual(["자소서 첨삭", "자소서 피드백"]);
    expect(guide.draft).toBe(false);
    expect(guide.bodyChars).toBe(2);
  });

  it("requires title, description, category and an ISO date", () => {
    expect(() => parseGuideFile("/x/a.md", "---\ntitle: t\ncategory: c\ndate: 2026-09-14\n---\n")).toThrow(/description/);
    expect(() => parseGuideFile("/x/a.md", "---\ntitle: t\ndescription: d\ndate: 2026-09-14\n---\n")).toThrow(/category/);
    expect(() => parseGuideFile("/x/a.md", "---\ntitle: t\ndescription: d\ncategory: c\ndate: 14.09.2026\n---\n")).toThrow(/YYYY-MM-DD/);
    expect(() => parseGuideFile("/x/My Guide.md", raw)).toThrow(/slug/);
  });
});

describe("guide summaries (vite `?summary` loader)", () => {
  it("lists the same guides as the full module, without bodies, in the same order", () => {
    expect(GUIDE_SUMMARIES.map(guide => guide.slug)).toEqual(GUIDES.map(guide => guide.slug));
    for (const [index, summary] of GUIDE_SUMMARIES.entries()) {
      expect("body" in summary, summary.slug).toBe(false);
      expect(summary.bodyChars).toBe(GUIDES[index].body.length);
      expect(summary.category).toBe(GUIDES[index].category);
    }
  });

  it("gives neighbouring guides different cover hues and two-digit numbers", () => {
    const styles = GUIDE_SUMMARIES.map((_, index) => guideCoverStyle(index));
    expect(styles.map(style => style.number)).toEqual(["01", "02", "03", "04"].slice(0, styles.length));
    for (let index = 1; index < styles.length; index += 1) {
      expect(styles[index].hue).not.toBe(styles[index - 1].hue);
    }
    expect(readingMinutes(200)).toBe(1);
    expect(readingMinutes(2600)).toBe(5);
    expect(guideCategories(GUIDE_SUMMARIES).length).toBeGreaterThanOrEqual(3);
  });
});

describe("GUIDES (client/content/guides)", () => {
  it("ships at least three published guides with unique slugs, newest first", () => {
    expect(GUIDES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(GUIDES.map(guide => guide.slug)).size).toBe(GUIDES.length);
    const dates = GUIDES.map(guide => guide.date);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });

  it("keeps titles and descriptions inside search snippet limits", () => {
    for (const guide of GUIDES) {
      const meta = guideMeta(guide);
      expect(meta.title.length, guide.slug).toBeLessThanOrEqual(60);
      expect(meta.description.length, guide.slug).toBeGreaterThanOrEqual(30);
      expect(meta.description.length, guide.slug).toBeLessThanOrEqual(110);
      expect(meta.canonical).toBe(`https://pre-view.me/guide/${guide.slug}`);
      expect((meta.jsonLd ?? []).map(block => block["@type"])).toEqual(["Article", "BreadcrumbList"]);
      expect(guidePrerenderRoute(guide).file).toBe(`guide/${guide.slug}.html`);
    }
  });

  it("never uses experienced-hire keywords or score/guarantee claims", () => {
    for (const guide of GUIDES) {
      const text = `${guide.title} ${guide.description} ${guide.body}`;
      expect(text, guide.slug).not.toMatch(FORBIDDEN_KEYWORDS);
      expect(text, guide.slug).not.toMatch(FORBIDDEN_CLAIMS);
    }
  });

  it("links every guide back to the analyze form so search visitors can act", () => {
    for (const guide of GUIDES) {
      expect(guide.body, guide.slug).toContain("](/analyze)");
      expect(guide.body.length, guide.slug).toBeGreaterThan(1200);
    }
  });

  it("finds a guide by slug and renders its markdown to HTML", () => {
    const first = GUIDES[0];
    expect(findGuide(first.slug)).toBe(first);
    expect(findGuide("no-such-guide")).toBeUndefined();
    const html = renderGuideHtml(first.body);
    expect(html).toContain("<h2");
    expect(html).toContain('href="/analyze"');
  });
});
