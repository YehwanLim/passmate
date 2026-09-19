/**
 * 가이드 본문 HTML 을 글 하나씩 가져온다.
 *
 * 예전에는 lib/guides.ts 의 eager glob 이 모든 글의 마크다운을 GuideArticle 청크 하나에 실었다(14편에 152KB, 글이 늘수록 커짐).
 * 큰 청크는 Google 렌더러의 리소스 타임아웃에 걸려 Soft 404 의 원인이 됐다(메모: googlebot-chunk-soft404).
 * 이제 본문은 세 경로로 온다.
 *  1. 프리렌더(SSR): entry-server.tsx 가 seedGuideHtml 로 전부 미리 넣는다. 서스펜드하지 않는다.
 *  2. 프리렌더된 글로 바로 들어온 브라우저: 이미 DOM 에 있는 본문 HTML 을 그대로 쓴다. 마크다운도 marked 도 받지 않는다.
 *  3. 사이트 안에서 글로 이동: 그 글의 마크다운과 marked 만 지연 로드한다(그동안 Suspense 폴백).
 */
const LOADERS = import.meta.glob("../../content/guides/*.md", { query: "?raw", import: "default" }) as Record<
  string,
  () => Promise<string>
>;

const LOADER_BY_SLUG = new Map(
  Object.entries(LOADERS).map(([filePath, load]) => [String(filePath.split("/").pop()).replace(/\.md$/, ""), load])
);

const htmlBySlug = new Map<string, string>();
const pendingBySlug = new Map<string, Promise<void>>();

export function hasGuideBody(slug: string): boolean {
  return LOADER_BY_SLUG.has(slug);
}

export function seedGuideHtml(slug: string, html: string): void {
  htmlBySlug.set(slug, html);
}

/** 테스트에서 모듈 상태를 되돌릴 때만 쓴다. */
export function resetGuideHtml(): void {
  htmlBySlug.clear();
  pendingBySlug.clear();
}

/** 프리렌더된 페이지가 바로 이 글이면 DOM 의 본문을 읽는다. 하이드레이션 첫 렌더에서만 의미가 있다. */
function readPrerenderedHtml(slug: string): string | null {
  if (typeof document === "undefined") return null;
  const root = document.getElementById("root");
  if (root?.dataset.prerendered !== `/guide/${slug}`) return null;
  return root.querySelector(".guide-prose")?.innerHTML ?? null;
}

/**
 * 본문 HTML 을 돌려준다. 아직 없으면 로드를 시작하고 그 Promise 를 던진다(Suspense).
 * 컴포넌트는 가까운 <Suspense> 안에서 부른다.
 */
export function readGuideHtml(slug: string): string {
  const cached = htmlBySlug.get(slug);
  if (cached !== undefined) return cached;

  const prerendered = readPrerenderedHtml(slug);
  if (prerendered !== null) {
    htmlBySlug.set(slug, prerendered);
    return prerendered;
  }

  let pending = pendingBySlug.get(slug);
  if (!pending) {
    const load = LOADER_BY_SLUG.get(slug);
    if (!load) throw new Error(`no guide body for slug ${slug}`);
    pending = Promise.all([load(), import("./guideMarkdown")]).then(([raw, { renderGuideFile }]) => {
      htmlBySlug.set(slug, renderGuideFile(raw));
      pendingBySlug.delete(slug);
    });
    pendingBySlug.set(slug, pending);
  }
  throw pending;
}
