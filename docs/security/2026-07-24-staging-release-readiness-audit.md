# PassMate 스테이징 출시 준비·보안감사 보고서

- 작성일: 2026-07-24 (KST)
- 감사 대상 코드: `codex/security-remediation` / `84031eb`
- 대상 범위: Vercel Preview 또는 명시적으로 확인된 스테이징, Supabase 스테이징 프로젝트, 테스트 전용 A/B/관리자 계정
- 현재 판정: **NO-GO — 스테이징 접근·DB 기준선이 확인될 때까지 배포 및 동적 검증을 진행하지 않는다.**

## 경영 요약

코드 수준의 P0 보안 조치(인증·소유권, 관리자 경계, 분석 비용 제어, RLS 기본 거부, 개인정보 삭제, 결제 베타 비활성화)는 구현되어 정적·회귀 검증을 통과했다. 그러나 감사용 스테이징 URL·Vercel 프로젝트 연결·Supabase 권한·격리 테스트 계정이 제공되지 않아 실제 API/RLS/CORS/헤더/AI 동적 검증은 수행하지 않았다.

또한 현 migration 집합은 빈 데이터베이스를 생성하는 baseline이 아니다. 첫 migration부터 기존 `prompt_templates`, `users`, `analyses` 등의 존재를 전제하며, `prisma/migrations/add_user_role.sql`은 Prisma migration으로 실행되지 않는다. 스테이징 DB의 기존 스키마와 `_prisma_migrations` 상태가 확인되기 전에는 `prisma migrate deploy`를 실행하면 안 된다.

## 검증 증적

2026-07-24에 테스트용 더미 환경변수만 사용하여 다음을 실행했다. 실사용자 데이터·토큰·AI 제공자 호출은 사용하지 않았다.

| 항목 | 결과 | 근거 |
|---|---|---|
| 회귀·보안 테스트 | 통과 | Vitest 50 파일, 203 테스트 |
| 타입 검사 | 통과 | `npm run check` |
| 프로덕션 빌드 | 통과 | `npm run build` |
| Prisma schema 검증 | 통과 | `pnpm exec prisma validate` |
| 배포 헤더·함수 수 정적 점검 | 통과 | `tests/security/deployment-security.test.js`, `scripts/vercel-function-limit.test.js` |
| 스테이징 API·RLS·OAuth·CORS 라이브 테스트 | 미수행 | 대상 URL·프로젝트·테스트 계정 미확정 |
| AI 동시성·비용·timeout 라이브 테스트 | 미수행 | 샌드박스/비용 승인 미제공 |
| Groble 웹훅 라이브 테스트 | 범위 제외 | 베타에서 결제·웹훅 엔드포인트를 배포하지 않음 |

## 보안 통제 구현 상태

| 영역 | 코드 상태 | 라이브 재검증 |
|---|---|---|
| 로그인·세션·소유권 | 구현 및 단위 테스트 완료 | A/B/비로그인 API 매트릭스 필요 |
| 관리자 API | 서버 전용 guard·403/401 회귀 테스트 완료 | 일반/관리자 토큰으로 확인 필요 |
| IDOR/BOLA | `token.sub` 기반 접근·타인 404 계약 구현 | 프로젝트·분석·피드백 CRUD 확인 필요 |
| 분석 비용·중복 호출 | 로그인, rate limit, reservation, 멱등성·복구 구현 | 동시 10건·429/timeout·kill switch 필요 |
| 불확실 AI 호출 | 자동 환불·재호출 금지, 관리자 조정 경로 구현 | 제공자 로그 기반 운영 절차 확인 필요 |
| Supabase RLS | migration의 기본 거부·브라우저 직접 접근 제거 | anon/A/B/admin SQL 권한 매트릭스 필요 |
| 삭제·감사 로그 | 30일 유예 삭제, 90일 식별자 전용 감사 로그 구현 | Cron·취소·purge 실제 실행 확인 필요 |
| 헤더·CORS·XSS | Vercel 보안 헤더·입력 검증·정적 테스트 완료 | 배포 URL에서 OPTIONS/응답 헤더·저장형 XSS 필요 |

## 출시 차단 항목

### P0-1 — 스테이징 대상 및 권한 미확정

확정된 스테이징 base URL, Vercel 프로젝트 연결 또는 조회 권한, Supabase 스테이징 프로젝트 접근 경로가 없다. 과거 문서의 URL은 현재 스테이징이라는 근거가 없으므로 호출하지 않았다.

**해제 조건:** 대상 URL과 프로젝트가 테스트 전용 스테이징임을 확인하고, Preview/staging 배포 조회 권한을 제공한다.

### P0-2 — Prisma migration baseline·역할 DDL 확인 필요

빈 DB에서 순서대로 적용할 baseline migration이 없고, `add_user_role.sql`은 Prisma가 자동 실행하지 않는다. 따라서 `users.role`과 기존 테이블·enum·migration 이력이 보장되지 않는다.

**해제 조건:**

1. 스테이징에서 `_prisma_migrations`와 필수 테이블/컬럼(`users.role` 포함)을 읽기 전용으로 확인한다.
2. 기존 호환 DB면 `prisma migrate status` 후 `prisma migrate deploy`를 단발성 migration runner에서 실행한다.
3. 빈 DB면 baseline migration 또는 검증된 schema bootstrap 절차를 먼저 별도 승인·검토한다.

### P0-3 — 필수 배포 환경변수·테스트 신원 부재

보안 브랜치에는 실제 `.env`가 없고, 로컬 기존 설정에는 서버용 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`이 확인되지 않았다. 또한 A/B/관리자 테스트 계정과 AI·웹훅 샌드박스가 없다.

**해제 조건:** Vercel Preview/staging 환경에 아래 이름의 값을 설정하고, 실제 값은 채팅에 공유하지 않는다.

`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

분석 실행 검증에는 선택적으로 `GEMINI_API_KEY` 또는 `OPENAI_API_KEY`와 최대 10회 테스트 예산도 필요하다.

## 승인 후 안전한 실행 순서

1. 보안 브랜치의 Preview 배포 대상과 스테이징 DB를 지정한다. main 병합이나 운영 배포는 하지 않는다.
2. DB가 기존 호환 상태인지 읽기 전용 확인 후 migration 상태를 점검한다.
3. `DIRECT_URL`을 사용하는 단발성 runner에서 migration을 적용하고 상태를 다시 확인한다.
4. A/B/관리자/비로그인 계정과 가짜 자소서만으로 API·RLS·삭제 매트릭스를 실행한다.
5. 분석은 사용자당 3회/15분, 전체 최대 10회·동시 10건 이내로 timeout·429·중복 키·kill switch를 검증한다.
6. 배포 URL에서 CSP/HSTS/CORS/OPTIONS, OAuth redirect allowlist, 브라우저 저장소, 저장형 XSS를 검증한다.
7. 증적에서 토큰·이메일·자소서 원문·결제 원문을 제거하고 본 보고서를 GO/NO-GO 최종본으로 갱신한다.

## 현재 결론

**NO-GO.** 코드 정적 검증은 통과했지만, 스테이징 식별·migration 호환성·필수 환경변수·테스트 계정이 검증되지 않았다. 위 P0 해제 조건과 라이브 권한 매트릭스를 모두 충족한 후에만 출시 여부를 재판정한다.
