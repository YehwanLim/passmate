# 출시 게이트 체크리스트 · 인수인계 (2026-08-26 기준)

이 문서는 **다음 작업자가 여기부터 이어받는 지점**이다.

- 작업 브랜치: `codex/release-candidate` (push 안 됨)
- 기준 커밋: `5a3d524`
- 작업 규칙: `AGENTS.md`가 정본
- 프로젝트 맥락·함정: `CLAUDE.md`
- 이번 감사 결과와 근거: `docs/security/2026-08-26-system-security-audit.md`

위 세 문서와 겹치는 내용은 여기 옮겨 적지 않는다. 이 문서에는 **상태와 남은 일**만 둔다.

## 현재 상태

2026-08-26 감사에서 코드·설정 레벨 결함 5건을 찾아 모두 수정했다. 인증 우회와 IDOR은 발견되지 않았다.

| 커밋 | 내용 |
|---|---|
| `0b5855d` | 미사용 프로덕션 의존성 7개 제거 (SEC-04) |
| `f5c2616` | 관리자 라우터 프로토타입 조회, RLS 누락 테이블, 요청 ID 검증 (SEC-01/02/05) |
| `ddd9893` | 개발용 저작 도구를 프로덕션 번들에서 제외 (SEC-03) |
| `5a3d524` | 감사 보고서 |

검증 상태: `vitest` 73파일 328테스트 통과, `tsc --noEmit` 통과, `vite build` 성공.

**남은 일은 전부 실환경 검증이다.** 코드에서 확인할 수 있는 것은 이번에 다 봤고, 이제부터는 실제로 요청을 보내고 결과를 봐야 하는 항목만 남았다.

## 진행 순서

번호 순서대로 하는 것을 권한다. 특히 **3번을 4·5번보다 먼저** 해야 한다. 그 이유는 3번 항목에 적었다.

---

### 0. 의존성 제거를 로컬·CI에 반영

- [ ] `pnpm install` 실행 (`package.json`과 `pnpm-lock.yaml`은 이미 커밋되어 있고, `node_modules`만 오래된 상태다)
- [ ] `pnpm check` 통과
- [ ] `pnpm exec vitest run` 통과
- [ ] `pnpm build` 성공

**완료 조건**: 위 네 명령이 모두 통과하고, `pnpm audit --prod`의 high가 8건 이하.

**주의**: 감사 당시 락파일 갱신은 네트워크가 없는 환경에서 수행되어 **순수 삭제만** 반영했다. 버전 상향은 없다. `pnpm install` 후 락파일이 다시 바뀌면 그 diff를 확인하고 넘어갈 것.

---

### 1. SEC-08 — worktree의 구버전 권한 모듈 제거

`lib/admin-auth.js`는 현재 브랜치에서 **미사용 데드코드**인데, `deletionRequestedAt`을 검사하지 않는 구버전이다. 아래 두 worktree가 아직 이 모듈을 import한다.

- `.worktrees/admin-premium-sales-control/api/admin/credit-management.js`
- `.worktrees/admin-premium-sales-control/api/admin/entitlements.js`
- `.worktrees/admin-user-credit-management/` (동일한 두 파일)

- [ ] 두 worktree의 import를 `lib/auth.js`의 `requireAdministrator`로 교체
- [ ] `lib/admin-auth.js` 삭제
- [ ] 해당 worktree의 테스트가 mock하는 모듈 경로도 함께 수정 (`tests/api/admin/credit-coupons.test.js`, `user-credits.test.js`)

**완료 조건**: 저장소 전체에서 `admin-auth`를 grep했을 때 결과가 없다.

**왜 지금**: 이 상태로 worktree를 머지하면 삭제 예약된 계정이 관리자 API를 통과하는 권한 검사 회귀가 들어온다. **머지 전에 반드시 처리할 것.**

---

### 2. 스테이징 DB에 RLS 마이그레이션 적용

`prisma/migrations/20260826_secure_admin_credit_tables/`가 커밋되어 있으나 아직 어디에도 적용되지 않았다.

- [ ] **대상이 스테이징 Supabase 프로젝트인지 정확히 확인** (운영 DB 금지)
- [ ] 마이그레이션 적용 (`AGENTS.md`의 파괴적 명령 규칙을 따를 것 — 사용자 승인 필요)
- [ ] 원격에서 `credit_coupons`, `admin_credit_grants` 두 테이블의 상태 확인:
  - `pg_tables.rowsecurity = true`
  - `anon`, `authenticated` 역할의 SELECT/INSERT/UPDATE/DELETE 권한 0개

**완료 조건**: 위 두 테이블이 나머지 16개 애플리케이션 테이블과 동일한 기본 거부 상태다.

**주의**: `admin_credit_grants`는 지급 시점 이메일 스냅샷을 보관한다. 확인 과정의 쿼리 결과에 실제 이메일이 나오지 않도록 count와 권한 메타데이터만 조회할 것.

---

### 3. 격리된 provider fixture / 테스트 전용 러너 구축  ← **병목**

- [ ] 실제 AI 호출 없이 Gemini/OpenAI 응답을 대체하는 fixture 작성
- [ ] 성공, timeout(AbortError), 429, 500, 파싱 실패 시나리오를 각각 재현 가능하게
- [ ] 이용권·크레딧을 소모하지 않는 실행 경로 확보
- [ ] 동시 요청을 원하는 수만큼 발생시킬 수 있을 것

**완료 조건**: 한 번의 명령으로 위 시나리오를 반복 실행할 수 있고, 실행해도 실제 provider 비용과 사용자 이용권이 소모되지 않는다.

**왜 이걸 먼저 하는가**: 2026-07-26 감사와 그 이전 감사 모두 P1-02에서 *"비용·이용권을 쓰지 않는 전용 서버 테스트 러너가 없어서 미수행"* 이라는 같은 이유로 멈췄다. **두 번 연속 같은 벽에 막혔다는 것은, 이 러너가 없어서 검증이 계속 밀린다는 뜻이다.** 지금 구조에서는 검증 한 번에 실제 Gemini 호출과 이용권이 소모되므로 자꾸 미루게 된다. 이걸 만들면 4번과 5번이 반복 가능한 저비용 작업으로 바뀐다.

**참고**: 핸들러가 이미 의존성 주입 팩토리 패턴(`createAnalyzeHandler({ model, db, ... })`)이라 fixture를 끼워 넣기 좋은 구조다.

---

### 4. P1-02 — 동시성·중복 멱등키·provider 오류 (3번에 의존)

- [ ] 동시 10건 요청
- [ ] 같은 멱등키로 동시 요청
- [ ] provider 429 / 500 / timeout

각 시나리오에서 다음이 기대값과 일치하는지 확인한다.

- [ ] 외부 모델 호출 횟수
- [ ] `AnalysisRequest` 레코드 수와 최종 상태
- [ ] `AnalysisReservation`의 CONSUMED / CANCELLED 개수
- [ ] 사용자에게 차감된 크레딧

**완료 조건**: 모든 시나리오에서 크레딧이 **정확히 한 번만** 처리되고, 실패한 요청은 크레딧을 소모하지 않는다.

**참고**: 코드 레벨에서는 `lib/analysis-entitlements.js`의 `getLockedEntitlement`가 `SELECT ... FOR UPDATE`로 사용자 단위 직렬화를 보장하는 것을 확인했다. 이 항목은 그 보장이 실제로 성립하는지 확인하는 것이다.

---

### 5. P1-01 — 분석 신뢰성 SLO 실측 (3번에 의존)

- [ ] 동일 입력군으로 10회 이상 실행
- [ ] 성공률과 P95 지연 측정
- [ ] SLO 수치를 정하고 문서화

**완료 조건**: 성공률·P95 목표치가 정해졌고, timeout·429·500 상황에서 분석·예약·이용권이 정확히 한 번만 처리된다.

**참고**: 타임아웃 3형제는 한 세트다 — 모델 100s < TTL 125s, `maxDuration` 120s. 하나만 바꾸지 말 것.

---

### 6. P0-GATE-02 — 쓰기·삭제 A/B 권한 매트릭스 (Preview 실환경)

이전 감사에서 **읽기 경로만** 확인됐다. 쓰기와 삭제는 코드와 회귀 테스트로만 커버되어 있고 라이브 증적이 없다.

테스트 계정 A·B와 가짜 지원서만 사용한다. 각 셀을 실제 요청으로 확인한다.

| 엔드포인트 | A 본인 | B가 A 대상 | 비로그인 |
|---|---|---|---|
| `DELETE /api/projects/:projectId` | [ ] 204 | [ ] 404 | [ ] 401 |
| `GET /api/analysis/:id` | [ ] 200 | [ ] 404 | [ ] 401 |
| `POST /api/feedback` | [ ] 200 | [ ] 404 | [ ] 401 |
| `GET /api/projects/:projectId/analyses` | [ ] 200 | [ ] 404 | [ ] 401 |
| `POST /api/account/deletion` | [ ] 202 | — | [ ] 401 |

**완료 조건**: 모든 셀이 기대 상태 코드로 확인되고, 응답 본문에 타인의 데이터가 포함되지 않는다.

**주의**: 응답을 문서에 붙일 때 실제 사용자 ID, 이메일, 자소서 원문을 남기지 말 것.

---

### 7. 운영 설정과 고지 (사람이 확인할 항목)

저장소만으로는 검증할 수 없다.

- [ ] Supabase 대시보드의 OAuth redirect allowlist 실제 값
- [ ] Data API 비활성 상태 유지 확인
- [ ] 로그·백업 보관 기간 정책 문서화
- [ ] 개인정보 처리방침에 30일 유예 삭제와 보관 기간 반영
- [ ] Vercel 환경변수에 `CRON_SECRET` 설정 확인 (로컬 `.env`에는 없다)

---

## 선택 항목 (담당자 판단)

감사에서 발견했으나 위험도가 낮아 수정하지 않은 항목이다. 근거는 감사 보고서 4절에 있다.

- [ ] **SEC-06** cron 거부 진단 로그에서 `expectedAuthorizationHeaderLength` 제거 (`CRON_SECRET` 길이 노출)
- [ ] **SEC-07** Gemini 키를 URL 쿼리 대신 `x-goog-api-key` 헤더로 전달, `analyze.js`의 `modelName`도 `encodeURIComponent` 적용
- [ ] **SEC-09** 미사용 스캐폴딩 정리 — `client/src/components/Map.tsx`, `ManusDialog.tsx`, `crop_glow.py`, `crop_more.py`, `test-api.js`, `scripts/manual/*`
- [ ] **SEC-10** `cdn.jsdelivr.net` 폰트 CSS를 self-host 또는 SRI 적용
- [ ] **SEC-11** GA4 gtag 로더 누락 — 현재 이벤트가 전혀 전송되지 않는다
- [ ] **SEC-12** 테스트가 실제 `.env`를 주입한다. `.env.test` 분리
- [ ] **SEC-13** `client/public/report-step-*.png.bak.png` 백업 이미지가 공개 배포된다
- [ ] **SEC-14** `express`를 devDependencies로 이동 검토 (남은 audit 경고 3건의 출처, `pnpm start` 자체 호스팅 유지 여부에 달림)

## 알아둘 것

- **`CLAUDE.md`가 아직 git에 추적되지 않는다.** 프로젝트 맥락과 함정이 잘 정리되어 있으므로 커밋해서 공유하는 편이 낫다.
- **저장소는 Prettier로 포맷되어 있지 않다.** `.prettierrc`의 `printWidth: 80`과 실제 코드 스타일이 맞지 않는다. 2026-08-26 수정에도 Prettier를 적용하지 않고 주변 스타일에 맞췄다. 전역 `pnpm format`을 돌리면 전 파일이 재포맷되어 diff가 무의미해진다.
- **`dist/`는 2026-08-26에 새로 빌드된 상태다.** 이전에 남아 있던 `dist/public/__manus__/debug-collector.js`는 제거됐다.
- **출시 판정은 아직 GO가 아니다.** 이번 감사는 코드·설정 레벨만 다뤘고 Preview 실환경 검증을 하지 않았다. 위 6번까지 통과한 뒤에 판정을 갱신한다.
