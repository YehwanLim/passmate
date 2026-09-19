import { marked } from "marked";
import { parseFrontmatter } from "@shared/guideFrontmatter";

// breaks: 블로그에서 옮긴 글은 문단 안 줄바꿈이 호흡이라 <br> 로 살린다. 직접 쓴 가이드는 문단이 한 줄이라 영향 없다.
marked.use({ gfm: true, breaks: true });

/** 마크다운 본문 → HTML. 서버(프리렌더)와 클라이언트가 같은 marked 버전으로 같은 결과를 낸다. */
export function renderGuideHtml(markdown: string): string {
  return marked.parse(markdown, { async: false });
}

/** frontmatter 가 붙은 원본 파일 → 본문 HTML. 클라이언트가 글 하나를 지연 로드할 때 쓴다. */
export function renderGuideFile(raw: string): string {
  return renderGuideHtml(parseFrontmatter(raw).body);
}
