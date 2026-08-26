# PassMate 시스템 보안감사 보고서 (2026-08-26)

- 작성일: 2026-08-26 (KST)
- 감사 대상 브랜치: `codex/release-candidate`
- 감사 시작 시점 revision: `7084a6d` (`fix: prepare secure beta release candidate`)
- 감사 방식: 소스·설정·마이그레이션 정적 분석, 로컬 회귀 테스트 실행, 프로덕션 의존성 감사
- 범위 밖: 운영 환경, `main` 브랜치, 운영 DB, Supabase 원격 설정, Vercel Preview 실환경 요청
- 데이터 원칙: 토큰·DB URI·Supabase 키·Cron 비밀값·실사용자 ID·자소서 원문을 이 문서와 로그, 테스트 결과 어디에도 기록하지 않았다.
- 최종 판정: **출시 GO 아님.** Preview 실환경 검증을 하지 않았으므로 판정을 내리지 않는다. 이 감사는 코드·설정 레벨의 결함을 찾아 수정한 기록이다.

## 1. 경영 요약

이번 감사에서 **인증 우회나 IDOR은 발견되지 않았다.** 사용자 데이터 조회·수정·삭제 경로 전체가 예외 없이 `userId` 로 스코핑되어 있고, 이용권 예약은 `SELECT ... FOR UPDATE` 로 사용자 단위 직렬화가 보장된다. 관리자 핸들러 13개는 모두 각자 `requireAdministrator` 를 호출한다.

대신 세 종류의 결함을 찾았고 모두 수정했다.

1. **관리자 라우터가 인증 이전에 프로토타입 속성으로 갈라졌다.** 비로그인 요청 하나로 서버리스 함수를 타임아웃까지 붙잡아둘 수 있었다.
2. **기본 거부(RLS + 권한 회수) 목록이 하드코딩이라 나중에 만든 테이블 2개가 빠져 있었다.** 그중 하나는 이메일 스냅샷을 보관한다.
3. **개발용 저작 도구 두 개가 프로덕션 번들에 실려 나가고 있었다.** 현재는 CSP 가 실행을 막고 있었지만, 그건 정책이 아니라 우연이었다.

추가로 **소스 어디에서도 import 되지 않는 프로덕션 의존성 7개**가 `pnpm audit --prod` 경고의 대부분을 끌고 오고 있었다. 제거만으로 high 23 → 8, moderate 68 → 22 로 줄었다.

## 2. 서비스 구조 (감사 시점 기준)

```
브라우저 (React + Vite + Wouter)
  └ Supabase Auth (PKCE) → access_token
      └ fetch(Authorization: Bearer …)      쿠키 미사용 → CSRF 표면 없음
          └ Vercel Serverless (api/*.js)
              └ lib/auth.js 토큰 검증 → public.users 조회 → 역할·삭제예약 확인
                  └ Prisma (pg adapter) → Supabase PostgreSQL
```

배포되는 함수는 13개다.

| 구분 | 엔드포인트 | 인증 경계 |
|---|---|---|
| 사용자 | `analyze`, `analysis/[id]`, `analysis-requests/[id]`, `projects`, `projects/[projectId]`(+`/analyses`), `feedback`, `entitlements`, `auth/me` | `requireActiveApplicationUser` |
| 계정 | `account/[...route]` (삭제 예약 / 취소) | 예약은 active 사용자, 취소는 인증만 (삭제 대기자도 취소할 수 있어야 하므로 의도된 차이) |
| 관리자 | `admin/[...route]` → `lib/admin-handlers/*` 13개 | 각 핸들러가 `requireAdministrator` 호출 |
| Cron | `cron/purge-deleted-users` | `CRON_SECRET` + `timingSafeEqual` |

분석 파이프라인은 `POST /analyze` 에서 입력 정규화(문항 ≤ 20, 200~6000자) → 멱등키 검사 → kill switch → **단일 트랜잭션**에서 이용권 행 잠금·동시성 한도·rate limit·예약·레코드 생성 → `202` 응답 후 `waitUntil()` 백그라운드 모델 호출(모델 타임아웃 100초 / 함수 예산 120초) → 클라이언트가 `GET /analysis-requests/:id` 폴링으로 이어진다.

## 3. 확인한 방어선 (유지 대상)

| 항목 | 근거 |
|---|---|
| 소유권 스코핑 | 모든 사용자 조회가 `findFirst({ where: { id, userId } })`, 프로젝트 삭제는 `deleteMany({ where: { id, userId } })` 후 count 0 이면 404 |
| 이용권 경쟁 조건 | `getLockedEntitlement` 의 `FOR UPDATE` 가 트랜잭션 전체를 사용자 단위로 직렬화. 동시성 카운트·rate limit·예약이 한 덩어리로 원자적 |
| 멱등성 | `(userId, idempotencyKey)` 유니크 + 서버 측 `requestHash` 로 새로고침 재요청 흡수 |
| AI 모델 | 관리자 설정과 연결 테스트 모두 `isAllowedModel` allowlist 통과 필수 |
| DB 기본 거부 | 애플리케이션 테이블에 RLS 활성 + `anon`/`authenticated` 권한 전면 REVOKE |
| Cron 인증 | 길이 확인 후 `timingSafeEqual` |
| 로깅 | 오류 로그가 안전한 코드·requestId·status 만 남기고 자소서·토큰·이메일을 남기지 않음 (회귀 테스트로 보장) |
| 브라우저 저장소 | 자소서·리포트·익명 ID·피드백 캐시 제거, Supabase OAuth 세션만 예외 |
| 시크릿 | `.env` 가 git 에 추적된 이력 없음. 추적 파일과 수동 스크립트에 하드코딩 키 없음 |

## 4. 발견 사항과 조치

### SEC-01 — 관리자 라우터의 프로토타입 속성 조회 (중, 수정 완료)

`api/admin/[...route].js` 의 `targetFor()` 가 `handlers[segments[0]]` 로 조회해 프로토타입 체인까지 도달했다. 모의 DB 로 실제 재현했다.

| 요청 | 수정 전 | 수정 후 |
|---|---|---|
| `/api/admin/constructor` | 응답 없음 (함수가 타임아웃까지 매달림) | 401 |
| `/api/admin/toString` | 응답 없음 | 401 |
| `/api/admin/hasOwnProperty` | 응답 없음 | 401 |
| `/api/admin/__proto__` | 인증 전 TypeError (미처리) | 401 |
| `/api/admin/users` | 401 | 401 |

권한 우회는 아니다. 그러나 비로그인 요청 한 줄로 서버리스 함수를 점유해 과금·가용성에 영향을 줄 수 있고, 이 경로는 `requireAdmin` 에 도달하기 전에 갈렸다.

**조치**: 핸들러 조회를 own property + function 검사로 좁히고(`resolveHandler`), 2단 경로의 리소스명도 `Object.hasOwn` 으로 확인하는 고정 맵으로 바꿨다. 디스패치를 포함한 라우터 전체를 `try/catch` 안으로 옮겨 어떤 경로든 안전한 JSON 오류로 끝나게 했다. 회귀 테스트 5개 추가.

### SEC-02 — 기본 거부 목록에서 누락된 테이블 2개 (중, 수정 완료)

`20260723_add_security_primitives` 가 14개 테이블을 배열로 **하드코딩**해 RLS 활성화와 권한 회수를 적용한다. `credit_coupons` 와 `admin_credit_grants` 는 그보다 뒤인 `20260726_add_admin_credit_management` 에서 생성되어 두 처리 모두에서 빠졌다. `admin_credit_grants` 는 지급 시점의 이메일 스냅샷을 보관한다(`20260726_snapshot_admin_credit_grant_email`).

현재는 Supabase Data API 가 비활성이라 도달 불가다. 다만 이건 **설계가 아니라 우연**이며, Data API 가 다시 켜지는 순간 노출된다.

**조치**: 두 테이블을 동일한 기본 거부 상태로 맞추는 마이그레이션(`20260826_secure_admin_credit_tables`)을 추가했다. 재발 방지를 위해 "마이그레이션이 만든 모든 테이블은 RLS 와 REVOKE 를 가진다"를 검증하는 테스트(`tests/security/database-default-deny.test.js`)를 넣었다. 이 테스트는 새 마이그레이션을 제거하면 실제로 실패하는 것을 확인했다.

### SEC-03 — 프로덕션 번들에 실린 개발용 저작 도구 (중, 수정 완료)

`vite.config.ts` 가 두 플러그인을 조건 없이 등록해 `vite build` 산출물에도 포함시켰다.

- **vite-plugin-manus-runtime**: 약 360KB 인라인 스크립트를 `index.html` 에 주입. DOM 검사, 요소 선택기, 페이지 스크린샷(`modern-screenshot`), 부모 프레임으로의 `postMessage(..., "*")` 브리지 포함. 플러그인 코드에 fetch/WebSocket/sendBeacon 은 없어 외부 전송 경로는 확인되지 않았다.
- **@builder.io/vite-plugin-jsx-loc**: 렌더링되는 모든 엘리먼트에 소스 파일 경로와 줄 번호를 `data-loc` 속성으로 삽입.

현재 CSP(`script-src 'self'`, `unsafe-inline` 없음)와 `frame-ancestors 'none'` 이 인라인 런타임의 실행을 막고 있었다. 이전 감사(2026-07-26)에서 원인이 특정되지 않았던 콘솔 CSP 오류의 실제 출처가 이것이다. 자소서 원문이 렌더링되는 화면에 스크린샷 가능한 편집 오버레이를 실어 보낼 이유는 없다.

**조치**: 두 플러그인 모두 `apply: "serve"` 로 개발 전용 처리. 빌드된 설정에서 `apply` 값을 실제로 확인하는 테스트를 추가했다.

부수 효과로 `index.html` 367KB → 924B, JS 청크 약 1.75MB → 1.62MB (gzip 462KB) 로 줄었다. 이전 보고서의 P2-02 번들 항목이 일부 해소됐다.

### SEC-04 — 미사용 프로덕션 의존성 (중, 수정 완료)

`pnpm audit --prod` 경고의 대부분이 **소스 어디에서도 import 되지 않는** 패키지에서 왔다.

| 제거한 패키지 | 딸려오던 취약 패키지 |
|---|---|
| `streamdown` | mermaid → dompurify (XSS 계열 다수), lodash-es, mdast-util-to-hast |
| `@google/genai` | protobufjs, ws (분석은 raw `fetch` 로 직접 호출한다) |
| `@google/generative-ai` | — |
| `axios` | form-data (CRLF), follow-redirects |
| `nanoid` | high 1건 |
| `zod`, `@hookform/resolvers` | — |

| | 제거 전 | 제거 후 |
|---|---|---|
| high | 23 | 8 |
| moderate | 68 | 22 |
| low | 9 | 3 |

번들에는 tree-shaking 으로 들어가지 않아 **실제 도달 가능한 취약점은 사실상 없었지만**, 의존성 목록에 남아 있는 한 감사 결과가 계속 오염된다. 락파일은 순수 삭제만 반영했고 버전 상향은 없다.

남은 경고는 전부 간접 의존이다: `express`(→ path-to-regexp, qs, body-parser), `@prisma/dev`(→ hono, valibot), `@vercel/functions`·`jsdom`(→ ws), `ajv`(→ fast-uri).

### SEC-05 — 요청 ID 검증이 두 갈래로 갈림 (중, 수정 완료)

`lib/api-handler.js` 는 요청 ID 를 `/^[A-Za-z0-9_-]{1,64}$/` 로 검증했지만 `lib/request-errors.js` 는 길이 128 만 확인했다. 후자를 쓰는 경로(관리자 전체, `auth/me`, ai-models)에서는 사용자가 보낸 `X-Request-ID` 가 그대로 응답 JSON, 서버 로그, **`audit_events.requestId`(DB)** 에 기록됐다.

응답은 `application/json` + `nosniff` 라 XSS 는 성립하지 않는다. 문제는 감사 로그다. 감사 대상이 감사 기록의 내용을 정할 수 있으면 그 기록은 증적으로 쓸 수 없다.

**조치**: 검증을 `lib/request-id.js` 한 곳으로 모으고 두 진입점을 통일했다. 세 진입점 전부에 대해 동일한 거부/생성 동작을 검증하는 테스트를 추가했다.

### 미조치 항목

| ID | 내용 | 판단 |
|---|---|---|
| SEC-06 | `cron/purge-deleted-users` 의 거부 진단 로그가 `expectedAuthorizationHeaderLength` 를 남겨 `CRON_SECRET` 길이가 노출된다 | 낮음. 진단 목적이 명확하므로 담당자 판단 후 제거 권장 |
| SEC-07 | `api/analyze.js` 가 Gemini 키를 URL 쿼리(`?key=`)로 전달. 같은 함수가 `modelName` 을 `encodeURIComponent` 없이 URL 에 삽입 (`ai-models.js` 는 인코딩함) | 낮음. allowlist 로 현재는 안전. `x-goog-api-key` 헤더 전환 권장 |
| SEC-08 | `lib/admin-auth.js` 는 현재 브랜치 미사용 데드코드인데 `deletionRequestedAt` 을 검사하지 않는 구버전이다. `.worktrees/admin-*` 두 곳이 아직 이 모듈을 import 한다 | **머지 시 권한 검사 회귀 위험.** 해당 worktree 를 머지하기 전에 `lib/auth.js` 로 통일할 것 |
| SEC-09 | 미사용 스캐폴딩: `client/src/components/Map.tsx`(Google Maps, `VITE_FRONTEND_FORGE_API_KEY` 참조, 어디서도 import 안 됨), `ManusDialog.tsx`, `crop_glow.py`, `crop_more.py`, `test-api.js`, `scripts/manual/*` | 시크릿 없음. 공격 표면·혼동 축소 차원의 정리 |
| SEC-10 | `client/index.html` 이 `cdn.jsdelivr.net` CSS(Pretendard)를 SRI 없이 로드. CSP `style-src` 에 허용되어 있다 | 낮음. 폰트 self-host 또는 SRI 권장 |
| SEC-11 | GA4 가 실제로 동작하지 않는다. `index.html` 에 gtag 로더가 없어 `window.gtag` 가 정의되지 않는다. CSP 는 `googletagmanager` 를 열어둔 상태다 | 보안 이슈 아님. 기능 결함 |
| SEC-12 | vitest 실행 시 dotenv 가 로컬 실제 `.env` 를 주입한다. 현재 테스트는 모델 호출을 전부 모킹하지만, 실호출 테스트가 추가되면 실키가 쓰인다 | `.env.test` 분리 권장 |
| SEC-13 | `client/public/report-step-*.png.bak.png` 백업 이미지가 공개 자산으로 배포된다 | 정리 권장 |
| SEC-14 | `express` 는 배포되지 않는 `server/index.ts` 에서만 쓰이는데 프로덕션 의존성이다. 남은 audit 경고 3건의 출처 | `pnpm start` 자체 호스팅 시나리오를 유지할지 결정한 뒤 devDependencies 이동 검토 |

프로젝트가 prettier 로 포맷되어 있지 않아(`printWidth: 80` 설정과 실제 코드 스타일 불일치) 이번 수정에는 prettier 를 적용하지 않았다. 주변 코드 스타일에 맞춰 작성했다.

## 5. 검증 결과

| 항목 | 결과 |
|---|---|
| `vitest run` (수정 전) | 71 파일 / 299 테스트 통과 |
| `vitest run` (수정 후) | **73 파일 / 328 테스트 통과** |
| `tsc --noEmit` | 통과 (수정 전후 모두) |
| `vite build` | 성공. `index.html` 924B, JS 1,616KB (gzip 462KB), 대형 청크 경고만 존재 |
| 빌드 산출물 검사 | `manus-runtime` 0건, `data-loc` 속성 0건, `__manus__/` 디렉터리 없음 |
| `pnpm audit --prod` | high 23 → 8, moderate 68 → 22, low 9 → 3 |
| SEC-01 재현 스크립트 | 5개 경로 모두 401 로 종료 (수정 전 3개 무응답, 1개 미처리 예외) |
| SEC-02 회귀 테스트 | 새 마이그레이션 제거 시 실제로 실패하는 것을 확인 |

운영 환경·운영 DB·Supabase 원격 설정에는 접근하지 않았고, `prisma db push` / `migrate deploy` / `migrate reset` 은 실행하지 않았다.

## 6. 이전 감사(2026-07-26 NO-GO) 대비 변화

| 항목 | 현재 상태 |
|---|---|
| P1-01 분석 504 타임아웃 | **코드상 해소.** `waitUntil` 백그라운드 + 상태 폴링 + 100초/120초 예산으로 재설계됨. 실측 SLO 는 미확인 |
| P1-02 동시성·중복 키 | **코드상 방어 확인.** `FOR UPDATE` 로 사용자 단위 직렬화. 실서버 동시 10건·provider 429/500 실측은 여전히 미실행 |
| P1-03 실 purge·백업 정책 | 변화 없음 |
| P1-04 의존성 부채 | **SEC-04 로 대부분 해소.** 남은 8건은 간접 의존이며 SEC-14 참조 |
| P0-GATE-02 쓰기·삭제 A/B 매트릭스 | 코드와 회귀 테스트로는 커버. **라이브 증적은 여전히 없음** |
| P2-02 번들 크기 | **SEC-03 으로 일부 해소.** 여전히 500KB 경고 초과이므로 관리자 화면 lazy loading 은 남음 |

## 7. 출시까지 남은 일

이 감사는 코드·설정 레벨만 다뤘다. GO 판정에는 다음이 남아 있다.

1. `pnpm install` 로 의존성 제거를 로컬·CI 에 반영하고 `pnpm check` / `pnpm build` 재확인
2. 스테이징 Supabase 에 `20260826_secure_admin_credit_tables` 적용 후 두 테이블의 RLS·권한 상태를 원격에서 확인
3. **P0-GATE-02**: 프로젝트 DELETE, 분석 상세, 피드백 POST 에 대해 A 본인 2xx / B 의 A 대상 404 / 비로그인 401 을 Preview 에서 실제로 확인
4. **P1-01 실측**: 동일 입력군 10회 이상으로 성공률과 P95 지연 SLO 를 정하고, timeout·429·500 에서 예약과 이용권이 정확히 한 번만 처리되는지 확인
5. **P1-02**: 격리된 provider fixture 로 동시 10건·중복 멱등키·429/500 실행
6. **SEC-08**: `.worktrees/admin-*` 를 머지하기 전에 `lib/admin-auth.js` 제거
7. 개인정보 고지, 로그·백업 보관 정책, OAuth redirect allowlist 원격 값 확인

## 8. 이 감사에서 만든 커밋

| 커밋 | 내용 |
|---|---|
| `0b5855d` | `chore: drop unused production dependencies` (SEC-04) |
| `f5c2616` | `fix: close server boundary gaps found in the 2026-08-26 audit` (SEC-01, SEC-02, SEC-05) |
| `ddd9893` | `fix: keep browser authoring tools out of the production bundle` (SEC-03) |

세 커밋 모두 `codex/release-candidate` 에 있으며 push 하지 않았다.
