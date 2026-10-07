/**
 * 취업 가이드(client/content/guides/*.md) frontmatter 파서.
 * 클라이언트(client/src/lib/guides.ts)와 빌드 플러그인(vite.config.ts 의 `?summary` 로더)이 같은 규칙을 쓴다.
 * 의존성 없이 `key: value` 한 줄 형식만 지원한다(gray-matter 를 들이지 않는 이유).
 */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9-]+$/;
// 커버 이미지는 client/public/guide/ 아래 파일만. 외부 주소는 CSP·깨짐 위험이 있어 받지 않는다.
const COVER = /^\/guide\/[a-z0-9-]+\/[a-z0-9-]+\.(png|jpe?g|webp)$/;
const COVER_LOGO = /^\/guide\/logos\/[a-z0-9-]+\.(svg|png)$/;
const COVER_TONE = /^[a-z]+$/;
// chat: 고민 말풍선 + 답 말풍선 · quote: 큰따옴표 · plain: 질문만 크게 · mark: 질문 + 답 + 큰 물음표
const COVER_STYLES = new Set(["chat", "quote", "plain", "mark"]);

/**
 * @param {string} raw
 * @returns {{ data: Record<string, string>, body: string }}
 */
export function parseFrontmatter(raw) {
  const match = raw.match(FRONTMATTER);
  if (!match) throw new Error("guide is missing a frontmatter block (--- ... ---)");
  /** @type {Record<string, string>} */
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator === -1) throw new Error(`frontmatter line without a colon: ${line}`);
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    data[key] = value;
  }
  return { data, body: match[2].trim() };
}

/**
 * 파일 하나를 가이드 객체로. 필수 필드가 없거나 형식이 틀리면 빌드가 실패하도록 throw 한다.
 * @param {string} filePath
 * @param {string} raw
 * @returns {import("./guideFrontmatter").Guide}
 */
export function parseGuideFile(filePath, raw) {
  const { data, body } = parseFrontmatter(raw);
  const fileSlug = String(filePath.split("/").pop()).replace(/\.md$/, "");
  const slug = data.slug || fileSlug;
  for (const field of ["title", "description", "date", "category"]) {
    if (!data[field]) throw new Error(`guide ${fileSlug} is missing frontmatter "${field}"`);
  }
  const updated = data.updated || data.date;
  for (const [field, value] of [["date", data.date], ["updated", updated]]) {
    if (!DATE.test(value)) throw new Error(`guide ${fileSlug} has a non YYYY-MM-DD ${field}: ${value}`);
  }
  if (!SLUG.test(slug)) throw new Error(`guide ${fileSlug} has a slug that is not lowercase-kebab: ${slug}`);
  if (data.cover && !COVER.test(data.cover)) throw new Error(`guide ${fileSlug} has a cover outside /guide/: ${data.cover}`);
  // 질문형 커버(10-07): 구성(style) 하나를 글마다 고정하고, 큰 글씨 한 줄(question)과 짧은 답(answer)을 쓴다.
  let coverText = null;
  if (data.coverStyle || data.coverQuestion || data.coverAnswer) {
    if (!COVER_STYLES.has(data.coverStyle)) throw new Error(`guide ${fileSlug} has a bad coverStyle: ${data.coverStyle}`);
    if (!data.coverQuestion) throw new Error(`guide ${fileSlug} has a cover without "coverQuestion"`);
    // 모든 구성에 답 줄이 들어간다(10-07: 커버가 비어 보인다는 피드백).
    if (!data.coverAnswer) throw new Error(`guide ${fileSlug} has a cover without "coverAnswer"`);
    if (data.coverLogo && !COVER_LOGO.test(data.coverLogo)) {
      throw new Error(`guide ${fileSlug} has a coverLogo outside /guide/logos/: ${data.coverLogo}`);
    }
    if (data.coverTone && !COVER_TONE.test(data.coverTone)) throw new Error(`guide ${fileSlug} has a bad coverTone: ${data.coverTone}`);
    coverText = {
      style: data.coverStyle,
      label: data.coverLabel || "",
      // frontmatter 는 한 줄이라 줄바꿈은 \n 두 글자로 적는다.
      question: data.coverQuestion.replace(/\\n/g, "\n"),
      answer: data.coverAnswer.replace(/\\n/g, "\n"),
      // 면접 후기: 회사 색(lib/guideSummaries.ts COMPANY_COVER_TONES 의 키)과 흰 로고
      tone: data.coverTone || null,
      logo: data.coverLogo || null,
    };
  }
  return {
    slug,
    title: data.title,
    description: data.description,
    category: data.category,
    cover: data.cover || null,
    coverText,
    date: data.date,
    updated,
    keywords: (data.keywords ?? "")
      .split(",")
      .map(keyword => keyword.trim())
      .filter(Boolean),
    draft: data.draft === "true",
    bodyChars: body.length,
    body,
  };
}

/**
 * 본문을 뺀 요약. 랜딩처럼 목록만 필요한 곳이 마크다운 원문을 번들에 싣지 않게 한다.
 * @param {import("./guideFrontmatter").Guide} guide
 * @returns {import("./guideFrontmatter").GuideSummary}
 */
export function toGuideSummary(guide) {
  const { body: _body, ...summary } = guide;
  return summary;
}
