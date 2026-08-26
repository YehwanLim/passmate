# CLAUDE.md — Pre:View

작업 태도·검증·Git 규칙은 **`AGENTS.md`가 정본**이다. 이 문서는 프로젝트 맥락만 담는다.

## 무엇인가

**Pre:View**(구 Passmate) — 취준생 자소서를 AI가 진단해 정성 리포트를 주는 서비스.
기업/직무 + 문항(최대 5개, 200~6,000자) 입력 → Gemini가 채용 담당자 시선의 리포트 생성.
점수·퍼센트는 쓰지 않는다. 분석은 **계정 크레딧**으로 통제(무료 1회 / 관리자 지급 / 유료).
현재 비공개 베타(RC), 작업 브랜치는 `codex/*`.

## 스택

React 19 + Vite + Wouter + Tailwind4/Radix · Vercel Serverless(`api/**/*.js`, **ESM JS**) ·
Prisma 7 + Supabase Postgres · Supabase Auth(Google) · Gemini · Vitest · **pnpm 전용**.

## 구조

| 경로 | 역할 |
| --- | --- |
| `client/src/pages` · `components` · `lib` | 화면 / 표현 / 클라이언트 유틸 (`@/` 별칭) |
| `api/` | Vercel 핸들러. 파일 경로 = URL. `[...route].js`가 여러 경로를 한 함수로 묶음 |
| `lib/` | 서버 공용: 인증, prisma, 엔타이틀먼트, 분석 라이프사이클, 레이트리밋, 감사로그 |
| `shared/prompts/reportPrompt.js` | 마스터 프롬프트 **단일 정의처** |
| `prisma/` · `tests/` · `docs/superpowers/{specs,plans}` | 스키마 / API·보안 테스트 / 기능별 설계 문서 |

## 핵심 흐름

**분석**: `POST /api/analyze`가 **202 접수증**만 주고, 클라이언트는 `/analysis-pending`에서
`GET /api/analysis-requests/:id`를 폴링한다.
상태: `PENDING → CALLING → PERSISTENCE_PENDING → SUCCEEDED | FAILED`
(prisma · `lib/analysis-request-lifecycle.js` · `client/src/lib/analysisRequest.ts`가 같은 집합을 공유 — 하나만 바꾸지 말 것).
멱등성 키 `(userId, idempotencyKey)` 유니크. 크레딧은 **선예약 → 성공 시 확정, 실패 시 취소**라 실패는 과금되지 않는다.
처리량: 무료 동시 1건·15분 3회 / 프리미엄 동시 2건·15분 10회.

**권한**: `requireAuthenticatedUser` → `requireActiveApplicationUser` → `requireAdministrator`.
소유권·권한은 **항상 서버 핸들러에서** 확인한다. 클라이언트 가드·스토리지는 근거가 아니다.

**기타**: 계정 삭제는 예약 후 일일 크론(`CRON_SECRET` Bearer)이 purge. 결제(Groble) 웹훅 로직은
`lib/`에 남아 있으나 현재 마운트된 라우트가 없고 `/api/entitlements`도 결제 URL을 `null`로 반환한다.

## 명령어

```bash
pnpm dev                         # 127.0.0.1:5173 + 로컬 API 미들웨어
pnpm check                       # tsc --noEmit
pnpm exec vitest run <경로>       # 대상 테스트 (기본값)
pnpm build                       # prebuild가 필수 env 검증 (DATABASE_URL 등)
pnpm exec prisma generate        # schema 변경 후
```
포맷은 `pnpm format`(전역) 대신 `pnpm exec prettier --write <파일>`.

## 함정

1. **로컬 API 라우팅은 수동 매핑**이다 — `vite.config.ts`의 `apiRoute()`. 현재 `/api/entitlements`,
   `/api/analysis-requests/:id`, `/api/cron/*`는 빠져 있다. 라우트를 추가·이동하면 여기도 확인.
2. **Vercel Hobby 12함수 제한** (`scripts/vercel-function-limit.test.js`). 새 엔드포인트는 기존 라우터에 얹기.
3. **`.vercel/output/`·`dist/`는 옛 빌드 산출물** — 소스로 착각하지 말 것.
4. **타임아웃 3형제는 한 세트**: 모델 100s < TTL 125s, `maxDuration` 120s.
5. 응답 필드명(`analysis_id`, `analysis_request_id` 등)과 에러 코드 문자열은 클라이언트 파서가 강제한다.
6. CSP는 `vercel.json`에 하드코딩 — 외부 도메인 추가 시 함께 수정.
7. 프롬프트 수정 시 `client/src/pages/reportPrompt.singleSource.test.ts`를 반드시 함께 확인.

## 안전

- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용. `VITE_*`에는 공개 URL/anon key만.
- 로그·감사 이벤트에 자소서 본문, AI 응답, 이메일, 토큰 금지.
- `prisma db push` / `migrate deploy|reset` 등 파괴적 명령과 대량·재귀 삭제는 명시적 요청 시에만.
- API 핸들러는 `withApiHandler`/`ApiError`로 감싸고, prisma는 `lib/prisma.js` 싱글턴만 사용.
- 테스트에서 AI·Supabase·결제를 실제로 호출하지 않는다 (핸들러는 의존성 주입 팩토리 패턴).
- 새 설계 문서는 한국어, `docs/superpowers/{specs,plans}/YYYY-MM-DD-주제.md`.
