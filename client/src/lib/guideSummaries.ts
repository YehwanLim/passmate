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
 * 글자 커버 색. 흰 바탕 페이지에 맞춘 옅은 판 + 진한 글씨(블로그 공채 커버 틀, 10-06 승인).
 * 이웃한 글이 같은 색을 갖지 않도록 slug 해시가 아니라 목록 인덱스로 돌려 쓴다.
 */
export type GuideCoverStyle = {
  /** 판 */
  background: string;
  /** 큰 키워드·부제·가로선 */
  ink: string;
  /** 강조 줄 */
  accent: string;
  /** 작은 분류 줄 */
  label: string;
};

export const GUIDE_COVER_TONES: readonly GuideCoverStyle[] = [
  { background: "#e8f3ff", ink: "#0b2c46", accent: "#0064ff", label: "#3a6ea5" },
  { background: "#fff0e6", ink: "#4a1f0e", accent: "#e8590c", label: "#b4541f" },
  { background: "#e6f6ec", ink: "#123b22", accent: "#1f9254", label: "#2f7346" },
  { background: "#f1ecfb", ink: "#2a1d4a", accent: "#6b4bc4", label: "#5a43a0" },
  { background: "#fff6d9", ink: "#3d2e06", accent: "#b7860b", label: "#8a6a0f" },
];

export function guideCoverStyle(index: number): GuideCoverStyle {
  return GUIDE_COVER_TONES[index % GUIDE_COVER_TONES.length];
}

/** 면접 후기 커버의 회사 색. 블로그 커버(.agents/blog-job-posts/covers/src/iv-*.html)와 같은 값이다. */
export const COMPANY_COVER_TONES: Readonly<Record<string, GuideCoverStyle>> = {
  hyundai: { background: "#002c5f", ink: "#ffffff", accent: "#bcd3f2", label: "#9fbbe0" },
  samsung: { background: "#1428a0", ink: "#ffffff", accent: "#c3cbf6", label: "#c3cbf6" },
};

/** 글의 커버 색: 회사 색이 지정돼 있으면 그것, 아니면 목록 위치의 옅은 판. */
export function guideCoverTone(guide: Pick<GuideSummary, "coverText">, index: number): GuideCoverStyle {
  const tone = guide.coverText?.tone;
  return (tone && COMPANY_COVER_TONES[tone]) || guideCoverStyle(index);
}

/** 목록에서의 위치(최신순). 본문 페이지가 같은 번호·색을 쓰기 위해 찾는다. */
export function guideIndexOf(slug: string): number {
  return GUIDE_SUMMARIES.findIndex(guide => guide.slug === slug);
}

/** 탭 목록: 등장 순서대로, 중복 없이. */
export function guideCategories(guides: readonly Pick<GuideSummary, "category">[]): string[] {
  return Array.from(new Set(guides.map(guide => guide.category)));
}
