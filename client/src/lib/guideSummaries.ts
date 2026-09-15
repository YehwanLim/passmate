import type { GuideSummary } from "@shared/guideFrontmatter";
import { GUIDE_INDEX_PATH } from "@/lib/seo";

/**
 * 가이드 목록(본문 없음). vite.config.ts 의 `?summary` 로더가 마크다운에서 frontmatter 와 글자 수만 뽑아 주므로
 * 랜딩(GuideTeaserSection)·목록(GuideIndex)이 마크다운 원문을 번들에 싣지 않는다. 본문이 필요하면 lib/guides.ts.
 */
const RAW_SUMMARIES = import.meta.glob<GuideSummary>("../../content/guides/*.md", {
  query: "?summary",
  import: "default",
  eager: true,
});

export function sortGuides<T extends Pick<GuideSummary, "date" | "draft">>(guides: readonly T[]): T[] {
  return guides.filter(guide => !guide.draft).sort((a, b) => b.date.localeCompare(a.date));
}

/** 발행된 글, 최신순. */
export const GUIDE_SUMMARIES: readonly GuideSummary[] = sortGuides(Object.values(RAW_SUMMARIES));

export function guidePath(guide: Pick<GuideSummary, "slug">): string {
  return `${GUIDE_INDEX_PATH}/${guide.slug}`;
}

/** 한국어 본문 기준 분당 500자. 최소 1분. */
export function readingMinutes(bodyChars: number): number {
  return Math.max(1, Math.round(bodyChars / 500));
}

/**
 * 커버 색조. 참고 팔레트(파우더 블루 · 오키드 · 복숭아 · 민트)를 목록 순서대로 돌려 쓴다.
 * 이웃한 글이 같은 색을 갖지 않도록 slug 해시가 아니라 목록 인덱스로 정한다.
 */
export const GUIDE_COVER_HUES = [240, 325, 40, 160] as const;

export type GuideCoverStyle = { hue: number; number: string };

export function guideCoverStyle(index: number): GuideCoverStyle {
  return {
    hue: GUIDE_COVER_HUES[index % GUIDE_COVER_HUES.length],
    number: String(index + 1).padStart(2, "0"),
  };
}

/** 목록에서의 위치(최신순). 본문 페이지가 같은 번호·색을 쓰기 위해 찾는다. */
export function guideIndexOf(slug: string): number {
  return GUIDE_SUMMARIES.findIndex(guide => guide.slug === slug);
}

/** 탭 목록: 등장 순서대로, 중복 없이. */
export function guideCategories(guides: readonly Pick<GuideSummary, "category">[]): string[] {
  return Array.from(new Set(guides.map(guide => guide.category)));
}
