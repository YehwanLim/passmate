export type GuideSummary = {
  slug: string;
  title: string;
  description: string;
  /** 목록 탭·카드 메타에 쓰는 분류. 예: 첫인상, 문항별, AI 활용, 수정하기 */
  category: string;
  /** YYYY-MM-DD */
  date: string;
  /** YYYY-MM-DD. 없으면 date 와 같다. */
  updated: string;
  keywords: readonly string[];
  draft: boolean;
  /** 본문 글자 수(읽기 시간 계산용) */
  bodyChars: number;
};

export type Guide = GuideSummary & {
  /** frontmatter 를 뗀 마크다운 본문 */
  body: string;
};

export function parseFrontmatter(raw: string): { data: Record<string, string>; body: string };
export function parseGuideFile(filePath: string, raw: string): Guide;
export function toGuideSummary(guide: Guide): GuideSummary;
