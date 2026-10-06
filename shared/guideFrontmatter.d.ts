export type GuideSummary = {
  slug: string;
  title: string;
  description: string;
  /** 목록 탭에 쓰는 분류: "자소서" | "면접 후기". 화면 카드에는 보이지 않는다. */
  category: string;
  /** 커버 이미지 경로(/guide/<slug>/cover.png). 면접 후기처럼 만든 커버가 있을 때. */
  cover: string | null;
  /** 이미지가 없을 때 그리는 글자 커버(블로그 커버 틀). frontmatter coverLabel·coverTitle·coverSub·coverPoint·coverPointNote */
  coverText: GuideCoverText | null;
  /** YYYY-MM-DD */
  date: string;
  /** YYYY-MM-DD. 없으면 date 와 같다. */
  updated: string;
  keywords: readonly string[];
  draft: boolean;
  /** 본문 글자 수(읽기 시간 계산용) */
  bodyChars: number;
};

export type GuideCoverText = {
  /** 작은 분류 줄. 비어 있을 수 있다 */
  label: string;
  /** 큰 키워드 */
  title: string;
  sub: string;
  /** 가로선 아래 강조 줄 */
  point: string;
  /** 강조 줄 옆 작은 덧말. 비어 있을 수 있다 */
  pointNote: string;
  /** 회사 색 키(COMPANY_COVER_TONES). 없으면 목록 순서대로 옅은 판 */
  tone: string | null;
  /** /guide/logos/*.svg 흰 로고 */
  logo: string | null;
};

export type Guide = GuideSummary & {
  /** frontmatter 를 뗀 마크다운 본문 */
  body: string;
};

export function parseFrontmatter(raw: string): { data: Record<string, string>; body: string };
export function parseGuideFile(filePath: string, raw: string): Guide;
export function toGuideSummary(guide: Guide): GuideSummary;
