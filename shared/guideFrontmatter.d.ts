export type GuideSummary = {
  slug: string;
  title: string;
  description: string;
  /** 목록 탭에 쓰는 분류: "자소서" | "면접 후기". 화면 카드에는 보이지 않는다. */
  category: string;
  /** 커버 이미지 경로(/guide/<slug>/cover.png). 면접 후기처럼 만든 커버가 있을 때. */
  cover: string | null;
  /** 이미지가 없을 때 그리는 질문형 커버. frontmatter coverStyle·coverLabel·coverQuestion·coverAnswer·coverTone·coverLogo */
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
  /** chat: 고민·답 말풍선 · quote: 큰따옴표 · plain: 질문만 · mark: 질문 + 답 + 큰 물음표 */
  style: "chat" | "quote" | "plain" | "mark";
  /** 작은 분류 줄. 로고가 있는 면접 후기에서는 그리지 않는다. 비어 있을 수 있다 */
  label: string;
  /** 큰 글씨. \n 으로 줄을 나눈다 */
  question: string;
  /** 답 줄(모든 구성에 보인다). \n 으로 줄을 나눈다. 면접 후기는 한 줄 */
  answer: string;
  /** 회사 색 키(COMPANY_COVER_TONES). 없으면 목록 순서대로 강조색 */
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
