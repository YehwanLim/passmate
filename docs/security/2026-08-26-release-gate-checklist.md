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

---

## 🔴 2026-08-27 추가 — 실DB 점검에서 나온 P0  *(당일 조치 완료)*

> **상태**: 발견 A·B·C 전부 해소됨. 조치 내역은 아래 "2-e. 실행 기록"에 있다.
> 이 절은 **무엇이 왜 문제였는지의 기록**으로 남긴다 — 같은 사각지대가 재발하지 않도록.

**위 "현재 상태"는 코드와 마이그레이션 *파일* 기준이다. 실제 DB는 그 상태가 아니었다.**

0·1번을 끝내고 2번에 착수하면서 대상 DB(`DIRECT_URL`이 가리키는 Supabase 프로젝트 `nygljwrlycnmnywwhpjg`, 도쿄)를 읽기 전용으로 점검한 결과:

### 발견 A — 마이그레이션 9건이 미적용이고, 테이블 4개가 실재하지 않는다

`prisma migrate status` 기준 13건 중 **9건 미적용**. `_prisma_migrations` 기록은 4건뿐이다.
그 결과 `schema.prisma`의 18개 모델 중 4개의 테이블이 DB에 없다. **넷 다 현재 코드가 실제로 쓴다.**

| 없는 테이블 | 만드는 마이그레이션 | 쓰는 곳 |
|---|---|---|
| `analysis_requests` | `20260723_add_security_primitives` | `api/analyze.js`, `api/analysis-requests/[id].js`, `lib/analysis-request-lifecycle.js` |
| `api_rate_limit_buckets` | 〃 | `lib/rate-limit.js` |
| `audit_events` | `20260723_add_audit_events` | `lib/audit-log.js` |
| `ai_model_settings` | `20260723_add_ai_model_settings` | `lib/ai-model-settings.js` |

`analysis_requests`가 없다는 것은 **CLAUDE.md에 적힌 핵심 분석 흐름(202 접수증 → 폴링)이 이 DB에서는 동작하지 않는다**는 뜻이다. 같은 마이그레이션에 있는 가입 트리거(`handle_auth_user_created`)도 미적용이라, 신규 가입자는 `public.users` 행이 생기지 않아 403으로 막힌다.

### 발견 B — 기본 거부 베이스라인이 적용된 적이 없다

2번 항목의 완료 조건은 *"나머지 16개 애플리케이션 테이블과 동일한 기본 거부 상태"*였다. **그 전제가 사실이 아니다.**

- 앱 테이블 14개 중 **RLS가 켜진 것은 `users` 하나뿐**. 나머지 13개는 RLS OFF.
- `anon`·`authenticated`가 **전 테이블에 7개 권한(SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER)을 보유**. 총 210개.

원인은 이 베이스라인을 담당하는 `20260723_add_security_primitives`가 미적용이기 때문이다(발견 A와 같은 뿌리).

2026-08-26 감사가 "인증 우회와 IDOR은 발견되지 않았다"고 판정한 것은 **코드와 마이그레이션 파일만 봤기 때문**이다. `tests/security/database-default-deny.test.js`가 통과한 것도 같은 이유로, 파일을 검증한 것이지 라이브 DB를 검증한 것이 아니다. **이 격차가 이번 감사의 가장 큰 사각지대였다.**

### 발견 C — 실제 노출이 발생하고 있었다 (조치 완료)

Data API(PostgREST)가 **켜져 있었다**. 공개 anon 키(설계상 클라이언트 번들에 배포되는 값)로 인증 없이 실데이터가 읽혔다. `HEAD` + 카운트 헤더로만 확인했고 본문은 수신하지 않았다.

| 테이블 | 조치 전 | 조치 후 |
|---|---|---|
| `analyses` (자소서 본문) | 🔴 200, **7건 열람 가능** | 503 차단 |
| `projects` | 🔴 200, **7건 열람 가능** | 503 차단 |
| `users` | 200 / 0건 (RLS ON이라 차단) | 503 차단 |
| `feedbacks`, `user_api_keys`, `credit_coupons`, `admin_credit_grants` | 200 / 0건 — **보호돼서가 아니라 비어 있어서** | 503 차단 |

`anon`에 `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` 권한도 있고 RLS가 꺼져 있으므로 **쓰기·삭제도 가능했을 것으로 보인다.** 파괴적이라 테스트하지 않았다 — 권한 테이블과 읽기 실증으로부터의 추론이다.

**조치**: 2026-08-27, Supabase 대시보드에서 Data API 비활성화. 4회 반복 프로브로 503 안정 확인. 서버 직접 DB 접속은 정상(Prisma는 Postgres에 직접 붙으므로 무관).

**단, 이것은 지혈이다.** DB 내부의 권한 210개와 RLS OFF 14개는 그대로다. **누가 Data API를 다시 켜면 즉시 재노출된다.** 발견 A·B를 해소하기 전까지 이 설정을 건드리면 안 된다.

### 이 발견이 바꾸는 것

- **2번은 "마이그레이션 1건 적용"이 아니라 "9건 적용 + 스키마 정합성 복구"였다.** 아래 2번 항목을 그에 맞게 다시 쓰고 그대로 수행했다.
- **앞으로의 감사는 파일이 아니라 라이브 DB를 근거로 해야 한다.** 이번 건은 "마이그레이션 파일이 존재한다"와 "DB에 적용돼 있다"를 동일시해서 생긴 문제다. **이것이 이번 사건의 핵심 교훈이다.**
- **노출의 실제 피해는 없었다.** 노출된 `analyses` 7건·`projects` 7건은 전부 개발자 본인의 테스트 계정 데이터임을 확인했다(외부 사용자 자소서 없음). 따라서 통지 의무 대상이 아니며, "출시 전에 발견해 조치한 취약점"으로 정리한다.

**환경 확정 (2026-08-27)**: 활성 Supabase 프로젝트는 `nygljwrlycnmnywwhpjg` 하나뿐이며 **이것이 운영이다.** 나머지는 paused 상태였다.
즉 원래 2번 항목의 "스테이징에 적용, 운영 금지"는 **수행 불가능한 지시**였다. 리허설에는 paused 상태였던 `passmate-staging`을 복구해 사용했다.

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

- [x] 두 worktree의 import를 `lib/auth.js`의 `requireAdministrator`로 교체
- [x] `lib/admin-auth.js` 삭제
- [x] 해당 worktree의 테스트가 mock하는 모듈 경로도 함께 수정 (`tests/api/admin/credit-coupons.test.js`, `user-credits.test.js`)

**완료 조건**: 저장소 전체에서 `admin-auth`를 grep했을 때 결과가 없다.

**완료 (2026-08-27)**: 코드 레벨(`*.js/*.ts/*.tsx`) grep 결과 없음 — 남은 3건은 문서뿐이다 (이 체크리스트, 감사 보고서, `docs/superpowers/plans/2026-07-26-admin-user-credit-management.md`의 과거 설계 기록. 감사 보고서와 설계 문서는 과거 시점 기록이라 수정하지 않았다).

**추가로 필요했던 작업**: 두 worktree(`codex/admin-premium-sales-control`, `codex/admin-user-credit-management`)는 `codex/release-candidate` 대비 각각 51·65커밋 뒤처져 있어, 각 worktree의 `lib/auth.js`에는 애초에 `requireAdministrator`/`requireActiveApplicationUser`/`AuthorizationError`가 없었다(그 worktree만의 구버전 `lib/auth.js`). 단순 import 교체만으로는 해결되지 않아, release-candidate의 `lib/auth.js` 구현(`deletionRequestedAt` 검사 포함)을 각 worktree의 `lib/auth.js`에 이식했다 — 전체 rebase는 하지 않았다(범위 밖의 큰 diff를 피하기 위함). 두 API 파일의 에러 처리도 `requireAdministrator`가 이제 (res에 직접 쓰는 대신) `statusCode`를 가진 에러를 throw하는 계약에 맞춰 조정했다. `tests/api/entitlements.test.js`도 함께 손봐야 했다 — 체크리스트에는 없었지만, 그 파일이 `lib/auth.js`를 통째로 mock하고 있어 `requireAdministrator`가 없으면 admin entitlements 테스트 2건이 깨졌다.

각 worktree에서 대상 테스트(`entitlements`, `credit-coupons`, `user-credits`) 28개 전부 통과, 전체 스위트는 사전부터 있던 무관한 실패 7건(해당 worktree에 `.env`가 없어 `VITE_SUPABASE_URL` 미설정으로 발생, `admin-auth`와 무관)을 빼면 모두 통과. 세 위치(main repo, 두 worktree) 모두 아직 커밋 전 상태다.

**왜 지금**: 이 상태로 worktree를 머지하면 삭제 예약된 계정이 관리자 API를 통과하는 권한 검사 회귀가 들어온다. **머지 전에 반드시 처리할 것.**

---

### 2. DB 스키마·보안 베이스라인 복구  ← **P0 / 출시 차단**

> **2026-08-27 개정.** 원래 이 항목은 `20260826_secure_admin_credit_tables` 1건 적용이었다.
> 실DB 점검 결과 미적용 마이그레이션이 9건이고 코드가 요구하는 테이블 4개가 없어, 범위를 다시 잡았다.
> 근거는 위 "🔴 2026-08-27 추가" 절에 있다.

#### 2-a. 대상 환경 확정 (선행 조건)

- [x] 로컬 `.env`의 `DIRECT_URL` 대상 확인 → Supabase `nygljwrlycnmnywwhpjg` (도쿄)
- [x] `dist` 번들의 `VITE_SUPABASE_URL` 대조 → 동일 프로젝트
- [ ] **Vercel Production 환경변수의 `DATABASE_URL`/`DIRECT_URL`/`VITE_SUPABASE_URL` 확인** — ref가 같은지 다른지
- [ ] 운영이 별도 프로젝트라면, **그 프로젝트에도 아래 점검을 처음부터 반복**

이게 끝나기 전에는 어떤 마이그레이션도 적용하지 않는다.

#### 2-b. 즉시 조치 (완료)

- [x] Data API 비활성화 — 진행 중이던 실데이터 노출 차단 (발견 C)
- [x] 차단 실증 (4회 반복 프로브, 503 안정)
- [ ] **2-c가 끝날 때까지 Data API를 다시 켜지 않는다** ← 켜는 순간 재노출

#### 2-c. 근본 수정 — 미적용 마이그레이션 9건

적용 순서와 각각의 성격을 먼저 파악할 것. **DDL만 있는 것과 데이터를 건드리는 것이 섞여 있다.**

| 마이그레이션 | 성격 |
|---|---|
| `20260723_add_ai_model_settings` | 테이블 생성 + seed INSERT |
| `20260723_add_analysis_request_processing_states` | (DDL 없음 — 내용 확인 필요) |
| `20260723_add_audit_events` | 테이블 생성 |
| `20260723_add_security_primitives` | **핵심** — `analysis_requests`·`api_rate_limit_buckets` 생성, RLS 활성화, 권한 회수, 가입 트리거 |
| `20260723_backfill_auth_users` | **데이터 백필** (`INSERT INTO public.users`) |
| `20260723_claim_account_purges` | 컬럼 추가 |
| `20260723_expire_stale_analysis_requests` | 컬럼 추가 |
| `20260723_stage_provider_results` | **데이터 UPDATE** 3건 + audit INSERT |
| `20260826_secure_admin_credit_tables` | 원래 이 항목의 대상 (RLS + 권한 회수) |

- [x] 각 마이그레이션 SQL을 **적용 전에 개별로 읽고** 파괴적 구문 유무 확인 (특히 백필·UPDATE 2건)
- [x] 사전점검으로 충돌 가능성 실측
- [x] `passmate-staging`에서 리허설
- [x] `AGENTS.md`의 파괴적 명령 규칙에 따라 **사용자 승인 후** 운영 적용
- [x] 적용 후 `prisma migrate status`가 "up to date"

##### SQL 검토 결과 (2026-08-27) — 9건 전부 멱등, 순서 정상

| 마이그레이션 | 성격 | 판정 |
|---|---|---|
| `add_ai_model_settings` | `CREATE TABLE IF NOT EXISTS` + `INSERT ... ON CONFLICT DO NOTHING` + RLS/REVOKE | 멱등 |
| `add_analysis_request_processing_states` | 타입이 있을 때만 `ALTER TYPE ... ADD VALUE IF NOT EXISTS` | **운영에선 no-op** (타입 없음) |
| `add_audit_events` | `CREATE TABLE IF NOT EXISTS` + RLS/REVOKE | 멱등 |
| `add_security_primitives` | 핵심. 전 구문이 `IF NOT EXISTS`/`OR REPLACE`/`DROP IF EXISTS` | 멱등 |
| `backfill_auth_users` | `INSERT ... ON CONFLICT (id) DO NOTHING` | 멱등, **실측 0건 추가** |
| `claim_account_purges` | `ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` | 멱등 |
| `expire_stale_analysis_requests` | `ALTER COLUMN ... SET DEFAULT` (테이블 가드 없음) | 순서상 안전 — 선행 마이그레이션이 테이블을 만든다 |
| `stage_provider_results` | `ADD COLUMN IF NOT EXISTS` + 빈 테이블 UPDATE | **no-op** (대상 테이블이 갓 생성돼 비어 있음) |
| `secure_admin_credit_tables` | RLS/REVOKE | 멱등 |

적용 순서는 디렉터리명 사전순이고, 의존 관계와 일치한다 (`add_security_primitives`가 `analysis_requests`를 만든 뒤 `expire_*`·`stage_*`가 그것을 변경).
`add_analysis_request_processing_states`의 주석이 이 사전순 의존을 명시적으로 다루고 있다.

##### 사전점검 실측 (2026-08-27, 읽기 전용)

| 확인 항목 | 결과 |
|---|---|
| 생성 예정 테이블 4개 | **전부 없음** → 충돌 없음, 깔끔하게 생성됨 |
| 추가 예정 컬럼 4개 | **전부 없음** → 충돌 없음 |
| `analysis_request_status` 타입 | **없음** → 2번 마이그레이션 no-op 확정 |
| `auth.users`(email 있음) vs `public.users` | 2건 vs 3건, **백필로 생길 행 0건** → 403으로 잠긴 계정 없음 |
| 접속 롤 | `postgres` (superuser 아님, `public.users` 소유자) → DDL 가능 |

앞서 우려했던 "`_prisma_migrations` 순서 뒤바뀜으로 인한 충돌"은 **실측 결과 해당 없음**이다.
`20260726_*`이 만든 것(`credit_coupons`, `admin_credit_grants`)과 `20260723_*`이 만들 것은 서로 겹치지 않는다.

##### 의도된 부작용 1건 — `users`의 RLS 정책 3개가 삭제된다

`add_security_primitives`는 대상 테이블의 기존 정책을 전부 `DROP` 한 뒤 RLS를 켜고 권한을 회수한다.
이는 "서버 Prisma만이 신뢰 경계"라는 설계 의도이며(해당 파일 상단 주석), Data API가 꺼져 있어 기능 영향은 없다.
만약 되돌려야 할 경우를 대비해 **삭제 전 정의를 확보해 두었다**:

```sql
-- 복원용. 정상 경로에서는 사용하지 않는다.
CREATE POLICY "Users can insert own data" ON public.users FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can read own data"   ON public.users FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE TO public USING ((auth.uid() = id));
```

##### 잔여 위험 1건 — `auth.users` 트리거 생성

`add_security_primitives`는 `auth.users`에 `on_auth_user_created` 트리거를 건다.
`auth.users`의 소유자는 `supabase_auth_admin`이고 우리 접속 롤은 `postgres`(superuser 아님)라, TRIGGER 권한이 있어야 성공한다.
Supabase의 표준 패턴이라 대개 통과하지만 **이번 작업에서 유일하게 실패 가능성이 있는 지점**이다.
스테이징 리허설의 핵심 목적이 바로 이것을 확인하는 데 있다.

이 트리거가 없으면 신규 가입자에게 `public.users` 행이 생기지 않아 403으로 막힌다.
(지금은 잠긴 계정이 0건이지만, 그건 현재 가입자가 전부 기존 계정이기 때문이지 트리거가 있어서가 아니다.)

#### 2-d. 완료 조건 (라이브 DB 기준, 파일 기준 아님)

- [x] `schema.prisma`의 18개 모델에 대응하는 테이블이 **전부 실재**
- [x] 앱 테이블 전체가 `pg_class.relrowsecurity = true`
- [x] `information_schema.role_table_grants`에서 `anon`·`authenticated` 권한 **0개**
- [ ] Data API를 다시 켜도 위 프로브가 전부 차단되는 것을 실증 — **선택**. 이제 DB 자체가 막으므로 안전하게 확인 가능하나, Data API를 계속 끈 채로 두는 편이 심층 방어상 낫다 (앱은 Prisma 직결이라 Data API가 필요 없다)
- [x] Prisma 런타임 경로 스모크 (모델 10종 조회 + seed 확인)
- [ ] 핵심 흐름 E2E 스모크: 분석 접수(202) → 폴링 → 완료 — **RC 배포 후에 가능**

#### 2-e. 실행 기록 (2026-08-27)

`passmate-staging`(`egybddvcifhkxcgwavbd`, 싱가포르)이 리허설 환경으로 쓰였다.
점검해 보니 스테이징은 운영과 **상호보완적으로** 어긋나 있었다 — 스테이징엔 `20260723_*` 8건이 이미 적용돼 있고 `20260726_*` 2건이 없었다.
덕분에 **가장 큰 미지수였던 `auth.users` 트리거가 같은 플랫폼·같은 롤에서 이미 성공한 상태**라는 증거를 얻었고, 운영 적용 전에 위험이 사실상 해소됐다.

| 단계 | 대상 | 결과 |
|---|---|---|
| 리허설 | 스테이징 | `20260726_*` 2건 + `20260826` 적용 성공 |
| 본 적용 | **운영** | **9건 전부 적용 성공, 오류 없음** |
| 추가 하드닝 | 스테이징 → 운영 | `20260827_secure_prisma_migrations_table` 적용 성공 |

적용 전후 운영 DB 상태:

| 항목 | 적용 전 | 적용 후 |
|---|---|---|
| 마이그레이션 기록 | 4 / 13 | **14 / 14 (up to date)** |
| 없던 테이블 4개 | 없음 | 생성, 조회 정상 |
| RLS 꺼진 테이블 | 14개 | **0개** |
| `anon`·`authenticated` 권한 | **210개** | **0개** |
| 가입 트리거 | 없음 | **있음** |
| `users` / `analyses` / `projects` | 3 / 7 / 7 | **3 / 7 / 7 (무손실)** |

검증 방법: 앱이 실제로 쓰는 경로(`lib/prisma.js` + `DATABASE_URL`)로 모델 10종을 조회해 전부 통과,
`ai_model_settings` seed 행(`gemini` / `gemini-2.5-flash-lite`) 확인, 스테이징과 최종 상태 대조 일치.
**RLS를 켜도 Prisma는 막히지 않는다** — 테이블 소유자가 `postgres`이고 `FORCE ROW LEVEL SECURITY`를 쓰지 않기 때문이며, 이는 `add_security_primitives` 상단 주석이 의도적으로 설명하는 설계다.

추가 하드닝을 한 이유: 나머지를 전부 기본 거부로 맞춘 뒤에도 `_prisma_migrations`만 RLS가 꺼진 채 권한 14개가 남았다.
기록 내용은 민감하지 않지만 Data API가 켜지면 anon이 이 표를 **쓸 수** 있어 이후 배포 판정이 망가진다.
임시 SQL 대신 정식 마이그레이션으로 만들어 두 DB에 모두 적용했다.

**주의**: `admin_credit_grants`는 지급 시점 이메일 스냅샷을 보관한다. 확인 과정의 쿼리 결과에 실제 이메일이 나오지 않도록 count와 권한 메타데이터만 조회할 것. (2026-08-27 점검도 이 규칙을 지켰다.)

**점검 도구**: 이번에 쓴 임시 스크립트 2개가 프로젝트 루트에 있다 — `tmp-inspect-db.mjs`(읽기 전용 DB 상태), `tmp-probe-dataapi.sh`(Data API 노출 프로브). 재검증에 재사용하고, 2번이 끝나면 삭제할 것. 커밋하지 않았다.

---

### 3. 격리된 provider fixture / 테스트 전용 러너 구축  ← **병목**

- [x] 실제 AI 호출 없이 Gemini/OpenAI 응답을 대체하는 fixture 작성
- [x] 성공, timeout(AbortError), 429, 500, 파싱 실패 시나리오를 각각 재현 가능하게
- [x] 이용권·크레딧을 소모하지 않는 실행 경로 확보
- [x] 동시 요청을 원하는 수만큼 발생시킬 수 있을 것

**완료 조건**: 한 번의 명령으로 위 시나리오를 반복 실행할 수 있고, 실행해도 실제 provider 비용과 사용자 이용권이 소모되지 않는다.

**완료 (2026-08-27)** — `pnpm test:integration`, 28개 테스트 약 10초.

설계는 `docs/superpowers/specs/2026-08-27-provider-fixture-test-runner-design.md`,
구현 계획은 `docs/superpowers/plans/2026-08-27-provider-fixture-test-runner.md` 에 있다.

| 구성 | 위치 |
|---|---|
| 테스트 DB 하네스 (로컬 강제) | `tests/integration/harness/test-database.js` |
| provider fixture (네트워크 가로채기) | `tests/integration/harness/provider-fixture.js` |
| 시드 (사용자·크레딧·모델설정) | `tests/integration/harness/seed.js` |
| 가짜 API 키 가드 | `tests/integration/harness/setup.js` |
| provider 시나리오 5종 | `tests/integration/analyze-provider-scenarios.test.js` |
| 동시성·멱등키 | `tests/integration/analyze-concurrency.test.js` |

**전제**: 로컬 PostgreSQL 이 떠 있어야 한다 — `brew services start postgresql@17`.
테스트 DB(`passmate_test`)는 하네스가 알아서 만들고 각 테스트 전에 비운다.

**제품 코드는 0줄 바뀌지 않았다.** `createAnalyzeHandler` 의 기존 주입 지점만 사용했다.
기본 스위트(`pnpm exec vitest run`)도 73파일 328테스트 그대로다.

**구현 중 배운 것 (다음 사람이 같은 데서 막히지 않도록)**

- **`migrate deploy` 가 아니라 `db push` 를 쓴다.** 마이그레이션 이력은 이미 존재하는 기본
  스키마를 전제한다 — 가장 오래된 마이그레이션이 `prompt_templates` 를 *변경*하는데 그것을
  *만드는* 마이그레이션은 없다. 빈 DB 에는 `db push` 하나로 충분하다.
- **핸들러는 배경 작업을 await 하지 않는다** (Vercel `waitUntil` 방식). 테스트가 결과를
  관찰하려면 `enqueueBackgroundWork` 로 넘어온 약속을 붙잡아 두었다가 기다려야 한다.
- **멱등키는 16자 이상**이어야 한다(`/^[A-Za-z0-9_-]{16,128}$/`). 짧으면 예약에 도달하기 전에
  400 으로 거부되어, 마치 락이 동작한 것처럼 보이는 착시가 생긴다.
- **폴백 모델을 심지 않으면 재시도가 일어나지 않는다.** `ai_model_settings` 행이 없으면
  기본값의 폴백이 `null` 이라 모델 후보가 하나뿐이다.
- Prisma 는 연결 문자열에 사용자명이 없으면 P1010 으로 거부한다 (`pg` 와 달리 OS 사용자를
  채우지 않는다).

**왜 이걸 먼저 하는가**: 2026-07-26 감사와 그 이전 감사 모두 P1-02에서 *"비용·이용권을 쓰지 않는 전용 서버 테스트 러너가 없어서 미수행"* 이라는 같은 이유로 멈췄다. **두 번 연속 같은 벽에 막혔다는 것은, 이 러너가 없어서 검증이 계속 밀린다는 뜻이다.** 지금 구조에서는 검증 한 번에 실제 Gemini 호출과 이용권이 소모되므로 자꾸 미루게 된다. 이걸 만들면 4번과 5번이 반복 가능한 저비용 작업으로 바뀐다.

**참고**: 핸들러가 이미 의존성 주입 팩토리 패턴(`createAnalyzeHandler({ model, db, ... })`)이라 fixture를 끼워 넣기 좋은 구조다.

---

### 4. P1-02 — 동시성·중복 멱등키·provider 오류 (3번에 의존)

- [x] 동시 10건 요청
- [x] 같은 멱등키로 동시 요청
- [x] provider 429 / 500 / timeout

각 시나리오에서 다음이 기대값과 일치하는지 확인한다.

- [x] 외부 모델 호출 횟수
- [x] `AnalysisRequest` 레코드 수와 최종 상태
- [x] `AnalysisReservation`의 CONSUMED / CANCELLED 개수
- [x] 사용자에게 차감된 크레딧

**완료 조건**: 모든 시나리오에서 크레딧이 **정확히 한 번만** 처리되고, 실패한 요청은 크레딧을 소모하지 않는다.

**참고**: 코드 레벨에서는 `lib/analysis-entitlements.js`의 `getLockedEntitlement`가 `SELECT ... FOR UPDATE`로 사용자 단위 직렬화를 보장하는 것을 확인했다. 이 항목은 그 보장이 실제로 성립하는지 확인하는 것이다.

**완료 (2026-08-27)** — 3번의 러너로 진짜 Postgres 에서 실측했다. `pnpm test:integration`.

| 시나리오 | 결과 |
|---|---|
| 무료 1건 사용자에게 **동시 10건** | 202 는 **1건만**, CONSUMED 1, PENDING 0, 모델 호출 **1회** |
| **같은 멱등키로 동시 5건** | `AnalysisRequest` **1개**, 모델 호출 **1회**, CONSUMED 1 |
| 크레딧 4개 사용자에게 동시 10건 | 202 **4건**, CONSUMED 4, PENDING 0, 모델 호출 **4회** |
| 동시 4건 전부 provider 500 | CONSUMED **0**, CANCELLED **4**, PENDING 0 |
| timeout / 429 / 500 / 파싱 실패 (단건) | 각각 CANCELLED, `AnalysisRequest` 는 FAILED, 무료 크레딧 회복 |
| 429 → 폴백 재시도 성공 | gemini 429 → openai 성공, CONSUMED **1** (중복 과금 없음) |

**`getLockedEntitlement` 의 `SELECT ... FOR UPDATE` 직렬화가 실제로 성립하는 것을 확인했다.**
동시 10건이 크레딧 1개를 두고 경쟁했을 때 정확히 하나만 통과했고, 어떤 시나리오에서도
`PENDING` 으로 남는 예약이 없었다.

**주의 — 이 실측의 한계**: 락 직렬화를 관찰하려고 레이트리밋과 동시성 제한을 무제한 정책으로
주입했다(그러지 않으면 무료 15분 3회 제한이 먼저 걸려 락에 도달하지 못한다).
따라서 **처리량 제한 자체(무료 동시 1건·15분 3회 / 프리미엄 동시 2건·15분 10회)는 아직
실측하지 않았다.** 그것은 별도 시나리오로 남아 있다.

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
- [x] ~~Data API 비활성 상태 유지 확인~~ → **켜져 있었고 실제 노출이 있었다.** 2026-08-27 비활성화함. 발견 C 참조. 2-c 완료 전까지 다시 켜지 말 것
- [ ] 로그·백업 보관 기간 정책 문서화
- [ ] 개인정보 처리방침에 30일 유예 삭제와 보관 기간 반영
- [ ] Vercel 환경변수에 `CRON_SECRET` 설정 확인 (로컬 `.env`에는 없다 — 0번에서 `pnpm build`가 이 변수 누락으로 실패하는 것을 확인했다. 로컬은 그대로 두고 Vercel 쪽만 확인하면 된다)

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
- **출시 판정: 아직 GO 아님 (2026-08-27 갱신).** 당일 오전 한때 NO-GO였던 사유(코드가 요구하는 테이블 4개 부재, 기본 거부 미적용, 실데이터 노출)는 **전부 해소됐다.** 다만 3~7번이 남아 있어 GO는 아니다. **차단 사유는 사라졌고, 이제 남은 것은 검증이다.**
- **파일이 아니라 라이브 DB를 근거로 볼 것.** 2026-08-26 감사가 P0를 놓친 이유는 "마이그레이션 파일이 존재한다"를 "DB에 적용돼 있다"로 간주했기 때문이다. `tests/security/database-default-deny.test.js`도 파일을 검증할 뿐 라이브 DB를 보지 않는다. 이 테스트의 통과를 DB가 안전하다는 근거로 쓰지 말 것.
