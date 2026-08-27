# 격리된 provider fixture / 통합 테스트 러너 설계

**작성일:** 2026-08-27
**상태:** 설계 승인됨 — 문서 검토 대기
**관련:** `docs/security/2026-08-26-release-gate-checklist.md` 3번 항목

## 목표

분석 파이프라인을 **실제 AI 호출과 실제 크레딧 소모 없이** 반복 검증할 수 있는 실행 경로를 만든다.
명령 하나로 성공·타임아웃·429·500·파싱 실패 시나리오와 동시 요청을 재현할 수 있어야 한다.

## 왜 지금 이것을 만드는가

2026-07-26 감사와 그 이전 감사가 **모두 같은 지점(P1-02)에서 멈췄다** — "비용·이용권을 쓰지 않는
전용 서버 테스트 러너가 없어서 미수행". 두 번 연속 같은 벽에 막혔다는 것은 검증이 계속 밀리는
원인이 이 러너의 부재라는 뜻이다. 이것을 만들면 체크리스트 4·5번이 반복 가능한 저비용 작업이 된다.

## 현재 상태

- `createAnalyzeHandler({ model, db, requireUser, reserveAnalysis, finalizeReservation,
  cancelReservation, consumeRateLimit, getEntitlementSummary, enqueueBackgroundWork, ... })`
  로 **의존성 주입 팩토리 패턴이 이미 갖춰져 있다.** 제품 코드 수정 없이 끼워 넣을 수 있다.
- 다만 기존 테스트(`tests/api/analyze-atomic.test.js` 등)는 `db`를 손으로 만든 가짜 객체로
  대체한다 (`$transaction: async (work) => work(db)`).
- **이 가짜 `db`로는 4번 항목이 요구하는 것을 원리적으로 검증할 수 없다** —
  `getLockedEntitlement`의 `SELECT ... FOR UPDATE` 직렬화, `AnalysisReservation`의
  CONSUMED/CANCELLED 개수, 실제 크레딧 차감은 트랜잭션과 락이 진짜로 도는 곳에서만 관찰된다.

따라서 이 러너의 정체성은 **"진짜 Postgres + 가짜 provider"** 다.

## 범위

- 로컬 Postgres(Homebrew `postgresql@17`)에 테스트 전용 DB를 두고 마이그레이션을 적용한다.
- Gemini/OpenAI 로 나가는 네트워크 호출만 가로채는 fixture 를 만든다.
- 시나리오를 표로 선언하고, 호출 순서별로 다른 응답을 줄 수 있게 한다.
- 동시 요청을 임의 개수로 발생시키고, 실행 후 DB 상태를 조회해 검증한다.
- 기존 단위 테스트 스위트와 **분리된** 명령으로 실행한다.

## 범위 밖 (YAGNI)

- 부하 테스트 도구 — 동시 10건이면 `Promise.all` 로 충분하다.
- 가짜 Supabase 인증 서버 — `requireUser` 주입으로 우회한다.
- 웹 UI·리포트 대시보드 — vitest 출력으로 충분하다.
- **제품 코드 수정** — 기존 주입 지점만으로 달성한다. 0줄 변경이 목표다.

## 구성

```
tests/integration/
├─ harness/
│   ├─ provider-fixture.js   가짜 AI (fetch 가로채기 + 호출 계수)
│   ├─ test-database.js      테스트 DB 준비·초기화·가드
│   └─ seed.js               테스트 사용자·크레딧 시드
└─ analyze-concurrency.test.js
vitest.integration.config.ts
```

### provider-fixture.js — 가짜 AI

`globalThis.fetch` 를 러너 프로세스 안에서만 교체한다. 제품 코드는 건드리지 않는다.

- **Gemini/OpenAI 호스트로 가는 요청만** 시나리오 응답으로 답한다.
- 그 외 호스트는 원래 `fetch` 로 통과시킨다.
- **예상하지 못한 외부 호출이 나가면 에러를 던져 즉시 실패시킨다.** 실수로 진짜 API 를
  부르는 경로를 원천 차단하기 위한 것이다.
- 호출 횟수와 호출된 모델명을 기록한다 (4번의 "외부 모델 호출 횟수").

**네트워크 계층에서 가로채는 이유**: `model` 파라미터를 통째로 교체하면 구현은 단순하지만
`analyzeCoverLetter` 내부의 재시도·폴백 로직과 `parseModelJson` 이 실행되지 않는다.
특히 **"파싱 실패" 시나리오는 그 방식으로는 검증 자체가 성립하지 않는다** — 파서에게
"실패하라"고 지시하는 것은 파서를 테스트하는 것이 아니다. 망가진 JSON 을 실제로 돌려주고
진짜 파서가 어떻게 반응하는지 봐야 한다. 같은 이유로 429/500 시 폴백 모델로 재시도하는
동작도 네트워크 계층에서만 진짜로 확인된다.

### test-database.js — 테스트 DB

- 접속 대상이 `localhost`/`127.0.0.1` 이 **아니면 거부하고 종료한다.** 운영·스테이징 오염 방지.
- `passmate_test` DB 에 `prisma migrate deploy` 로 스키마를 만든다.
- 각 테스트 전에 애플리케이션 테이블을 비운다.

로컬 Postgres 에는 `auth.users` 도 `anon`/`authenticated` 롤도 없지만, 마이그레이션이
`to_regclass(...) IS NOT NULL` 과 `EXISTS (SELECT 1 FROM pg_roles ...)` 로 가드되어 있어
해당 구문을 건너뛴다. 인증은 `requireUser` 주입으로 우회하므로 문제되지 않는다.

### seed.js — 테스트 사용자·크레딧

시나리오가 요구하는 시작 상태를 만든다. 크레딧 잔량을 명시적으로 지정할 수 있어야
"크레딧이 정확히 한 번만 차감되는가"를 전후 비교로 판정할 수 있다.

- 지정한 개수의 사용자를 만들고, 각자의 `AnalysisEntitlement` 를 원하는 잔량으로 설정한다.
- `requireUser` 주입에 쓸 수 있도록 만들어진 사용자 식별자를 반환한다.
- 처리량 정책(무료 동시 1건·15분 3회 / 프리미엄 동시 2건·15분 10회)을 시나리오별로
  지정할 수 있어야 한다. 동시 10건 시나리오에서 레이트리밋이 먼저 걸리면 정작 확인하려는
  락 직렬화에 도달하지 못하기 때문이다.

### 시나리오 선언

```js
{ name: "성공",      respond: { status: 200, body: 정상리포트JSON } }
{ name: "타임아웃",  respond: { abort: true } }                  // AbortError
{ name: "429",      respond: { status: 429 } }
{ name: "500",      respond: { status: 500 } }
{ name: "파싱 실패", respond: { status: 200, body: "이건 JSON 이 아니다" } }
```

배열을 주면 호출 순서대로 소비한다. `[429, 200]` 은 첫 호출 429 → 폴백 재시도 성공을 뜻하며,
이것으로 `analyzeCoverLetter` 의 폴백 시퀀스를 검증한다.

## 실행

```bash
pnpm test:integration
```

`vitest.integration.config.ts` 로 분리하고, 기본 `vitest.config.ts` 의 `exclude` 에
`tests/integration/**` 를 추가한다. **기존 `pnpm exec vitest run`(73파일 328건)의 동작과
소요 시간은 변하지 않아야 한다** — DB 가 없는 환경에서 기본 스위트가 깨지면 안 되기 때문이다.

설정 산출물은 셋이다.

- `vitest.integration.config.ts` 신규
- `vitest.config.ts` 의 `exclude` 에 `tests/integration/**` 추가
- `package.json` 에 `test:integration` 스크립트 추가

로컬 Postgres 가 없거나 꺼져 있으면 **무엇을 해야 하는지 알려주는 메시지와 함께 실패한다.**
연결 오류를 그대로 내보내면 원인을 알기 어렵기 때문이다.

## 검증 대상

시나리오 실행 후 **실제 DB 를 조회해서** 확인한다. 체크리스트 4번의 완료 조건과 같다.

| 확인 대상 | 방법 |
|---|---|
| 외부 모델 호출 횟수 | fixture 의 카운터 |
| `AnalysisRequest` 레코드 수와 최종 상태 | DB 조회 |
| `AnalysisReservation` 의 CONSUMED / CANCELLED 개수 | DB 조회 |
| 사용자에게 차감된 크레딧 | 실행 전후 차이 |

동시성은 `Promise.all` 로 요청 N 개를 동시에 던져 만든다. 진짜 Postgres 이므로
`SELECT ... FOR UPDATE` 직렬화가 실제로 작동하며, **그것을 관찰하는 것이 이 러너의 존재 이유다.**

## 안전장치

"돈도 크레딧도 나가지 않는다"는 주의가 아니라 코드가 강제하는 가드여야 한다.

| 위험 | 차단 |
|---|---|
| 진짜 AI 호출 | fixture 가 provider 호스트를 가로채고, 예상 못한 외부 호출은 에러로 즉시 실패 |
| 진짜 API 키 사용 | 러너가 `GEMINI_API_KEY`/`OPENAI_API_KEY` 를 가짜 값으로 덮어씀 |
| 운영·스테이징 DB 오염 | 접속 호스트가 localhost 가 아니면 거부하고 종료 |
| 진짜 사용자 크레딧 소모 | 테스트 DB 의 시드 사용자만 사용 |

## 트레이드오프

**네트워크 계층 가로채기 vs `model` 주입**: 전자를 택했다. 구현이 조금 복잡하지만 파싱 실패와
폴백 재시도를 진짜로 검증할 수 있고, 그 둘은 체크리스트가 명시적으로 요구하는 시나리오다.

**로컬 Postgres vs 스테이징**: 전자를 택했다. 네트워크 지연이 동시성 측정을 흐리고, 스테이징에
테스트 데이터가 쌓이는 것을 피하기 위함이다. 대신 로컬 설치가 전제된다.

**로컬 Postgres vs Docker**: Docker 가 설치돼 있지 않았고, 이번 목적에는 과했다. Homebrew
`postgresql@17` 은 운영(17.x)과 같은 메이저 버전이며 `psql`/`pg_dump` 도 함께 제공한다.

## 이 설계가 열어주는 것

체크리스트 4번(동시성·중복 멱등키·provider 오류)과 5번(신뢰성 SLO 실측)이 이 러너에 의존한다.
두 항목 모두 "실행할 때마다 돈이 나간다"는 이유로 두 번의 감사에서 미뤄졌다.
