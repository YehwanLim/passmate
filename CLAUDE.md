# CLAUDE.md — Pre:View 에이전트 가이드

이 저장소에서 코드를 **쓰고, 리뷰하고, 디버깅하고, 리팩터링하고, 설명할 때** 항상 이 문서를 적용한다.
이 파일이 **정본**이다. `AGENTS.md`는 이 파일을 가리키는 심링크이므로 따로 고치지 않는다.

## 무엇인가

**Pre:View**(구 Passmate) — 취준생 자소서를 AI가 진단해 정성 리포트를 주는 서비스.
기업/직무 + 문항(최대 5개, 200~6,000자) 입력 → Gemini가 채용 담당자 시선의 리포트 생성.
점수·퍼센트는 쓰지 않는다. 분석은 **계정 크레딧**으로 통제(무료 1회 / 관리자 지급 / 유료).
현재 비공개 베타(RC), 작업 브랜치는 `codex/*`.

## 스택

React 19 + Vite + Wouter + Tailwind4/Radix · Vercel Serverless(`api/**/*.js`, **ESM JS**) ·
Prisma 7 + Supabase Postgres · Supabase Auth(Google) · Gemini · Vitest · **pnpm 전용**.

## 작업 태도

실용적이고 신중하게: **먼저 이해하고, 외과적으로 고치고, 좁게 검증한다.**
영리함이나 예측성 설계가 아니라 명료한 근거·작은 diff·주변 코드와 같은 스타일·관찰 가능한 진전을 목표로 한다.

코드를 고치기 전에:

- 요청을 **검증 가능한 결과**로 바꿔 말한다.
- 구현을 실제로 좌우하는 가정을 밝힌다.
- 합리적인 선택지가 둘 이상이면 트레이드오프를 하나 짚는다.
- 추측이 실질적 위험을 만들 때만 질문을 **하나** 한다. 명백하고 위험이 낮은 일은 가정을 밝히고 진행한다.

요청에 필요한 만큼만 구현한다:

- 요청하지 않은 기능·의존성·설정·추상화·광범위 리팩터링을 얹지 않는다.
- 곁가지 코드를 부수 효과로 포맷하거나 이름을 바꾸거나 재배치하지 않는다.
- 기존 패턴을 보존하고, **내 변경 때문에** 쓰이지 않게 된 import·헬퍼만 정리한다.
- 무관한 문제는 기회주의적으로 고치지 말고 따로 보고한다.

문서 언어: 새로 쓰거나 갱신하는 설계 문서는 **한국어**. 코드 식별자·파일 경로·명령어와 원문 표기가 더 명확한 용어는 원형을 유지한다.
새 설계 문서 위치는 `docs/superpowers/{specs,plans}/YYYY-MM-DD-주제.md`.

## 구조

| 경로 | 역할 |
| --- | --- |
| `client/src/pages` · `components` · `lib` | 화면 오케스트레이션 / 재사용 표현 / 클라이언트 유틸 |
| `client/src/pages/admin/` | 관리자 UI와 라우팅. **클라이언트 가드는 권한 경계가 아니다.** |
| `api/` | Vercel 핸들러(ESM JS). 파일 경로 = URL. `[...route].js`가 여러 경로를 한 함수로 묶음 |
| `lib/` | 서버 공용: 인증, prisma, 엔타이틀먼트, 분석 라이프사이클, 레이트리밋, 감사로그 |
| `shared/prompts/reportPrompt.js` | 마스터 프롬프트 **단일 정의처** |
| `prisma/` | Prisma 스키마와 DB 설정 |
| `tests/api/` | API 대상 Vitest. 클라이언트 테스트는 보통 `*.test.ts(x)`로 같은 폴더에 둔다 |
| `scripts/` | 검증·수동 개발 유틸. **의존하기 전에 스크립트를 먼저 읽는다.** |
| `docs/superpowers/{specs,plans}` | 과거·현재 설계 문서. 맥락으로 쓰되 요청 없이 고치지 않는다 |

별칭: `@/` = `client/src`, `@shared/` = `shared`, `@assets/` = `attached_assets`.

## 명령어

`pnpm`만 쓴다. npm을 쓰거나 락파일을 바꾸지 않는다(의존성 변경이 과제 자체일 때만 예외).

| 목적 | 명령 | 비고 |
| --- | --- | --- |
| 로컬 개발 | `pnpm dev` | `127.0.0.1:5173` + 로컬 API 미들웨어 |
| 타입 체크 | `pnpm check` | TS 프로덕션 코드를 고쳤으면 가급적 실행 |
| 대상 테스트 | `pnpm exec vitest run <경로>` | **기본값.** 변경을 덮는 최소 집합 |
| 전체 테스트 | `pnpm exec vitest run` | 교차 관심사·고위험 변경에, 환경이 갖춰졌을 때 |
| 프로덕션 빌드 | `pnpm build` | prebuild가 `DATABASE_URL` 등 필수 env 검증. **자격증명을 지어내서 통과시키지 않는다** |
| Prisma 재생성 | `pnpm exec prisma generate` | `schema.prisma` 변경 후 |

포맷은 저장소 전체를 훑는 `pnpm format` 대신 파일을 명시해서: `pnpm exec prettier --write client/src/pages/Home.tsx`.

## 핵심 흐름

**분석**: `POST /api/analyze`가 **202 접수증**만 주고, 클라이언트는 `/analysis-pending`에서
`GET /api/analysis-requests/:id`를 폴링한다.
상태: `PENDING → CALLING → PERSISTENCE_PENDING → SUCCEEDED | FAILED`
(prisma · `lib/analysis-request-lifecycle.js` · `client/src/lib/analysisRequest.ts`가 같은 집합을 공유 — 하나만 바꾸지 말 것).
멱등성 키 `(userId, idempotencyKey)` 유니크. 크레딧은 **선예약 → 성공 시 확정, 실패 시 취소**라 실패는 과금되지 않는다.
처리량: 무료 동시 1건·15분 3회 / 프리미엄 동시 2건·15분 10회.

**권한**: `requireAuthenticatedUser` → `requireActiveApplicationUser` → `requireAdministrator`.
소유권·권한은 **항상 서버 핸들러에서** 확인한다. 클라이언트 가드·브라우저 스토리지·Supabase 세션 상태는 편의 계층일 뿐 근거가 아니다.

**기타**: 계정 삭제는 예약 후 일일 크론(`CRON_SECRET` Bearer)이 purge. 결제(Groble) 웹훅 로직은
`lib/`에 남아 있으나 현재 마운트된 라우트가 없고 `/api/entitlements`도 결제 URL을 `null`로 반환한다.

## 프론트엔드 규약

- 페이지 오케스트레이션은 `pages/`, 재사용 표현은 `components/`, 재사용 상태·행동은 훅/컨텍스트/작은 유틸에 — **실제 호출자가 둘 이상일 때만** 꺼낸다.
- `client/src/App.tsx`의 Wouter 라우트 구조를 보존한다. 사용자 접근·리포트 이동·관리자 이동을 바꾸면 해당 라우트와 가드 커버리지도 함께 다룬다.
- 기존 Tailwind·Radix·로컬 UI 컴포넌트 패턴을 쓴다. 국소 변경을 위해 경쟁하는 스타일링/컴포넌트 라이브러리를 들이지 않는다.

## API · AI · 결제 규약

- 핸들러는 작고 명시적인 메서드 디스패처로 두고, 안정적인 JSON 응답과 적절한 상태 코드를 유지한다. `withApiHandler`/`ApiError`로 감싼다.
- 라우트를 **추가하거나 옮기면** 배포 경로와 `vite.config.ts`의 개발 미들웨어 매핑을 **둘 다** 확인한다(함정 1).
- 보호된 데이터·행동은 서버 핸들러에서 권한을 요구한다. 관리자 페이지나 클라이언트 역할 체크에만 의존하지 않는다.
- 테스트에서 AI·Supabase·결제·웹훅을 **실제로 호출하지 않는다**. 핸들러는 의존성 주입 팩토리 패턴이므로 요청·검증·권한·응답·에러 경로를 로컬에서 검증한다.
- 엔타이틀먼트, 구매 의도, 결제 웹훅, 프롬프트 활성화, AI 사용량, 분석 접근은 **사용자에게 보이는 비즈니스 규칙**이다. 과제가 명시적으로 바꾸라 하지 않는 한 권한·멱등성·에러 의미론을 보존한다.

## 데이터와 시크릿

- prisma는 `lib/prisma.js` 싱글턴만 쓴다. 핸들러에서 `PrismaClient`를 새로 만들지 않는다.
- `DATABASE_URL`은 런타임(Prisma 어댑터)용, `DIRECT_URL`은 마이그레이션·직접 스키마 작업용(`prisma.config.ts` 설정대로).
- 스키마 변경 후에는 `prisma generate` + 해당 모델/API 경계를 건드리는 대상 테스트를 돌린다.
- `prisma db push` / `migrate deploy|reset` 등 파괴적 명령은 **사용자가 명시적으로 요청하고 대상 환경을 지목했을 때만** 실행한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용. `VITE_*`에는 공개 URL/anon key만.
- 소스·픽스처·스크린샷·로그에 시크릿을 넣지 않는다. 로그·감사 이벤트에 **자소서 본문, AI 응답, 이메일, 토큰 금지**.
- `.env`는 추적하지 않는다. `.env.example`은 설정 계약이 바뀔 때만, 실제 값이 아닌 플레이스홀더로 갱신한다.

## 함정

1. **로컬 API 라우팅은 수동 매핑**이다 — `vite.config.ts`의 `apiRoute()`. 현재 `/api/entitlements`,
   `/api/analysis-requests/:id`, `/api/cron/*`는 빠져 있다.
2. **Vercel Hobby 12함수 제한** (`scripts/vercel-function-limit.test.js`). 새 엔드포인트는 기존 라우터에 얹기.
3. **`.vercel/output/`·`dist/`는 옛 빌드 산출물** — 소스로 착각하지 말 것.
4. **타임아웃 3형제는 한 세트**: 모델 100s < TTL 125s, `maxDuration` 120s.
5. 응답 필드명(`analysis_id`, `analysis_request_id` 등)과 에러 코드 문자열은 클라이언트 파서가 강제한다.
6. CSP는 `vercel.json`에 하드코딩 — 외부 도메인 추가 시 함께 수정.
7. 프롬프트 수정 시 `client/src/pages/reportPrompt.singleSource.test.ts`를 반드시 함께 확인.

## 검증 기준

완료를 주장하기 전에 성공을 정의한다:

- **버그 수정**: 실패하던 케이스와 수정 후 기대 동작을 말한다.
- **기능**: 사용자에게 보이는 동작과 관련된 권한·데이터 경계를 말한다.
- **리팩터링**: 변하지 않아야 할 동작을 말한다.
- **리뷰**: 구체적 위험, 빠진 테스트, 있을 법한 회귀를 짚는다.

의미 있는 최소 검증을 쓴다:

- UI·클라이언트 유틸: 같은 폴더의 Vitest + TS를 고쳤으면 `pnpm check`.
- API: `tests/api/`의 해당 테스트. 동작이 바뀌면 권한·에러 경로 커버리지를 포함한다.
- Prisma 스키마: `prisma generate` + 영향 테스트 + 생성 타입 소비자가 범위에 있으면 `pnpm check`.
- 빌드·Vite 설정·라우팅·환경 계약·교차 관심사: `DATABASE_URL`이 로컬에 있을 때만 `pnpm build`. 못 돌렸으면 **못 돌렸다고 분명히 말한다**.

테스트·빌드·배포·결제·외부 연동이 성공했다고 **현재 명령 출력이나 명시적 외부 결과 없이** 주장하지 않는다.

## Git과 변경 안전

- 코딩 과제 시작 시 저장소와 현재 브랜치를 확인한다. 사용자가 달리 요청하지 않으면 현재 브랜치를 쓴다.
- 스테이징 전에 워킹 트리를 살핀다. 무관한 기존 변경을 보존하고 이번 요청에 묶인 파일만 스테이징한다.
- 독립적으로 가치 있는 검증된 이정표가 여럿 나올 일이면, 체크포인트 커밋을 푸시할지 **묻는다**. 그 외에는 요청이나 사전 승인 없이 커밋·푸시하지 않는다.
- 커밋 전에 포함된 변경을 요약하고, 푸시 전에 가능한 검사를 돌린다.
- force-push, 히스토리 재작성, 리모트·저장소 설정 변경, 브랜치 보호 변경, 협력자 관리, 브랜치 삭제는 하지 않는다.

삭제는 프로덕션 데이터 변경과 같은 무게로 다룬다:

- 대량·재귀 삭제, 와일드카드 정리 삭제, 스크립트 삭제 루프를 쓰지 않는다.
- 꼭 필요할 때만, **한 명령에 명시적 리터럴 경로 하나씩** 삭제한다.
- 여러 파일을 지워야 하거나 재귀 정리가 필요해 보이면 먼저 묻는다.

## 완료 보고

사소하지 않은 작업은 이렇게 요약한다:

```text
가정:
변경:
검증:
남은 위험:
```

간결하게. 명백한 한 줄 수정에는 이 격식을 생략한다.
