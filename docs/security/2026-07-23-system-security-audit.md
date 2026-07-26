# PassMate 시스템 보안 전수감사 보고서

감사일: 2026-07-23

대상: PassMate (`job_prep_platform`)

기준 커밋: `37a5893a7fe765f1e49afcefd02bbec81302b9ce`
판정: **NO-GO — P0 이슈를 해결·재검증하기 전에는 스테이징 외 출시 금지**

## 1. 경영 요약

정적 코드 감사와 로컬 검증에서 이전 출시준비 검토의 가장 중요한 위험이 여전히 남아 있음을 확인했다. 사용자의 프로젝트·자소서 원문·AI 분석 결과를 다루는 API가 토큰 검증 및 객체 소유권 검증 없이 호출될 수 있으며, 분석 API는 인증·비용·속도·동시성 통제 없이 외부 AI 호출을 수행한다. 또한 일부 관리자 API는 서버 측 관리자 검증 없이 개인정보·모델 설정·외부 모델 호출 기능을 노출한다.

이번 실행은 **로컬 저장소와 로컬 검증 범위**다. 스테이징 URL, A/B/관리자 테스트 계정, Supabase 원격 정책, 결제 sandbox 서명 사양이 제공되지 않았으므로 원격 침투·RLS·WAF·배포 헤더·비용 한도 검증은 수행하지 않았다. 운영 환경이나 실제 사용자 데이터, 결제, AI 호출에는 접속하지 않았다.

## 2. 범위·방법·제한사항

### 수행한 항목

- `api/`, `lib/`, `server/`, Prisma migration·schema, Supabase 브라우저 접근, 인증·관리자 훅, 브라우저 저장소, 개인정보 문서, Vercel/Vite 구성의 정적 추적
- 현재 Vercel 배포 대상 API 11개와 Express/Vite 개발 경로 인벤토리화
- 추적 파일의 일반적인 API 키·DB URL 패턴 탐색(일치 파일 없음). 이는 전용 비밀 스캐너의 대체가 아니다.
- `npm run check` 통과
- 보안 관련 명시 테스트 실행: 12개 테스트 파일, 41개 assertion 통과
- `npm run build` 통과. 초기 JS는 1,812.50 kB(gzip 480.82 kB)로 Vite 경고가 발생했다.

### 수행하지 못한 항목

- 스테이징 A/B/관리자 권한 매트릭스, 실제 Supabase RLS, OAuth redirect allowlist, CDN/WAF·보안 헤더, 로그·백업 보존, Groble 실제 서명, AI provider 비용/보존 정책
- `npm audit`의 최신 취약점 조회. npm registry 접속이 제한됐고, 외부 레지스트리에 의존성 트리 메타데이터를 전송하는 실행은 별도 명시 승인이 필요해 중단했다.
- 전체 `pnpm exec vitest run`은 저장소 안의 별도 `.worktrees/job-role-categories`에 남은 오래된 테스트 5건이 실패했다. 본 작업 트리 소스의 실패로 판정하지 않았으며, 중첩 worktree를 테스트 탐색에서 제외해야 한다.

## 3. 공격 표면 인벤토리

| 경로 또는 런타임 | 메서드 | 코드상 인증·인가 | 판정 |
|---|---|---|---|
| `/api/analyze` | POST, OPTIONS | 없음; `Access-Control-Allow-Origin: *` | P0 |
| `/api/projects` | GET, POST | 없음; GET은 query `userId`, POST는 body `user` 신뢰 | P0 |
| `/api/projects/:projectId` | GET | 없음, 소유권 없음 | P0 |
| `/api/projects/:projectId/analyses` | GET | 없음, 소유권 없음 | P0 |
| `/api/analysis/:id` | GET | 없음, 소유권 없음 | P0 |
| `/api/feedback` | POST, OPTIONS | 없음; body `userId` 신뢰, CORS `*` | P0 |
| `/api/entitlements` 및 purchase intent | GET, POST | Bearer 토큰을 서버 검증 | P1: 생성 제한 부재 |
| `/api/admin/entitlements` | GET, PATCH | Bearer 토큰 + DB admin role | 정적 기준 양호 |
| `/api/admin/resume-analysis` | GET | 없음 | P0 |
| `/api/admin/ai-models` | GET, POST | 없음 | P0 |
| `/api/webhooks/groble` | POST | provider 서명 검증 없음; 현재 파서는 이벤트를 처리하지 않음 | P1 |
| Express/Vite 개발 `/api/analyze`·`/api/test-gemini` | POST 또는 GET | Vercel 구현과 다름, 인증 없음 | P0 (외부 노출 시) |

Vercel 소스에서 과거 `api/test-db.js`, `api/test.js`, `api/gemini.js`, `api/test-gemini.js`는 제거됐고, 함수 수 검사는 11개를 기대한다. 실제 배포본의 404 여부는 아직 확인하지 못했다.

## 4. 발견사항

### P0-01 — 사용자 데이터 API의 인증·객체 소유권 검증 부재

**영향:** 프로젝트, 지원 회사·직무, 자소서 원문, AI 결과가 다른 사용자에게 노출되거나 조작될 수 있다. POST 요청은 임의 사용자 정보를 이용해 사용자·프로젝트·분석·토큰 사용량을 만들거나 덮어쓸 수 있다.

**근거:** `api/projects.js:93-176,199-255`는 body `user`와 query `userId`를 신뢰한다. `api/projects/[projectId]/index.js:14-42`, `api/projects/[projectId]/analyses.js:14-47`, `api/analysis/[id].js:47-94`는 토큰과 `userId` 복합 조건 없이 ID만으로 조회한다.

**안전한 재검증:** 스테이징에서 비로그인=401, 소유자=2xx, 사용자 B의 사용자 A 객체=404를 모든 읽기·쓰기·삭제 경로에 대해 확인한다. 본문에 B의 `userId`를 넣은 요청도 A의 토큰 범위를 벗어나지 않아야 한다.

**수정 방향:** 공통 서버 인증을 선행하고, 토큰 `sub`만 사용자 식별자로 사용한다. 모든 단건 조회·수정·삭제는 `{ id, userId: token.sub }` 복합 조건을 사용하며 타 소유 객체에는 404를 반환한다.

### P0-02 — 공개 AI 분석 API와 비용·남용 통제 부재

**영향:** 무단 AI 호출, 비용 소진, 서비스 거부, 데이터 처리 경계 우회가 가능하다.

**근거:** `api/analyze.js:424-489`는 인증 없이 외부 AI 분석을 실행하고 CORS를 모든 origin에 허용한다. 사용자/IP별 속도 제한, 일일·전역 비용 상한, 동시성 제어, idempotency, 서버 측 kill switch가 없다. `lib/analysis-entitlements.js`의 reservation 기능도 실제 분석 경로에 연결되지 않았다. legacy `content` 형식은 `questions[]` 경로의 길이·정제 검증을 거치지 않는다.

**안전한 재검증:** 미인증=401, 이용권 소진=402, 한도 초과=429, kill switch=503, 같은 idempotency key=외부 호출·예약 1회, 동시 10건=잔여 이용권 초과 없음으로 확인한다. AI 호출은 가짜 입력 10회 이하로 제한한다.

**수정 방향:** 인증 → 원자적 reservation → 모델 호출 → 성공 finalize / 실패 cancel의 서버 흐름으로 통합한다. 사용자·IP·전역 한도, timeout, 비용 알림, allowlist, kill switch를 적용한다.

### P0-03 — 서버 측 보호가 없는 관리자 API

**영향:** `/api/admin/resume-analysis`는 사용자·프로젝트·비용 메타데이터를 노출하고, `/api/admin/ai-models`는 모델 상태·부분 마스킹 키 정보·외부 모델 호출·설정 변경을 노출한다.

**근거:** `api/admin/resume-analysis.js:44-105`와 `api/admin/ai-models.js:334-372`에는 `requireAuthenticatedUser` 또는 관리자 role 검증이 없다. UI `AdminGuard`는 브라우저 탐색 제한일 뿐 API 보안 경계가 아니다.

**안전한 재검증:** 비로그인=401, 일반 사용자=403, 관리자=문서화된 2xx를 GET·POST·PATCH 전체에 적용한다. 일반 사용자의 모델 테스트·설정 쓰기·PII 조회가 발생하지 않아야 한다.

**수정 방향:** 단일 `requireAdministrator`를 모든 `/api/admin/*`에 강제하고, 모델 이름/provider를 allowlist·timeout·요청 제한·관리자 감사 로그로 통제한다.

### P0-04 — 피드백 가장과 데이터 오염

**영향:** 임의 UUID로 사용자 생성·가장, 다른 분석에 대한 피드백 생성·갱신, DB 오염이 가능하다.

**근거:** `client/src/components/FeedbackSection.tsx:50-74`가 브라우저 UUID를 보내고 `api/feedback.js:23-80`이 이를 사용자 ID로 신뢰한다. 분석 소유권 및 comment schema·길이 제한이 없다.

**수정 방향:** 로그인 사용자 토큰만 사용하고 대상 분석에 대한 접근 권한을 확인한다. 익명 피드백을 유지한다면 별도 설계된 단기 서명 토큰과 독립 데이터 모델을 사용한다.

### P0-05 — RLS와 브라우저 직접 관리자 접근의 안전성 미입증

**영향:** 원격 RLS가 약하거나 누락된 경우 anon 클라이언트로 사용자·자소서·AI 결과·프롬프트·오류 정보에 직접 접근하거나 변경할 수 있다.

**근거:** `prisma/migrations/add_user_role.sql:16-22`의 RLS 문은 주석 처리되어 있다. 관리자 훅은 `users`, `analyses`, `token_usages`, `feedbacks`, `prompt_templates` 등을 브라우저 Supabase 클라이언트로 직접 접근한다(예: `client/src/hooks/admin/useAnalysisDetail.ts:118-174`, `usePrompts.ts:124-206`).

**수정 방향:** 모든 테이블의 RLS enable/force 및 SELECT/INSERT/UPDATE/DELETE `WITH CHECK` 정책을 migration으로 관리한다. 실제 JWT로 anon/A/B/admin 정책 매트릭스를 DB 통합 테스트에 고정하고, 관리자 작업은 서버 API 또는 최소권한 RPC로 수렴시킨다.

### P1-01 — 결제 웹훅은 fail-closed이나 실제 서명·결제 처리가 미완성

**영향:** 현재는 임의 credit grant 위험이 낮지만 실제 결제가 반영되지 않는다. 서명 검증 없이 parser를 활성화하면 즉시 위조 위험이 생긴다.

**근거:** `api/webhooks/groble.js:60-74`의 parser는 `null`을 반환한다. `.env.example`의 `GROBLE_WEBHOOK_SECRET`은 코드에서 사용되지 않는다.

**수정 방향:** Groble의 raw-body·서명 헤더·timestamp·replay·금액·통화 계약을 fixture로 고정한 뒤 HMAC 검증, purchase intent 매칭, provider payment ID uniqueness, 원자적 credit grant를 적용한다.

### P1-02 — 민감 정보의 브라우저 저장·로그아웃 정리 부재

**영향:** 공유 장비, 브라우저 프로필 탈취, 이후 XSS 발생 시 자소서 원문·AI 결과·익명 ID가 장기간 노출될 수 있다.

**근거:** `client/src/utils/storage.ts:96-199,229-356`는 분석 원문·결과·회사·직무·익명 ID를 `localStorage`와 `sessionStorage`에 저장한다. `AuthContext` 로그아웃은 Supabase sign-out만 수행한다. 사용자 이메일의 console log도 존재한다.

**수정 방향:** 서버 저장을 기본으로 하고, 불가피한 캐시는 사용자 namespacing·짧은 TTL·로그아웃/탈퇴 일괄 삭제를 적용한다. 운영 로그에는 원문·응답·토큰을 기록하지 않는다.

### P1-03 — 삭제·장애 UI가 실제 보안 상태를 오인시킴

**근거:** `api/projects/[projectId]/index.js`는 GET만 지원하는 반면 `client/src/pages/MyProjects.tsx:118-127`은 실패해도 목록에서 제거한다. `MyProjects`, `MyAnalyses`, `ReportResult`에는 운영 API 실패 시 샘플 데이터를 보이는 경로가 남아 있다.

**수정 방향:** 소유권 검증 DELETE 성공 후에만 UI에서 제거하고, 401/403/404/500/네트워크 오류에는 명확한 오류·재시도·빈 상태만 표시한다.

### P1-04 — 런타임 불일치·보안 헤더·운영 제어 부재

**근거:** Vercel의 `api/analyze.js`와 Express/Vite `server/api/analyze.ts`는 다른 구현·검증 경계를 가진다. Vite 개발 경로에는 GET `/api/test-gemini`가 남아 있다. `vercel.json`에는 CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` 선언이 없다.

**수정 방향:** 서버 분석 구현을 하나로 수렴시키고 route parity test를 추가한다. 개발 진단 라우트는 외부 노출을 막고, 배포 헤더·WAF·요청 제한·구조화된 마스킹 로그·경보를 코드와 인프라에서 함께 검증한다.

### P1-05 — 개인정보 고지와 실제 보관·삭제 흐름의 차이

**근거:** Privacy/Terms 화면은 존재하지만 계정·데이터 삭제 API, 분석 캐시·결제 raw event·로그·백업의 보관/삭제 실행은 확인되지 않았다. 결제 이벤트는 `payment_entitlements.raw_event`에 전체 JSON을 보관하도록 설계돼 있다.

**수정 방향:** 수집·AI 위탁·로그·결제·백업 데이터별 보관기간, 삭제 주체, 증적, 예외를 정의하고 실제 삭제 워크플로로 연결한다.

### P2 — 방어 심화 및 품질 부채

- React의 기본 escaping은 확인됐지만 정규식 기반 `sanitize.ts`에만 의존하지 말고, AI JSON·프롬프트·URL·`dangerouslySetInnerHTML` sink에 저장형 XSS 회귀 테스트와 CSP를 적용한다.
- `api/admin/ai-models`의 파일 기반 설정 저장은 Vercel filesystem에서 영속되지 않을 수 있다. 서버 검증·감사 로그가 있는 DB 설정으로 옮긴다.
- `.env.example`에는 서버 인증에 필요한 `SUPABASE_URL`이 없지만 `lib/auth.js`는 이를 요구한다. 배포 preflight를 실제 런타임 필수 변수와 일치시킨다.
- 테스트 탐색에서 `.worktrees/`를 제외하고 인증·RLS·BOLA·한도·웹훅 회귀 테스트를 CI 배포 게이트로 추가한다.

## 5. 2026-07-11 보고서 갱신

| 기존 항목 | 상태 | 근거 |
|---|---|---|
| BLOCK-01 데이터 API 인증·BOLA | **미해결** | 목록·상세·분석 조회와 저장이 무인증 또는 body/query 사용자 식별자 신뢰 |
| BLOCK-02 Gemini 공개·비용 제한 | **미해결** | `/api/analyze` 무인증·무제한, entitlement reservation 미연결 |
| BLOCK-03 공개 GET DB 테스트 API | **부분 해결** | Vercel `api/` 소스에서는 제거됐으나 Vite 개발 GET Gemini 경로와 실제 배포 404는 미검증 |
| BLOCK-04 피드백 `userId` 신뢰 | **미해결** | 브라우저 UUID와 API body userId를 계속 신뢰 |
| BLOCK-05 RLS·클라이언트 관리자 의존 | **미해결** | RLS migration 부재/주석, 직접 Supabase 관리자 접근, 공개 관리자 API |
| BETA-01 분석 영구 저장 | **부분 해결** | 저장 API는 추가됐으나 인증·원자적 상태·비용 흐름이 없음 |
| BETA-02 목 폴백 | **미해결** | 운영 오류 시 샘플 데이터 경로 유지 |
| BETA-03 UI 전용 삭제 | **미해결** | DELETE API 부재, 실패 후 UI 제거 |
| BETA-04 브라우저 장기 저장 | **미해결** | TTL·logout cleanup 부재 |
| BETA-05 타입 검사 실패 | **해결(현재 기준)** | `npm run check` 통과 |
| BETA-06 헤더·관측·비상 제어 | **미해결(정적)** | 저장소 내 정책·킬 스위치·비용 한도 미확인 |
| BETA-07 개인정보 처리·삭제 | **부분 해결** | 문서는 추가됐으나 실행·보존 증적 없음 |

## 6. 출시 전 remediation backlog

### P0 — 출시 차단

1. 모든 데이터·분석·피드백 API에 서버 인증과 token-derived 객체 소유권 검증을 적용한다.
2. 모든 `/api/admin/*`에 서버 측 관리자 guard를 적용한다.
3. 분석 호출에 entitlement reservation, rate/cost/concurrency/idempotency/kill switch를 실제 연결한다.
4. RLS 정책을 migration으로 코드화하고 원격 DB에서 A/B/admin 매트릭스를 통과시킨다.
5. 피드백의 body `userId` 신뢰와 임의 사용자 upsert를 제거한다.

### P1 — 제한 베타 전 권고

1. Groble 실제 서명 사양으로 웹훅을 완성하고 sandbox에서 재전송·중복·불일치를 검증한다.
2. 원문·AI 결과의 로컬 저장을 최소화하고 로그아웃·탈퇴·보관만료 삭제를 구현한다.
3. 서버 DELETE와 오류 UI를 정합하게 만들고 목 폴백을 운영에서 제거한다.
4. CSP 등 보안 헤더, 로그 마스킹, 관측·경보, runtime parity와 비밀 preflight를 추가한다.
5. 개인정보·AI 위탁·결제·로그·백업의 보관 및 삭제 절차를 실제 운영 흐름으로 구현한다.

### P2 — 방어 심화

1. XSS sink·AI 출력 렌더링 회귀 테스트와 URL/HTML allowlist를 추가한다.
2. 관리자 설정을 서버 영속 저장과 감사 로그로 전환한다.
3. 중첩 worktree를 테스트 탐색에서 제외하고, 외부 승인 후 dependency CVE 검사를 CI에 기록한다.

## 7. 재검증 게이트

다음이 모두 충족되기 전에는 판정을 GO로 변경하지 않는다.

- 모든 API와 Supabase 테이블에 대해 anon/A/B/admin 실제 JWT 매트릭스가 기대 401/403/404/2xx를 보인다.
- 스테이징에서 사용자 B가 사용자 A의 프로젝트·분석·피드백·이용권을 읽거나 쓰거나 삭제할 수 없다.
- 분석 API가 무인증 요청을 거부하고, 중복·동시 요청에서도 이용권과 외부 호출이 정확히 한 번 처리된다.
- 관리자·웹훅·RLS·CORS·보안 헤더·로그 마스킹·삭제 보존이 실제 배포 환경에서 검증된다.
- `/api/test*` 및 임의 AI 프록시가 배포 환경에서 비노출이고, typecheck·build·권한 회귀·외부 CVE 검사가 CI gate를 통과한다.

## 부록: 실행 증적

| 명령 | 결과 |
|---|---|
| `npm run check` | 통과 |
| 보안 관련 Vitest 명시 실행 | 12 files / 41 tests 통과 |
| `npm run build` | 통과, 대형 bundle 경고 |
| `pnpm exec vitest run` | 90 files 통과, `.worktrees/job-role-categories`의 오래된 5 test 실패 |
| `npm audit --omit=dev` | 외부 registry 접근 및 의존성 트리 메타데이터 전송 승인이 없어 미검증 |
