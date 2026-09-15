# SEO 설계 — 페이지별 메타 · 프리렌더 확장 · 구조화 데이터 · 가이드 콘텐츠

작성일: 2026-09-14 (구현 2026-09-15)

## 배경

공개 베타·결제 오픈 상태지만 검색 유입 기반이 없었다. 점검 결과(2026-09-14):

- Google Search Console·네이버 서치어드바이저 미등록. Bing `site:` 결과 0건.
- 페이지별 메타 없음: 모든 라우트가 `client/index.html` 의 랜딩 title/description/OG 를 상속. 샘플 리포트도 og:url·og:title 은 랜딩 값.
- `/company-report?sample=1`(sitemap 에 있음)·`/terms`·`/privacy`·`/entitlements` 는 빈 SPA 셸(본문 0자).
- JSON-LD 없음. 미존재 경로가 200 응답(soft 404). 색인 가능한 실질 페이지 2개.

## 결정

- 범위: 기술 SEO + 콘텐츠 기반(레포 안 `/guide/*` 마크다운 → 빌드 프리렌더).
- 검색 메타·가이드 글에는 사용자가 실제로 검색하는 "자소서 첨삭"을 쓴다. 랜딩 본문 카피는 "진단"을 유지한다.
- 타깃은 신입 공채 전용이라 "이직·경력직·경력기술서" 는 어디에도 쓰지 않는다(테스트로 강제).
- 새 서버리스 함수 0개(Vercel Hobby 12함수 제한). 전부 정적 빌드 산출물.
- CSP 는 손대지 않는다. `application/ld+json` 데이터 블록은 실행되지 않아 `script-src` 검사 대상이 아니다.
- FAQPage 구조화 데이터는 보이는 FAQ 섹션이 생길 때까지 넣지 않는다(보이지 않는 Q&A 는 정책 위반).

## 구조

### 메타 단일 정의처 — `client/src/lib/seo.ts`

- `SEO_ROUTES`: 라우트 키 → `RouteMeta { title, description, canonical?, robots?, ogType?, updated?, jsonLd? }`.
- `routeKey(pathname, search)`: 쿼리는 떼되 `sample=1` 만 남긴다. `VisitTracker.pageViewPath`(GA page_view 경로)가 같은 함수를 쓴다.
- `resolveRouteMeta`: 정확 키 → `/guide/*` 기본값 → 비공개 접두(`/my`, `/admin`, `/checkout`, `/analysis-pending`, `/account`, `/company-analysis`)는 noindex → 그 외 `/404`(noindex).
- `applyDocumentMeta(meta, doc)`: title·description·og:*·twitter:*·canonical·robots 를 DOM 에 반영. `components/RouteMeta.tsx` 가 라우트 전환마다 `useLayoutEffect` 로 호출한다. App 에서 `VisitTracker` 앞에 두어 GA page_view 가 새 title 을 읽는다.
- `PRERENDER_ROUTES`: 빌드 때 굳히는 고정 목록. `/analyze` 는 세션 초안·쿼리로 첫 상태가 달라져 하이드레이션이 어긋나므로 제외(메타만 런타임 적용).
- 사이트 식별자(`SITE_ORIGIN` 등)는 `lib/site.ts` 에 두어 `structuredData.ts` 와의 순환 import 를 피한다.

### 프리렌더 — `scripts/prerender-landing.mjs` + `client/src/entry-server.tsx`

- `entry-server.getPrerenderPages()` = `PRERENDER_ROUTES` + 가이드 글. mjs 는 이 목록을 돌며 `renderRoute` → `buildPage`(root 주입 → 배경 → critical CSS → `applyHeadMeta` → 지연 부트) → `dist/public/<file>`.
- `applyHeadMeta(html, meta)`: 셸의 title/description/og/twitter 를 치환하고 canonical·robots·JSON-LD 를 `</head>` 앞에 붙인다. 기존 `setDocumentTitle`/`addCanonical` 을 대체.
- `<div id="root" data-prerendered="<routeKey>">`: `main.tsx` 는 이 값이 현재 주소의 `routeKey` 와 같을 때만 `hydrateRoot`. 다르면(예: `pnpm preview` 의 SPA 폴백, 없는 주소의 404.html) 비우고 새로 그린다.
- 출력 파일은 `<name>.html`(예시 리포트와 같은 검증된 패턴). `vercel.json` 이 `/terms`→`/terms.html`, `/guide/:slug`→`/guide/:slug.html` 등으로 리라이트. `/` 만 파일시스템 우선.
- 페이지가 framer `initial={{ opacity: 0 }}` 를 구우면 하이드레이션 전까지 투명하다(랜딩에서 겪은 문제). `entry-server.test.tsx` 가 모든 프리렌더 페이지에 대해 `opacity:0` 을 금지한다. `Entitlements.tsx` 는 transform-only 로 바꿨다.

### 진짜 404

- catch-all `/((?!api/).*)` 을 SPA 라우트 허용목록 `/((?:login|analyze|…|admin)(?:/.*)?)` 으로 좁혔다. 미매칭 경로는 Vercel 이 출력 루트의 `404.html`(프리렌더 NotFound + noindex)을 404 상태로 준다.
- `scripts/prerender-landing.test.js` 가 `App.tsx` 의 모든 최상위 라우트가 허용목록 또는 프리렌더 목록에 있는지 검사한다(CLAUDE.md 함정 1과 같은 수동 매핑).
- `trailingSlash: false` 로 `/terms/` → `/terms`.

### 구조화 데이터 — `client/src/lib/structuredData.ts`

- `/`: Organization + WebSite + SoftwareApplication(판매 중 4상품의 Offer, KRW). `/entitlements`: SoftwareApplication. 가이드: Article + BreadcrumbList.
- 프리렌더 시점에만 주입한다. 런타임 주입 없음(크롤러는 프리렌더 HTML 을 본다).

### sitemap · RSS

- mjs 가 프리렌더 목록에서 `sitemap.xml`(색인 대상만, `lastmod` = 메타의 `updated`)과 `rss.xml`(가이드, 네이버 제출용)을 생성한다. `client/public/sitemap.xml` 정적 사본은 빌드 때 덮어써진다.

### 가이드 콘텐츠 — `client/content/guides/*.md`

- frontmatter: `title, description, date, updated?, keywords, slug?, draft?`. `lib/guides.ts` 가 `import.meta.glob(?raw)` 로 읽고 30줄 파서로 frontmatter 를 뗀다. 마크다운 → HTML 은 `marked`(의존성 1개 추가). 레포 저자 콘텐츠라 sanitize 하지 않는다.
- 라우트 `/guide`(GuideIndex), `/guide/:slug`(GuideArticle, 미존재 slug → NotFound + noindex). 둘 다 lazy. `guides.ts` 는 마크다운 원문을 품으므로 초기 번들(seo.ts, RouteMeta)에서 import 하지 않는다. GuideArticle 이 `useLayoutEffect` 로 frontmatter 기반 메타를 덮어쓴다.
- 본문 스타일은 `@tailwindcss/typography`(`@plugin`) 의 `prose prose-invert`.
- 가이드 테스트가 경력직 키워드·점수/합격 보장 표현·`/analyze` 링크 누락·1,200자 미만을 막는다.

## 검증

- `pnpm exec vitest run client scripts`, `pnpm check`.
- `vite build && vite build --ssr … && node scripts/prerender-landing.mjs` 후 `dist/public` 의 각 HTML head 확인. `vite preview` 에서 `history.replaceState` 로 실제 경로를 흉내내 하이드레이션(SSR 노드 유지)·콘솔 에러 0 확인.
- 배포 후(Preview 배포 우선) curl: `/terms` 200, `/terms/` 308, `/없는경로` 404, `/company-report?sample=1` canonical, `/guide/없는-slug` 404.

## 운영(코드 밖)

- Google Search Console: 도메인 속성(DNS TXT) 등록 → sitemap 제출 → URL 검사·색인 요청.
- 네이버 서치어드바이저: `client/index.html` 의 주석 자리에 `naver-site-verification` 메타 → sitemap + RSS 제출.
- 외부 채널(네이버 블로그·스레드)은 요약 + 원문 링크만. 본문 복제는 cross-domain canonical 이 불가하므로 금지.
