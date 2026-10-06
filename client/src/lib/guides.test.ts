import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findGuide, GUIDES, guideMeta, guidePrerenderRoute, parseFrontmatter, parseGuideFile, renderGuideHtml } from "./guides";
import { COMPANY_COVER_TONES, GUIDE_SUMMARIES, guideCategories, guideCoverStyle, guideCoverTone, readingMinutes } from "./guideSummaries";

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

  it("reads the text cover fields and an optional cover image, which must live under /guide/", () => {
    const withText = raw.replace("date:", "coverLabel: 자소서 문항\ncoverTitle: 지원동기\ncoverSub: 칭찬에서 끝내지 않기\ncoverPoint: 칭찬 뒤 세 줄\ndate:");
    expect(parseGuideFile("/content/guides/my-guide.md", withText).coverText).toEqual({
      label: "자소서 문항", title: "지원동기", sub: "칭찬에서 끝내지 않기", point: "칭찬 뒤 세 줄", pointNote: "", tone: null, logo: null,
    });
    const company = withText.replace("date:", "coverTone: hyundai\ncoverLogo: /guide/logos/hyundai-white.svg\ndate:");
    expect(parseGuideFile("/content/guides/my-guide.md", company).coverText).toMatchObject({ tone: "hyundai", logo: "/guide/logos/hyundai-white.svg" });
    expect(() => parseGuideFile("/x/a.md", withText.replace("date:", "coverLogo: https://x.example/a.svg\ndate:"))).toThrow(/coverLogo/);
    expect(parseGuideFile("/content/guides/my-guide.md", raw).coverText).toBeNull();
    expect(() => parseGuideFile("/x/a.md", raw.replace("date:", "coverTitle: 지원동기\ndate:"))).toThrow(/coverSub/);
    const withImage = raw.replace("date:", "cover: /guide/my-guide/cover.png\ndate:");
    expect(parseGuideFile("/content/guides/my-guide.md", withImage).cover).toBe("/guide/my-guide/cover.png");
    expect(() => parseGuideFile("/x/a.md", raw.replace("date:", "cover: https://evil.example/x.png\ndate:"))).toThrow(/cover/);
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

  it("gives neighbouring guides different cover tones", () => {
    const styles = GUIDE_SUMMARIES.map((_, index) => guideCoverStyle(index));
    for (let index = 1; index < styles.length; index += 1) {
      expect(styles[index].accent).not.toBe(styles[index - 1].accent);
    }
    expect(readingMinutes(200)).toBe(1);
    expect(readingMinutes(2600)).toBe(5);
    expect(guideCategories(GUIDE_SUMMARIES)).toEqual(expect.arrayContaining(["자소서", "면접 후기"]));
  });

  it("gives every card a cover that tells it apart: an image or a text cover", () => {
    // 10-06: 커버가 전부 같은 판이라 무엇을 눌러야 할지 모르겠다는 피드백. 분류는 두 가지로만 둔다.
    for (const guide of GUIDE_SUMMARIES) {
      expect(["자소서", "면접 후기"], guide.slug).toContain(guide.category);
      expect(Boolean(guide.cover || guide.coverText), guide.slug).toBe(true);
      if (guide.cover) expect(existsSync(new URL(`../../public${guide.cover}`, import.meta.url)), guide.cover).toBe(true);
      const logo = guide.coverText?.logo;
      if (logo) expect(existsSync(new URL(`../../public${logo}`, import.meta.url)), logo).toBe(true);
      const tone = guide.coverText?.tone;
      if (tone) expect(Object.keys(COMPANY_COVER_TONES), `${guide.slug} tone`).toContain(tone);
    }
  });

  it("draws interview reviews with the same text cover as other guides, in the company colour (10-06: 글씨 크기 일관성)", () => {
    const interviews = GUIDE_SUMMARIES.filter(guide => guide.category === "면접 후기");
    expect(interviews.length).toBeGreaterThan(0);
    for (const [index, guide] of interviews.entries()) {
      expect(guide.cover, guide.slug).toBeNull();
      expect(guide.coverText?.tone, guide.slug).toBeTruthy();
      expect(guideCoverTone(guide, index)).toBe(COMPANY_COVER_TONES[guide.coverText!.tone!]);
    }
    const plain = GUIDE_SUMMARIES.find(guide => !guide.coverText?.tone)!;
    expect(guideCoverTone(plain, 0)).toBe(guideCoverStyle(0));
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

describe("guide bodies", () => {
  it("has a per-guide body loader for every published guide", async () => {
    // lib/guideBodies.ts 는 파일 이름으로 본문을 찾는다. frontmatter 의 slug 로 이름을 바꾸면 본문을 못 찾으므로 여기서 막는다.
    const { hasGuideBody } = await import("./guideBodies");
    expect(GUIDES.filter(guide => !hasGuideBody(guide.slug)).map(guide => guide.slug)).toEqual([]);
  });
});
