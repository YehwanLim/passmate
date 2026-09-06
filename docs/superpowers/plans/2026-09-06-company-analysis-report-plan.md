# 기업 분석 리포트 — 1차 구현 플랜 (서버: 크레딧 풀 + 생성 백엔드)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기업 분석 리포트를 서버에서 생성·저장·조회할 수 있게 한다 — 별도 크레딧 풀, `POST /api/analyze/company`, Gemini 검색 그라운딩 호출, 폴링·조회 응답의 `kind`. 화면·상품·결제는 후속 플랜.

**Architecture:** 기존 자소서 분석 파이프라인(`createAnalyzeHandler` → 예약 → `waitUntil` 백그라운드 → 상태 머신)을 **kind 주입**으로 일반화하고, 기업 전용 조각(요청 정규화·프롬프트·그라운딩 호출·출처 추출)은 `lib/company-analysis.js`에 둔다. 새 api 파일은 만들지 않는다(12/12). 크레딧은 `AnalysisEntitlement.companyCreditsGranted` 한 컬럼 + `AnalysisReservation.kind`로 분리한다.

**Tech Stack:** Vercel Serverless(ESM JS) · Prisma 7 + Postgres · Gemini `generateContent` + `google_search` 도구 · Vitest · pnpm

**Spec:** `docs/superpowers/specs/2026-09-06-company-analysis-report-design.md` (§1 스키마·규칙, §5 기술 설계)

**후속 플랜(이 플랜 착지 후 작성):** ② 화면(`CompanyAnalyze`·`CompanyReport`·`AnalysisPending` 분기·관리자 토글 UI) ③ 상품·결제(`PurchaseProduct` 3종·`PurchaseProductSetting`·웹훅 번들·가격 UI) ④ 진입점·샘플.

## Global Constraints

- `pnpm`만 쓴다. npm 금지, 락파일 변경 금지.
- `api/` 아래 `.js` 파일 수 **12 유지** (`scripts/vercel-function-limit.test.js`). 새 엔드포인트는 `api/analyze.js`에 `?kind=company`로 얹는다.
- 라우트 추가 시 `vercel.json` rewrites와 `vite.config.ts` `apiRoute()` **둘 다** 수정 (함정 1). `vercel.json`은 현재 워킹 트리에 **다른 미커밋 변경(GIS 로그인 CSP)** 이 있다 — 그 변경을 보존하고 rewrites 항목만 추가한다.
- 타임아웃 3형제 유지: 모델 100s(`ANALYSIS_MODEL_TIMEOUT_MS`) < TTL 125s < `maxDuration` 120s. 기업 분석 총 데드라인 95s.
- 상태 집합 `PENDING → CALLING → PERSISTENCE_PENDING → SUCCEEDED | FAILED`는 prisma·`lib/analysis-request-lifecycle.js`·`client/src/lib/analysisRequest.ts`가 공유 — 이 플랜은 상태를 바꾸지 않는다.
- 응답 필드명은 snake_case(`analysis_id` 등) 유지. 기존 에러 코드 문자열 유지. 신규 코드: `COMPANY_CREDITS_EXHAUSTED`(409), `COMPANY_ANALYSIS_DISABLED`(503), `RESUME_ANALYSIS_NOT_FOUND`(404).
- 테스트에서 AI·Supabase·결제를 실제 호출하지 않는다. `fetcher` DI로 Gemini 응답을 주입한다.
- 로그·감사 이벤트에 회사명 외 자소서 본문·AI 응답·이메일·토큰 금지.
- prisma는 `lib/prisma.js` 싱글턴만. 마이그레이션 SQL은 파일로만 추가하고 **`prisma migrate deploy`/`db push`는 실행하지 않는다**(사용자가 `DIRECT_URL`로 직접 적용).
- 커밋은 각 Task 끝의 커밋 단계에 따르되, **사용자가 체크포인트 커밋을 승인했을 때만** 실행한다. 승인이 없으면 커밋 단계를 건너뛰고 스테이징만 한다. `git add`는 해당 Task 파일만 명시한다(무관한 미커밋 변경 `client/src/pages/Login.tsx`, `client/src/lib/googleIdentity*.ts`, `groble-cover-4x3.png`는 절대 스테이징하지 않는다).
- 문서·주석은 한국어. 코드 식별자는 원형.

---

## 파일 구조

| 파일 | 역할 | 상태 |
| --- | --- | --- |
| `prisma/schema.prisma` | `AnalysisKind` enum, `kind`·`companyCreditsGranted`·`companyAnalysisEnabled` 컬럼 | 수정 |
| `prisma/migrations/20260906_add_analysis_kind_and_company_credits/migration.sql` | 위 스키마의 SQL | 생성 |
| `lib/analysis-entitlements.js` | kind 인지 사용량·예약·지급 | 수정 |
| `lib/analysis-entitlements.test.js` | 메모리 DB에 kind·company 컬럼 반영 + 신규 케이스 | 수정 |
| `api/entitlements.js` | 요약에 `companyRemaining`·`companyAnalysisEnabled` 가산 | 수정 |
| `tests/api/entitlements.test.js` | 신규 필드 패스스루 | 수정 |
| `lib/admin-handlers/entitlements.js` | `companyAnalysisEnabled` 단일 키 PATCH | 수정 |
| `tests/api/admin/entitlements.test.js` | 토글 케이스 | 수정 |
| `lib/admin-handlers/credits.js` | POST `kind?` | 수정 |
| `tests/api/admin/credits.test.js` | kind 전달 케이스 | 수정 |
| `client/src/lib/entitlements.ts` · `entitlements.test.ts` | 파서 tolerant 확장 | 수정 |
| `shared/prompts/companyReportPrompt.js` · `.d.ts` | `COMPANY_REPORT_SYSTEM_PROMPT` 단일 정의 | 생성 |
| `client/src/pages/companyReportPrompt.singleSource.test.ts` | 프롬프트 예시 JSON 유효성·인라인 금지 | 생성 |
| `lib/rate-limit.js` | `COMPANY_ANALYSIS_THROUGHPUT`, `getCompanyAnalysisThroughputPolicy` | 수정 |
| `lib/company-analysis.js` | 요청 정규화·해시·제목·모델 호출·출처 추출 | 생성 |
| `lib/company-analysis.test.js` | 순수 함수 + 모델 호출(fetcher 주입) 테스트 | 생성 |
| `api/analyze.js` · `api/analyze.d.ts` | `createAnalyzeHandler` kind 일반화, `createCompanyAnalyzeHandler`, `?kind=company` 디스패치 | 수정 |
| `tests/api/analyze-company.test.js` | 기업 핸들러 권한·검증·크레딧·접수 | 생성 |
| `vercel.json` · `vite.config.ts` | `/api/analyze/company` 라우팅 | 수정 |
| `tests/api/company-analysis-routing.test.js` | 라우팅 두 곳 텍스트 검사 | 생성 |
| `api/analysis-requests/[id].js` · `api/analysis/[id].js` · `api/projects.js` | 응답에 `kind` | 수정 |
| `tests/api/analysis-request-status.test.js` · `tests/api/protected-user-routes.test.js` | `toEqual`에 `kind` | 수정 |
| `scripts/manual/company-analysis-probe.mjs` | 실제 Gemini 1회 수동 프로브(테스트 아님) | 생성 |

---

## PR1 — 크레딧 풀

### Task 1: Prisma 스키마 + 마이그레이션 ①

**Files:**
- Modify: `prisma/schema.prisma` (enum 블록 `PurchaseProduct` 아래, `EntitlementSetting`, `AnalysisEntitlement`, `AnalysisReservation`, `PaymentEntitlement`, `AdminCreditGrant`, `Analysis`)
- Create: `prisma/migrations/20260906_add_analysis_kind_and_company_credits/migration.sql`

**Interfaces:**
- Produces: Prisma 클라이언트 필드 `analysis.kind`, `analysisReservation.kind`, `analysisEntitlement.companyCreditsGranted`, `paymentEntitlement.companyCreditsGranted`, `adminCreditGrant.kind`, `entitlementSetting.companyAnalysisEnabled`; enum 값 `"RESUME" | "COMPANY"`.

- [ ] **Step 1: 스키마에 enum과 컬럼 추가**

`prisma/schema.prisma`의 `enum PurchaseProduct { ... }` 블록 바로 아래에 추가:

```prisma
/// 분석 종류. 자소서 진단(RESUME)과 기업 분석 리포트(COMPANY)는 같은 파이프라인·테이블을
/// 쓰되 크레딧 풀과 화면이 다르다. 기본값 RESUME 으로 기존 행은 전부 자소서.
enum AnalysisKind {
  RESUME
  COMPANY

  @@map("analysis_kind")
}
```

`model EntitlementSetting`의 `grobleSinglePaymentUrl` 줄 아래에:

```prisma
  /// 기업 분석 리포트 판매·생성 스위치. premiumEnabled 와 별개로 끄고 켠다.
  companyAnalysisEnabled    Boolean @default(false) @map("company_analysis_enabled")
```

`model AnalysisEntitlement`의 `premiumCreditsGranted` 줄 아래에:

```prisma
  /// 기업 분석 리포트 크레딧 누적 지급치(결제·관리자). 잔여 = 이 값 - COMPANY 예약 수.
  companyCreditsGranted   Int    @default(0) @map("company_credits_granted")
```

`model AnalysisReservation`의 `status` 줄 아래에, 그리고 `@@index([status])` 아래에:

```prisma
  kind   AnalysisKind              @default(RESUME)
```

```prisma
  @@index([userId, kind, source, status])
```

`model PaymentEntitlement`의 `creditsGranted` 줄 아래에:

```prisma
  /// 번들 결제에서 함께 지급된 기업 분석 크레딧. credits_granted 는 자소서 크레딧 의미를 유지한다.
  companyCreditsGranted Int @default(0) @map("company_credits_granted")
```

`model AdminCreditGrant`의 `source` 줄 아래에:

```prisma
  kind             AnalysisKind           @default(RESUME)
```

`model Analysis`의 `projectId` 줄 아래에, 그리고 `@@index([userId])` 아래에:

```prisma
  /// RESUME 이면 questionText/inputText 가 자소서, COMPANY 면 둘 다 "" 이고 리포트는 aiResponseJson 에만 있다.
  kind      AnalysisKind @default(RESUME)
```

```prisma
  @@index([userId, kind])
```

- [ ] **Step 2: 마이그레이션 SQL 작성**

`prisma/migrations/20260906_add_analysis_kind_and_company_credits/migration.sql`:

```sql
-- 기업 분석 리포트: 자소서 분석과 같은 테이블을 쓰되 kind 로 구분하고, 크레딧 풀을 분리한다.
-- 기존 행은 전부 자소서(RESUME)라 기본값으로 채운다.
CREATE TYPE analysis_kind AS ENUM ('RESUME', 'COMPANY');

ALTER TABLE analyses
  ADD COLUMN kind analysis_kind NOT NULL DEFAULT 'RESUME';
CREATE INDEX IF NOT EXISTS analyses_user_id_kind_idx
  ON analyses (user_id, kind);

ALTER TABLE analysis_reservations
  ADD COLUMN kind analysis_kind NOT NULL DEFAULT 'RESUME';
CREATE INDEX IF NOT EXISTS analysis_reservations_user_id_kind_source_status_idx
  ON analysis_reservations (user_id, kind, source, status);

-- 기업 분석 크레딧 누적 지급치. 잔여는 이 값에서 kind = 'COMPANY' 예약(PENDING/CONSUMED) 수를 뺀 값.
ALTER TABLE analysis_entitlements
  ADD COLUMN company_credits_granted INTEGER NOT NULL DEFAULT 0
  CHECK (company_credits_granted >= 0);

-- 번들 결제 이력. credits_granted 는 자소서 크레딧 의미를 유지한다.
ALTER TABLE payment_entitlements
  ADD COLUMN company_credits_granted INTEGER NOT NULL DEFAULT 0
  CHECK (company_credits_granted >= 0);

ALTER TABLE admin_credit_grants
  ADD COLUMN kind analysis_kind NOT NULL DEFAULT 'RESUME';

-- 기업 분석 판매·생성 스위치. 기본 꺼짐: 관리자 지급 크레딧으로 내부 QA 후 켠다.
ALTER TABLE entitlement_settings
  ADD COLUMN company_analysis_enabled BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: 클라이언트 재생성·검증**

Run: `pnpm exec prisma validate && pnpm exec prisma generate`
Expected: `The schema at prisma/schema.prisma is valid` 후 `Generated Prisma Client`.

- [ ] **Step 4: 기존 스키마 관련 테스트가 깨지지 않는지 확인**

Run: `pnpm exec vitest run tests/security/database-default-deny.test.js scripts/vercel-function-limit.test.js`
Expected: PASS (새 테이블이 없으므로 기본 거부 목록 변경 없음).

- [ ] **Step 5: 커밋(승인 시)**

```bash
git add prisma/schema.prisma prisma/migrations/20260906_add_analysis_kind_and_company_credits/migration.sql
git commit -m "feat(schema): add analysis kind and company credit pool columns"
```

---

### Task 2: `lib/analysis-entitlements.js` — kind 인지 사용량·예약·지급

**Files:**
- Modify: `lib/analysis-entitlements.js`
- Test: `lib/analysis-entitlements.test.js`

**Interfaces:**
- Produces:
  - `EntitlementUnavailableError(code = "ANALYSIS_CREDITS_EXHAUSTED")` — `error.code`가 그대로 API 코드.
  - `getEntitlementSummary(tx, userId)` / `getEntitlementSummaryReadOnly(db, userId)` 반환에 `companyAnalysisEnabled: boolean`, `companyRemaining: number` 추가. `remaining`은 자소서 합계 그대로.
  - `reserveAnalysis(tx, userId, kind = "RESUME")` → `{ reservationId, source, kind }`. COMPANY 소진 시 `EntitlementUnavailableError("COMPANY_CREDITS_EXHAUSTED")`.
  - `grantGroblePurchase(tx, { resumeCredits?, credits?, companyCredits = 0, providerPaymentId, rawEvent, userId })` → `{ granted, credits, companyCredits }`. `credits`는 `resumeCredits`의 구명(웹훅 호환).
  - `grantAdminCredits(tx, { ..., kind = "RESUME" })`.
  - `assertGrantAmounts({ resumeCredits, companyCredits })` export.

- [ ] **Step 1: 메모리 DB 픽스처를 kind·company 컬럼에 맞춘다**

`lib/analysis-entitlements.test.js`의 `createMemoryDatabase` 안에서 다음을 바꾼다.

`analysisEntitlement.upsert`의 `entitlement` 객체에 `companyCreditsGranted: 0,` 추가.

`analysisEntitlement.update`에 다음 분기 추가(기존 두 분기 아래):

```js
        if (data.companyCreditsGranted?.increment) {
          entitlement.companyCreditsGranted =
            (entitlement.companyCreditsGranted ?? 0) + data.companyCreditsGranted.increment;
        }
```

`analysisReservation.count`의 필터를 kind 인지로:

```js
      count: async ({ where }) =>
        state.reservations.filter(
          (reservation) =>
            reservation.userId === where.userId &&
            reservation.source === where.source &&
            (where.kind === undefined || (reservation.kind ?? "RESUME") === where.kind) &&
            where.status.in.includes(reservation.status),
        ).length,
```

`$queryRaw`의 INSERT 분기에서 값 순서가 바뀌므로(아래 Step 3) 다음으로 교체:

```js
      if (sql.includes("INSERT INTO payment_entitlements")) {
        const [userId, providerPaymentId, credits, companyCredits, rawEvent] = values;
        if (state.payments.has(providerPaymentId)) {
          return [];
        }
        state.payments.set(providerPaymentId, { companyCredits, credits, rawEvent, userId });
        return [{ id: `payment-${state.payments.size}` }];
      }
```

`entitlementSetting.findUnique`를 `companyAnalysisEnabled` 옵션까지 받게:

```js
    entitlementSetting: {
      findUnique: async () => ({
        premiumCreditsPerPurchase: 3,
        premiumEnabled,
        companyAnalysisEnabled,
      }),
    },
```

그리고 함수 시그니처를 `function createMemoryDatabase({ premiumEnabled = false, companyAnalysisEnabled = true } = {})`로.

- [ ] **Step 2: 기존 단언을 새 반환 형태에 맞추고 실패하는 새 테스트 추가**

기존 `grantGroblePurchase` 단언 3곳(`{ granted: true, credits: 3 }`, `{ granted: false, credits: 0 }`, `{ granted: true, credits: 1 }`)을 각각 `companyCredits: 0`을 포함하도록 바꾼다:

```js
    expect(first).toEqual({ granted: true, credits: 3, companyCredits: 0 });
    // ...
    expect(replay).toEqual({ granted: false, credits: 0, companyCredits: 0 });
    // ...
    expect(grant).toEqual({ granted: true, credits: 1, companyCredits: 0 });
```

파일 끝 `describe` 안에 새 테스트를 추가한다:

```js
  it("keeps company credits in a separate pool from résumé credits", async () => {
    const db = createMemoryDatabase({ premiumEnabled: true });
    await grantGroblePurchase(db, {
      resumeCredits: 0,
      companyCredits: 1,
      providerPaymentId: "pay-company-1",
      rawEvent: { type: "payment.completed" },
      userId: USER_ID,
    });

    const before = await getEntitlementSummary(db, USER_ID);
    expect(before.companyRemaining).toBe(1);
    // 자소서 무료 1회는 그대로: 기업 크레딧이 remaining 에 섞이지 않는다.
    expect(before.remaining).toBe(1);

    const reservation = await reserveAnalysis(db, USER_ID, "COMPANY");
    expect(reservation).toEqual({
      reservationId: expect.any(String),
      source: "premium",
      kind: "COMPANY",
    });

    const after = await getEntitlementSummary(db, USER_ID);
    expect(after.companyRemaining).toBe(0);
    expect(after.remaining).toBe(1);
  });

  it("rejects a company reservation with COMPANY_CREDITS_EXHAUSTED even when résumé credits remain", async () => {
    const db = createMemoryDatabase({ premiumEnabled: true });

    await expect(reserveAnalysis(db, USER_ID, "COMPANY")).rejects.toMatchObject({
      code: "COMPANY_CREDITS_EXHAUSTED",
    });
    // 자소서 무료 1회는 여전히 예약 가능하다.
    await expect(reserveAnalysis(db, USER_ID)).resolves.toMatchObject({ source: "free", kind: "RESUME" });
  });

  it("grants a bundle purchase atomically and idempotently for both pools", async () => {
    const db = createMemoryDatabase({ premiumEnabled: true });

    const first = await grantGroblePurchase(db, {
      resumeCredits: 3,
      companyCredits: 3,
      providerPaymentId: "pay-bundle-1",
      rawEvent: { type: "payment.completed" },
      userId: USER_ID,
    });
    expect(first).toEqual({ granted: true, credits: 3, companyCredits: 3 });

    const replay = await grantGroblePurchase(db, {
      resumeCredits: 3,
      companyCredits: 3,
      providerPaymentId: "pay-bundle-1",
      rawEvent: { type: "payment.completed" },
      userId: USER_ID,
    });
    expect(replay).toEqual({ granted: false, credits: 0, companyCredits: 0 });

    const summary = await getEntitlementSummary(db, USER_ID);
    expect(summary.premiumRemaining).toBe(3);
    expect(summary.companyRemaining).toBe(3);
  });

  it("rejects a purchase that grants nothing in either pool", async () => {
    const db = createMemoryDatabase();
    await expect(
      grantGroblePurchase(db, {
        resumeCredits: 0,
        companyCredits: 0,
        providerPaymentId: "pay-empty",
        rawEvent: {},
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDIT_AMOUNT" });
  });

  it("lets an administrator grant company credits with the grant kind recorded", async () => {
    const db = createMemoryDatabase();
    const summary = await grantAdminCredits(db, {
      userId: USER_ID,
      credits: 2,
      kind: "COMPANY",
      grantedByUserId: SECOND_USER_ID,
      grantedByEmail: "admin@preview.dev",
    });

    expect(summary.companyRemaining).toBe(2);
    expect(summary.bonusRemaining).toBe(0);
    expect(db.state.adminGrants.at(-1)).toMatchObject({ kind: "COMPANY", creditsGranted: 2 });
  });

  it("hides company credits while the company analysis switch is off", async () => {
    const db = createMemoryDatabase({ companyAnalysisEnabled: false });
    await grantAdminCredits(db, {
      userId: USER_ID,
      credits: 1,
      kind: "COMPANY",
      grantedByUserId: SECOND_USER_ID,
      grantedByEmail: "admin@preview.dev",
    });

    const summary = await getEntitlementSummaryReadOnly(db, USER_ID);
    expect(summary.companyAnalysisEnabled).toBe(false);
    expect(summary.companyRemaining).toBe(0);
  });
```

`createMemoryDatabase`가 `db.state = state;`를 노출하는지 확인하고, 없으면 `const db = { ... };` 뒤에 `db.state = state;`를 추가한다.

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm exec vitest run lib/analysis-entitlements.test.js`
Expected: FAIL — `companyRemaining` undefined, `reserveAnalysis` 3번째 인자 무시, `companyCredits` 키 없음.

- [ ] **Step 4: 구현**

`lib/analysis-entitlements.js`를 다음과 같이 고친다.

에러 클래스:

```js
export class EntitlementUnavailableError extends Error {
  constructor(code = "ANALYSIS_CREDITS_EXHAUSTED") {
    super("Analysis credits are exhausted");
    this.code = code;
  }
}
```

`getUsage`에 kind 추가(기본 RESUME이라 기존 호출은 그대로):

```js
async function getUsage(tx, userId, source, kind = "RESUME") {
  return tx.analysisReservation.count({
    where: {
      userId,
      source,
      kind,
      status: { in: CREDIT_RESERVATION_STATUSES },
    },
  });
}
```

`getSummaryForEntitlement`: 설정 select에 `companyAnalysisEnabled: true`를 추가하고, `premiumRemaining` 계산 뒤에:

```js
  // 기업 분석 크레딧은 무료 티어가 없어 PREMIUM 버킷 하나다(관리자 지급도 같은 컬럼).
  const companyAnalysisEnabled = settings?.companyAnalysisEnabled === true;
  const companyUsed = companyAnalysisEnabled ? await getUsage(tx, userId, "PREMIUM", "COMPANY") : 0;
  const companyRemaining = companyAnalysisEnabled
    ? Math.max(Number(entitlement?.companyCreditsGranted ?? 0) - companyUsed, 0)
    : 0;

  return {
    premiumEnabled,
    freeRemaining,
    bonusRemaining,
    premiumRemaining,
    // remaining 은 자소서 크레딧 합계라는 기존 의미를 지킨다. 기업 크레딧은 섞지 않는다.
    remaining: freeRemaining + bonusRemaining + premiumRemaining,
    companyAnalysisEnabled,
    companyRemaining,
  };
```

`getEntitlementSummaryReadOnly`: `Promise.all`에 `getUsage(db, userId, "PREMIUM", "COMPANY")`를 6번째로 추가하고 settings select에 `companyAnalysisEnabled: true`를 넣은 뒤 같은 두 필드를 계산해 반환에 넣는다:

```js
  const [entitlement, settings, freeUsed, bonusUsed, premiumUsed, companyUsed] = await Promise.all([
    db.analysisEntitlement.findUnique({ where: { userId } }),
    db.entitlementSetting.findUnique({
      where: { id: "singleton" },
      select: { premiumEnabled: true, companyAnalysisEnabled: true },
    }),
    getUsage(db, userId, "FREE"),
    getUsage(db, userId, "BONUS"),
    getUsage(db, userId, "PREMIUM"),
    getUsage(db, userId, "PREMIUM", "COMPANY"),
  ]);
  // ...기존 계산...
  const companyAnalysisEnabled = settings?.companyAnalysisEnabled === true;
  const companyRemaining = companyAnalysisEnabled
    ? Math.max(Number(entitlement?.companyCreditsGranted ?? 0) - companyUsed, 0)
    : 0;

  return {
    premiumEnabled,
    freeRemaining,
    bonusRemaining,
    premiumRemaining,
    remaining: freeRemaining + bonusRemaining + premiumRemaining,
    companyAnalysisEnabled,
    companyRemaining,
  };
```

`reserveAnalysis`:

```js
export async function reserveAnalysis(tx, userId, kind = "RESUME") {
  const entitlement = await getLockedEntitlement(tx, userId);
  const summary = await getSummaryForEntitlement(tx, userId, entitlement);

  if (kind === "COMPANY") {
    if (summary.companyRemaining === 0) {
      throw new EntitlementUnavailableError("COMPANY_CREDITS_EXHAUSTED");
    }
    const reservation = await tx.analysisReservation.create({
      data: { userId, source: "PREMIUM", kind: "COMPANY", status: "PENDING" },
    });
    return { reservationId: reservation.id, source: "premium", kind: "COMPANY" };
  }

  if (summary.remaining === 0) {
    throw new EntitlementUnavailableError();
  }

  const source = summary.freeRemaining > 0
    ? "FREE"
    : summary.bonusRemaining > 0
      ? "BONUS"
      : "PREMIUM";
  const reservation = await tx.analysisReservation.create({
    data: {
      userId,
      source,
      kind: "RESUME",
      status: "PENDING",
    },
  });

  return {
    reservationId: reservation.id,
    source: source.toLowerCase(),
    kind: "RESUME",
  };
}
```

`grantGroblePurchase`:

```js
export async function grantGroblePurchase(tx, input) {
  // 지급 크레딧 수는 결제된 상품이 결정한다(lib/entitlement-products.js).
  // credits 는 resumeCredits 의 구명이다(웹훅 호환).
  const resumeCredits = input.resumeCredits ?? input.credits ?? 0;
  const companyCredits = input.companyCredits ?? 0;
  assertGrantAmounts({ resumeCredits, companyCredits });
  const entitlement = await getLockedEntitlement(tx, input.userId);

  const insertedPayment = await tx.$queryRaw`
    INSERT INTO payment_entitlements (
      user_id,
      provider_payment_id,
      credits_granted,
      company_credits_granted,
      raw_event
    )
    VALUES (
      ${input.userId}::uuid,
      ${input.providerPaymentId},
      ${resumeCredits},
      ${companyCredits},
      ${JSON.stringify(input.rawEvent ?? null)}::jsonb
    )
    ON CONFLICT (provider_payment_id) DO NOTHING
    RETURNING id
  `;

  if (insertedPayment.length === 0) {
    return { granted: false, credits: 0, companyCredits: 0 };
  }

  // 두 풀을 한 번의 update 로 올린다. ON CONFLICT 가 이 update 를 함께 게이트하므로
  // 재전송 웹훅은 어느 풀도 두 번 올리지 못한다.
  await tx.analysisEntitlement.update({
    where: { userId: entitlement.userId },
    data: {
      premiumCreditsGranted: { increment: resumeCredits },
      companyCreditsGranted: { increment: companyCredits },
    },
  });

  return { granted: true, credits: resumeCredits, companyCredits };
}

/** 번들 지급 검증: 각 풀은 0 이상, 합계는 1~10,000. */
export function assertGrantAmounts({ resumeCredits, companyCredits }) {
  const valid = (value) => Number.isInteger(value) && value >= 0 && value <= 10000;
  if (!valid(resumeCredits) || !valid(companyCredits) || resumeCredits + companyCredits < 1) {
    const error = new Error("Grant must include 1 to 10,000 credits across pools");
    error.code = "INVALID_CREDIT_AMOUNT";
    throw error;
  }
}
```

`grantAdminCredits`:

```js
export async function grantAdminCredits(tx, {
  userId,
  credits,
  kind = "RESUME",
  grantedByUserId,
  grantedByEmail,
  note = null,
}) {
  assertCreditAmount(credits);
  if (kind !== "RESUME" && kind !== "COMPANY") {
    const error = new Error("Unknown analysis kind");
    error.code = "INVALID_ANALYSIS_KIND";
    throw error;
  }
  const entitlement = await getLockedEntitlement(tx, userId);
  await tx.analysisEntitlement.update({
    where: { userId: entitlement.userId },
    data: kind === "COMPANY"
      ? { companyCreditsGranted: { increment: credits } }
      : { bonusCreditsGranted: { increment: credits } },
  });
  await tx.adminCreditGrant.create({
    data: {
      userId,
      grantedByUserId,
      grantedByEmail,
      creditsGranted: credits,
      source: "MANUAL",
      kind,
      note,
    },
  });
  return getEntitlementSummary(tx, userId);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm exec vitest run lib/analysis-entitlements.test.js`
Expected: PASS (기존 + 신규 6개).

- [ ] **Step 6: 의존 테스트 회귀 확인**

Run: `pnpm exec vitest run tests/api/groble-webhook-handler.test.js tests/api/analyze-atomic.test.js tests/api/feedback.test.js`
Expected: PASS. 웹훅 테스트가 `grantGroblePurchase` 반환을 `toEqual({granted, credits})`로 단언하면 `companyCredits: 0`을 추가해 맞춘다(웹훅 핸들러 자체는 이 플랜에서 바꾸지 않는다).

- [ ] **Step 7: 커밋(승인 시)**

```bash
git add lib/analysis-entitlements.js lib/analysis-entitlements.test.js tests/api/groble-webhook-handler.test.js
git commit -m "feat(entitlements): add a company analysis credit pool alongside résumé credits"
```

---

### Task 3: `GET /api/entitlements` 요약에 기업 필드 가산

**Files:**
- Modify: `api/entitlements.js:58-79`
- Test: `tests/api/entitlements.test.js`

**Interfaces:**
- Produces: 응답에 `companyAnalysisEnabled: boolean`, `companyRemaining: number` 추가. 기존 7키 유지.

- [ ] **Step 1: 실패하는 테스트**

`tests/api/entitlements.test.js`의 `beforeEach`에서 `getEntitlementSummaryReadOnly.mockResolvedValue`에 두 필드를 추가한다:

```js
    mocks.getEntitlementSummaryReadOnly.mockResolvedValue({
      freeRemaining: 1,
      bonusRemaining: 0,
      premiumEnabled: false,
      premiumRemaining: 0,
      remaining: 1,
      companyAnalysisEnabled: false,
      companyRemaining: 0,
    });
```

그리고 `describe` 안에 추가:

```js
  it("passes the company analysis pool through to the summary response", async () => {
    mocks.getEntitlementSummaryReadOnly.mockResolvedValue({
      freeRemaining: 0,
      bonusRemaining: 0,
      premiumEnabled: true,
      premiumRemaining: 2,
      remaining: 2,
      companyAnalysisEnabled: true,
      companyRemaining: 1,
    });

    const response = await invokeEntitlements();

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      remaining: 2,
      companyAnalysisEnabled: true,
      companyRemaining: 1,
    });
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run tests/api/entitlements.test.js`
Expected: 기존 요약 테스트가 `toEqual`로 전체 본문을 단언한다면 새 필드 때문에 FAIL, 새 테스트는 `...summary` 스프레드 덕에 PASS일 수 있다. 어느 쪽이든 다음 단계로.

- [ ] **Step 3: 구현 — 기존 `toEqual` 단언에 두 필드 추가**

`api/entitlements.js`의 `getEntitlements`는 `...summary`를 스프레드하므로 서버 코드 변경은 없다. 요약 필드가 응답에 그대로 나간다는 계약을 테스트로만 고정한다. 기존 테스트에서 응답 전체를 `toEqual`로 단언하는 곳에 `companyAnalysisEnabled: false, companyRemaining: 0`을 추가한다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run tests/api/entitlements.test.js`
Expected: PASS.

- [ ] **Step 5: 커밋(승인 시)**

```bash
git add tests/api/entitlements.test.js
git commit -m "test(entitlements): pin company credit fields in the summary response"
```

---

### Task 4: 관리자 — `companyAnalysisEnabled` 토글과 kind 지급

**Files:**
- Modify: `lib/admin-handlers/entitlements.js`
- Modify: `lib/admin-handlers/credits.js`
- Test: `tests/api/admin/entitlements.test.js`, `tests/api/admin/credits.test.js`

**Interfaces:**
- Produces: `GET /api/admin/entitlements` → `{ premiumEnabled, companyAnalysisEnabled }`. `PATCH` 본문은 `{ premiumEnabled: boolean }` **또는** `{ companyAnalysisEnabled: boolean }` 정확히 한 키. `POST /api/admin/credits` 본문에 `kind?: "RESUME" | "COMPANY"`(기본 RESUME).

- [ ] **Step 1: 실패하는 테스트 — 토글**

`tests/api/admin/entitlements.test.js`의 `beforeEach` mock을 두 필드로:

```js
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      premiumEnabled: false,
      companyAnalysisEnabled: false,
    });
    mocks.prisma.entitlementSetting.update.mockResolvedValue({
      premiumEnabled: true,
      companyAnalysisEnabled: false,
    });
```

추가 테스트:

```js
  it("returns both switches on GET", async () => {
    const res = await invoke();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ premiumEnabled: false, companyAnalysisEnabled: false });
  });

  it("toggles the company analysis switch with a single-key PATCH", async () => {
    mocks.prisma.entitlementSetting.update.mockResolvedValue({
      premiumEnabled: false,
      companyAnalysisEnabled: true,
    });

    const res = await invoke({ method: "PATCH", body: { companyAnalysisEnabled: true } });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ premiumEnabled: false, companyAnalysisEnabled: true });
    expect(mocks.prisma.entitlementSetting.update).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: { companyAnalysisEnabled: true },
    });
  });

  it("rejects a PATCH that sets both switches at once", async () => {
    const res = await invoke({
      method: "PATCH",
      body: { premiumEnabled: true, companyAnalysisEnabled: true },
    });
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.entitlementSetting.update).not.toHaveBeenCalled();
  });
```

기존 PATCH 성공 테스트가 `res.body`를 `toEqual({ premiumEnabled: true })`로 단언하면 `companyAnalysisEnabled: false`를 추가한다.

- [ ] **Step 2: 실패하는 테스트 — 지급 kind**

`tests/api/admin/credits.test.js`의 `describe` 안에 추가:

```js
  it("forwards the requested grant kind to the entitlement layer", async () => {
    mocks.grantAdminCredits.mockResolvedValue({ ...SUMMARY, companyRemaining: 1 });

    const res = await invoke({
      method: "POST",
      body: { userId: USER_ID, credits: 1, kind: "COMPANY" },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.grantAdminCredits).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: USER_ID,
      credits: 1,
      kind: "COMPANY",
    }));
  });

  it("defaults the grant kind to RESUME and rejects unknown kinds", async () => {
    mocks.grantAdminCredits.mockResolvedValue(SUMMARY);

    await invoke({ method: "POST", body: { userId: USER_ID, credits: 1 } });
    expect(mocks.grantAdminCredits).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
      kind: "RESUME",
    }));

    const res = await invoke({ method: "POST", body: { userId: USER_ID, credits: 1, kind: "BONUS" } });
    expect(res.statusCode).toBe(400);
  });
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm exec vitest run tests/api/admin/entitlements.test.js tests/api/admin/credits.test.js`
Expected: FAIL — GET 본문에 `companyAnalysisEnabled` 없음, `companyAnalysisEnabled` PATCH 400, kind 미전달.

- [ ] **Step 4: 구현 — 토글**

`lib/admin-handlers/entitlements.js`:

```js
const SETTINGS_ID = "singleton";
const SWITCH_KEYS = new Set(["premiumEnabled", "companyAnalysisEnabled"]);
const SWITCH_SELECT = { premiumEnabled: true, companyAnalysisEnabled: true };

/** PATCH 는 스위치 하나만 받는다 — 두 스위치를 한 요청에 섞어 실수로 같이 켜는 것을 막는다. */
function parseSwitchBody(body) {
  const keys = Object.keys(body ?? {});
  if (keys.length !== 1 || !SWITCH_KEYS.has(keys[0]) || typeof body[keys[0]] !== "boolean") {
    return null;
  }
  return { [keys[0]]: body[keys[0]] };
}

function switchResponse(settings) {
  return {
    premiumEnabled: settings?.premiumEnabled ?? false,
    companyAnalysisEnabled: settings?.companyAnalysisEnabled ?? false,
  };
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);

  try {
    await requireAdministrator(req, prisma);

    if (req.method === "GET") {
      const settings = await prisma.entitlementSetting.findUnique({
        where: { id: SETTINGS_ID },
        select: SWITCH_SELECT,
      });
      return res.status(200).json(switchResponse(settings));
    }

    if (req.method === "PATCH") {
      const data = parseSwitchBody(req.body);
      if (!data) {
        return res.status(400).json({
          error: "PATCH accepts exactly one of { premiumEnabled: boolean } or { companyAnalysisEnabled: boolean }",
        });
      }

      const settings = await prisma.entitlementSetting.update({
        where: { id: SETTINGS_ID },
        data,
      });
      return res.status(200).json(switchResponse(settings));
    }

    return sendMethodNotAllowed(res, requestId);
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/entitlements");
  }
}
```

(`hasValidPremiumEnabledBody`는 제거 — 이 변경으로 쓰이지 않게 된 헬퍼.)

- [ ] **Step 5: 구현 — 지급 kind**

`lib/admin-handlers/credits.js`에 헬퍼 추가:

```js
const GRANT_KINDS = new Set(["RESUME", "COMPANY"]);

function isGrantKind(value) {
  return value === undefined || GRANT_KINDS.has(value);
}
```

POST 검증 조건에 `|| !isGrantKind(body.kind)`를 추가하고, `grantAdminCredits` 호출에 `kind: body.kind ?? "RESUME",`을 넣는다:

```js
    if (
      !body || typeof body !== "object" || Array.isArray(body)
      || !isUuid(body.userId)
      || !isCredits(body.credits)
      || !isGrantKind(body.kind)
      || (body.note !== undefined && body.note !== null && typeof body.note !== "string")
    ) {
      return sendRequestError(res, 400, requestId);
    }
    // ...
      grantAdminCredits(tx, {
        userId: body.userId,
        credits: body.credits,
        kind: body.kind ?? "RESUME",
        note: note || null,
        grantedByUserId: administrator.applicationUser.id,
        grantedByEmail: administrator.applicationUser.email,
      }),
```

`mapGrant`에 `kind: grant.kind ?? "RESUME",`을 추가한다.

- [ ] **Step 6: 통과 확인**

Run: `pnpm exec vitest run tests/api/admin/entitlements.test.js tests/api/admin/credits.test.js`
Expected: PASS.

- [ ] **Step 7: 커밋(승인 시)**

```bash
git add lib/admin-handlers/entitlements.js lib/admin-handlers/credits.js tests/api/admin/entitlements.test.js tests/api/admin/credits.test.js
git commit -m "feat(admin): add the company analysis switch and company credit grants"
```

---

### Task 5: 클라이언트 요약 파서 — 신규 필드를 관대하게 읽는다

**Files:**
- Modify: `client/src/lib/entitlements.ts`
- Test: `client/src/lib/entitlements.test.ts`

**Interfaces:**
- Produces: `EntitlementSummary`에 `companyAnalysisEnabled: boolean`, `companyRemaining: number` 추가. 구버전 응답(필드 없음)은 `false`/`0`.

- [ ] **Step 1: 실패하는 테스트**

`client/src/lib/entitlements.test.ts`의 "returns the server-provided credit counts" 테스트의 기대값에 두 줄 추가:

```ts
      // 구버전 서버 응답에 없으면 기업 분석은 "꺼짐·0"으로 읽는다
      companyAnalysisEnabled: false,
      companyRemaining: 0,
```

새 테스트:

```ts
  it("reads the company analysis pool when the server provides it", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        premiumEnabled: true,
        freeRemaining: 0,
        premiumRemaining: 2,
        remaining: 2,
        groblePaymentUrl: null,
        companyAnalysisEnabled: true,
        companyRemaining: 1,
      });

    await expect(fetchEntitlementSummary("access-token", fetcher)).resolves.toMatchObject({
      companyAnalysisEnabled: true,
      companyRemaining: 1,
    });
  });

  it("rejects a malformed company credit count instead of inventing a balance", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        premiumEnabled: false,
        freeRemaining: 1,
        premiumRemaining: 0,
        remaining: 1,
        groblePaymentUrl: null,
        companyRemaining: "1",
      });

    await expect(fetchEntitlementSummary("access-token", fetcher)).rejects.toBeInstanceOf(
      EntitlementApiError
    );
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run client/src/lib/entitlements.test.ts`
Expected: FAIL — 기대 객체에 새 키가 있지만 파서가 돌려주지 않음.

- [ ] **Step 3: 구현**

`client/src/lib/entitlements.ts`의 타입에 추가:

```ts
export type EntitlementSummary = {
  premiumEnabled: boolean;
  freeRemaining: number;
  premiumRemaining: number;
  remaining: number;
  groblePaymentUrl: string | null;
  grobleSinglePaymentUrl: string | null;
  feedbackRewardClaimed: boolean;
  /** 기업 분석 리포트 판매·생성 스위치. 구버전 서버 응답에 없으면 false. */
  companyAnalysisEnabled: boolean;
  /** 기업 분석 리포트 잔여 크레딧(자소서 remaining 과 별도 풀). 구버전 응답에 없으면 0. */
  companyRemaining: number;
};
```

`parseEntitlementSummary`의 반환 객체 끝에:

```ts
    companyAnalysisEnabled: payload.companyAnalysisEnabled === true,
    // 구버전 서버 응답에는 없다. 있으면 다른 잔여 수와 같은 엄격함으로 읽는다.
    companyRemaining:
      payload.companyRemaining === undefined
        ? 0
        : readNonNegativeInteger(payload.companyRemaining, "companyRemaining"),
```

- [ ] **Step 4: 통과 + 타입 체크**

Run: `pnpm exec vitest run client/src/lib/entitlements.test.ts && pnpm check`
Expected: PASS, `tsc` 오류 0. (`EntitlementSummary`를 만드는 다른 테스트 픽스처가 있으면 두 필드를 추가해 타입 오류를 없앤다.)

- [ ] **Step 5: 커밋(승인 시)**

```bash
git add client/src/lib/entitlements.ts client/src/lib/entitlements.test.ts
git commit -m "feat(client): read the company analysis credit pool from the entitlement summary"
```

---

## PR2 — 생성 백엔드

### Task 6: 기업 리포트 프롬프트 단일 정의

**Files:**
- Create: `shared/prompts/companyReportPrompt.js`
- Create: `shared/prompts/companyReportPrompt.d.ts`
- Test: `client/src/pages/companyReportPrompt.singleSource.test.ts`

**Interfaces:**
- Produces: `export const COMPANY_REPORT_SYSTEM_PROMPT: string`. 프롬프트 안에 마커 `# [출력: JSON만, 마크다운 코드 블록 없이]`와 `# [제약 조건]`이 있고 그 사이가 유효한 JSON 예시다. 최상위 키: `brief, businessMap, focusBusinesses, financialSnapshot, currentIssues, roleInContext, opportunitiesAndRisks, businessCandidates, interviewPrep`. (`sources`·`reportMeta`는 서버가 붙인다.)

- [ ] **Step 1: 실패하는 테스트**

`client/src/pages/companyReportPrompt.singleSource.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPANY_REPORT_SYSTEM_PROMPT } from "../../../shared/prompts/companyReportPrompt.js";

const apiAnalyze = readFileSync(new URL("../../../api/analyze.js", import.meta.url), "utf8");
const companyAnalysis = readFileSync(new URL("../../../lib/company-analysis.js", import.meta.url), "utf8");
const outputMarker = "# [출력: JSON만, 마크다운 코드 블록 없이]";
const constraintsMarker = "# [제약 조건]";

function extractOutputJsonExample(prompt: string) {
  const outputStart = prompt.indexOf(outputMarker);
  const jsonStart = prompt.indexOf("{", outputStart + outputMarker.length);
  const jsonEnd = prompt.indexOf(constraintsMarker, jsonStart);
  if (outputStart === -1 || jsonStart === -1 || jsonEnd === -1) {
    throw new Error("COMPANY_REPORT_SYSTEM_PROMPT output JSON example is missing");
  }
  return prompt.slice(jsonStart, jsonEnd).trim();
}

describe("company report prompt single source", () => {
  it("keeps the prompt body out of the handler and the analysis module", () => {
    expect(apiAnalyze).not.toContain("const COMPANY_REPORT_SYSTEM_PROMPT = `");
    expect(companyAnalysis).toContain("../shared/prompts/companyReportPrompt.js");
    expect(companyAnalysis).not.toContain("const COMPANY_REPORT_SYSTEM_PROMPT = `");
  });

  it("keeps the runtime JSON example valid with the eight report sections", () => {
    const parsed = JSON.parse(extractOutputJsonExample(COMPANY_REPORT_SYSTEM_PROMPT));
    expect(Object.keys(parsed)).toEqual([
      "brief",
      "businessMap",
      "focusBusinesses",
      "financialSnapshot",
      "currentIssues",
      "roleInContext",
      "opportunitiesAndRisks",
      "businessCandidates",
      "interviewPrep",
    ]);
    expect(parsed.financialSnapshot.keyFigures).toHaveLength(1);
    expect(parsed.roleInContext.recentNewsForRole).toHaveLength(1);
  });

  it("keeps the rules the report design depends on", () => {
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("회사명을 가렸을 때");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("sourceIds");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("12개월");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("24개월");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("매수");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("최대 4개");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("CONTEXT_IRRELEVANT");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).not.toContain("점수");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run client/src/pages/companyReportPrompt.singleSource.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 프롬프트 작성**

`shared/prompts/companyReportPrompt.d.ts`:

```ts
export const COMPANY_REPORT_SYSTEM_PROMPT: string;
```

`shared/prompts/companyReportPrompt.js`:

```js
// =============================================================================
// 기업 분석 리포트 마스터 프롬프트 — 단일 정의
// lib/company-analysis.js 가 이 모듈만 import 한다. 자소서 리포트(reportPrompt.js)와
// 톤·유일성·강조·언어 규칙을 공유하되, 출처·최신성·재무 규칙이 추가된다.
// =============================================================================

export const COMPANY_REPORT_SYSTEM_PROMPT = `
# [역할]
당신은 국내 대기업·유니콘 스타트업에서 10년간 서류 심사와 면접을 진행해온 시니어 채용 전문가이자, 지원자에게 회사를 설명해 주는 산업 담당 선배입니다.
지원자가 고른 회사와 직무를, 자소서를 쓰기 전과 면접을 앞둔 시점에 꼭 알아야 할 것만 골라 해석한 브리프를 씁니다.
검색 도구로 확인한 공개 자료(공홈, 공시, IR, 뉴스, 채용공고)만 근거로 쓰고, 확인하지 못한 것은 확인하지 못했다고 씁니다.

# [핵심 원칙]
1. 자료 모음집이 아니라 해석이다. 사실을 옮기는 데서 멈추지 말고, 그 사실이 이 회사에 왜 중요하고 이 직무 지원자에게 무슨 뜻인지까지 쓴다.
2. 회사 유일성 테스트: 회사명을 가렸을 때 어느 회사인지 짐작할 수 없는 문장은 실패한 출력이다. 각 섹션에 이 회사의 사업·제품·시장 소재가 드러나야 한다.
3. 직무 필터: 같은 회사라도 지원 직무에 따라 골라 보여줄 사업·소식이 다르다. focusBusinesses.items 의 relevanceToRole, roleInContext.recentNewsForRole 의 whyForRole 로 직무와의 연결을 반드시 적는다.
4. 퍼센트 평가, 등급, 순위 매기기를 하지 않는다. 회사를 평가하는 리포트가 아니라 지원자가 회사를 이해하는 리포트다.
5. 범용 인재상 단어("도전정신", "주인의식", "글로벌 마인드", "협업", "소통")를 그대로 쓰지 않는다. 이 회사의 사업 언어로 번역해서 쓴다.
6. 지어내지 않는다. 확인할 수 없는 내부 수치, 실재 여부가 불확실한 프로그램명·조직명·인물명을 만들지 않는다.

# [출처 규칙]
- 숫자, 날짜, 금액, 프로그램명, 조직명, 인물 발언은 검색으로 확인한 출처가 있을 때만 쓴다. 해당 항목의 sourceIds 에 그 출처 번호를 넣는다.
- 출처 번호는 조사 과정에서 참고한 자료에 1부터 순서대로 붙인 정수다. 같은 자료는 같은 번호를 쓴다.
- 출처가 없는 사실은 "알려진 바로는"으로 확실성을 낮추고 수치를 뺀다. sourceIds 는 빈 배열로 둔다.
- 회사 정보가 빈약한 경우(비상장·소규모·외국계 지사 등) 산업·직무 수준의 해석으로 내려가되 문장은 여전히 구체적으로 쓴다. 이때 brief.positionInIndustry 마지막 문장에 "공개 자료가 적어 산업 수준으로 해석했습니다"를 넣는다.

# [최신성 규칙]
- currentIssues 와 roleInContext.recentNewsForRole 은 기준일로부터 12개월 이내의 사건만 담는다.
- focusBusinesses.items 는 24개월 이내에 시작·확대·발표된 사업만 담는다.
- 그보다 오래된 사건은 businessMap 의 맥락 문장으로만 쓴다.
- when 은 "YYYY-MM" 형식으로 쓴다. 월을 확인할 수 없으면 "YYYY" 만 쓴다.

# [재무·주식 규칙]
- financialSnapshot.keyFigures 는 최대 4개다. 각 항목에 회계 기간(period)과 sourceIds 를 반드시 붙인다.
- revenueTrend 와 profitTrend 는 방향(성장/정체/감소/흑자전환/적자전환)과 그 이유를 말로 쓴다. 수치는 출처가 있을 때만 문장 안에 넣는다.
- marketView 는 상장사에만 쓴다. 기준일 무렵의 주가·시가총액 흐름과 시장이 주목하는 포인트를 사실로만 서술한다. 전망, 목표주가, 매수·매도·보유 판단, "저평가"·"고평가" 같은 투자 판단 표현은 금지한다.
- 비상장사는 listed 를 false, market 을 null 로 두고 marketView 와 recentDisclosures 를 비운다. 대신 fundingNote 에 투자 유치·기업가치·주요 투자자를 출처와 함께 쓴다.
- forApplicant 에는 숫자가 지원자에게 뜻하는 것(채용 규모, 조직 확장·긴축 신호, 신사업 투자 여력)을 1~2문장으로 쓴다.

# [관점 규칙]
- opportunitiesAndRisks 와 businessCandidates 는 애널리스트가 아니라 지원자의 시선이다. 면접장에서 지원자가 입 밖에 낼 수 있는 수위로 쓴다.
- risks 는 회사를 깎아내리지 않고, "이 회사가 지금 풀어야 하는 숙제"로 쓴다. 각 항목이 면접 질문 "우리 회사의 문제가 뭐라고 생각하나요"의 답 재료가 되어야 한다.
- businessCandidates 는 이 직무에서 자소서 소재로 쓸 만한 사업·프로젝트 2~3개다. 왜 이 직무에서 강한 소재인지, 어떤 각도로 쓸지, 어떤 경험을 연결하면 좋을지를 쓴다. seedSentence 는 완성 문장이 아니라 방향 제시다.
- statedDirection 은 홈페이지 문구를 옮기는 것이 아니라, 그 문구가 실제 투자·조직·인사 움직임으로 어떻게 드러나는지 해석한다.

# [핵심 문장 강조 규칙]
- 본문 텍스트에는 단어 하나하나를 강조하지 말고, 진짜 중요한 문장만 **문장 전체를 굵게 표시**한다.
- brief 의 모든 필드, keyFigures 의 value, 모든 headline·title·name 에는 강조 표시를 쓰지 않는다. 순수 텍스트만 출력한다.
- 강조 문장은 섹션마다 전체 문장의 약 10~20%만 사용한다. 한 문단에는 0~1문장만 강조한다.
- 회사명, 산업명, 직무명, 숫자만 따로 잘라 강조하지 않는다. 필요하면 그 단어가 포함된 핵심 문장 전체를 강조한다.
- HTML 태그, span, class, style 을 어떤 문자열 필드에도 넣지 않는다.

# 🔒 출력 언어 규칙 (필수 준수)
모든 출력은 자연스럽고 실무적인 한국어로 작성한다.
1. 영어 단어 사용 금지 (불가피한 기술 용어·고유명사 제외)
2. 모든 제목·헤드라인·요약 문장은 100% 한국어
3. 어색한 번역투 금지 (예: "~을 향상시키다", "~을 최적화하다" 지양)
4. 실제 한국 기업 채용 담당자와 현직자가 쓰는 현실적인 표현 사용
5. 반드시 JSON만 출력한다. 설명, 서문, 코드블록 절대 금지
6. 따옴표는 반드시 쌍따옴표(")만 사용
7. 줄바꿈은 \\n 으로 표현
8. 이모지 사용 금지

# [출력: JSON만, 마크다운 코드 블록 없이]

{
  "brief": {
    "oneLiner": "회사를 한 문장으로. 회사명을 가려도 어느 회사인지 알 수 있어야 한다. 공백 포함 28자 이내",
    "keywords": ["사업·시장·고객 소재 키워드 4~6개, 범용 인재상 단어 금지"],
    "asOf": "리포트 기준일. 서버가 덮어쓴다",
    "positionInIndustry": "업계 안에서의 위치와 경쟁 구도 1~2문장"
  },
  "businessMap": {
    "summary": "돈 버는 구조 요약 2~3문장",
    "segments": [
      {
        "name": "사업부문 이름",
        "whatItDoes": "무엇을 만들어 누구에게 파는지 1~2문장",
        "weight": "규모 감각을 말로(예: 매출의 절반 이상). 숫자는 출처가 있을 때만",
        "phase": "성장 | 성숙 | 전환 | 축소 중 하나",
        "sourceIds": [1]
      }
    ],
    "customersAndCompetitors": "핵심 고객과 경쟁사 1~2문장"
  },
  "focusBusinesses": {
    "statedDirection": "비전·핵심가치·CEO 메시지가 말하는 방향 1~2문장",
    "items": [
      {
        "name": "최근 밀고 있는 사업 또는 신사업",
        "whatChanged": "최근 1~2년 무엇을 새로 시작하거나 확대했나",
        "evidence": "투자 규모·조직 신설·인수·발표 등 실제 움직임",
        "whyNow": "왜 지금 이 사업인가(산업 맥락)",
        "relevanceToRole": "직접 | 간접 | 무관 중 하나와 그 이유 한 문장",
        "sourceIds": [2]
      }
    ],
    "translatedTalentKeywords": [
      { "stated": "회사가 쓰는 인재상 문구", "meaning": "이 회사 사업 언어로 번역한 실제 뜻" }
    ]
  },
  "financialSnapshot": {
    "listed": true,
    "market": "상장 시장과 종목명(예: 유가증권시장 · 현대차). 비상장이면 null",
    "revenueTrend": "최근 2~3년 매출 방향과 이유. 수치는 출처가 있을 때만",
    "profitTrend": "영업이익 방향과 이유. 부문별 편차가 있으면 언급",
    "keyFigures": [
      { "label": "매출 | 영업이익 | 영업이익률 등", "value": "출처에서 확인한 값", "period": "회계 기간(예: 2025년 연간)", "sourceIds": [3] }
    ],
    "marketView": "상장사만. 기준일 무렵 주가·시가총액 흐름과 시장이 주목하는 포인트 1~2문장. 사실 서술만",
    "recentDisclosures": [
      { "title": "최근 주요 공시·IR 발표 제목", "when": "YYYY-MM", "sourceIds": [4] }
    ],
    "fundingNote": "비상장사만. 투자 유치·기업가치·주요 투자자 1~2문장. 상장사면 빈 문자열",
    "forApplicant": "이 숫자들이 지원자에게 뜻하는 것 1~2문장"
  },
  "currentIssues": [
    {
      "title": "이슈 제목(공백 포함 24자 이내)",
      "when": "YYYY-MM",
      "fact": "확인된 사실 1~2문장",
      "whyItMatters": "회사에 왜 중요한가 1~2문장",
      "forApplicant": "지원자에게 무슨 의미인가 1문장",
      "sourceIds": [5]
    }
  ],
  "roleInContext": {
    "whereItSits": "직무가 붙는 사업부문·조직 1~2문장",
    "problemsItSolves": ["이 직무가 지금 푸는 문제 3~4개"],
    "whyHiringNow": "지금 이 직무를 뽑는 이유. 가설임을 문장 안에 명시",
    "recentNewsForRole": [
      {
        "title": "이 직무와 직접 연결된 최신 소식",
        "when": "YYYY-MM",
        "fact": "확인된 사실 1문장",
        "whyForRole": "이 직무 지원자가 알아야 하는 이유와 자소서·면접에서 쓸 지점",
        "sourceIds": [6]
      }
    ],
    "postingReading": "채용공고가 주어졌을 때만. 수행직무 문장을 사업 맥락으로 해석 2~3문장. 없으면 빈 문자열"
  },
  "opportunitiesAndRisks": {
    "opportunities": [
      { "headline": "공백 포함 20자 이내", "text": "2~3문장. 핵심 결론 한 문장은 **문장 전체를 굵게**", "sourceIds": [] }
    ],
    "risks": [
      { "headline": "공백 포함 20자 이내", "text": "2~3문장, 면접에서 말해도 되는 수위. 핵심 결론 한 문장은 **문장 전체를 굵게**", "sourceIds": [] }
    ]
  },
  "businessCandidates": [
    {
      "name": "맡고 싶은 사업 또는 프로젝트",
      "whyForThisRole": "이 직무에서 이 사업이 자소서 소재로 강한 이유 1~2문장",
      "angle": "자소서에서 잡을 각도 1~2문장",
      "experienceToPrepare": "연결하면 좋은 경험 유형 1문장",
      "seedSentence": "완성 문장이 아닌 방향 제시 1문장"
    }
  ],
  "interviewPrep": {
    "questions": [
      { "question": "회사·산업 관련 예상 질문", "direction": "답변 방향 2~3문장" }
    ],
    "primarySources": [
      { "label": "사업보고서 | IR 자료 | 지속가능경영보고서 | 채용 페이지 등", "url": "확인한 주소" }
    ]
  }
}

# [제약 조건]
- businessMap.segments 는 2~5개. focusBusinesses.items 는 2~4개. currentIssues 는 3~5개. roleInContext.recentNewsForRole 은 2~4개(직무와 직접 연결된 소식이 정말 없으면 1개, 빈 배열 금지).
- opportunities 와 risks 는 각각 정확히 3개. businessCandidates 는 2~3개. interviewPrep.questions 는 5~7개. primarySources 는 2~4개.
- financialSnapshot.keyFigures 는 최대 4개. 출처 없는 수치는 넣지 않는다.
- brief.keywords 에는 회사 이름 자체를 넣지 않는다.
- 모든 sourceIds 는 정수 배열이다. 조사에서 참고한 출처가 없으면 빈 배열.
- 채용공고가 주어지지 않았으면 postingReading 은 빈 문자열이다. 채용공고를 지어내지 않는다.
- 자소서 리포트가 아니다. 지원자의 개인 경험을 추측해서 쓰지 않는다.

# [문맥 이탈 방지]
회사명이 실재하는 기업이나 조직으로 식별되지 않거나, 입력이 장난·무의미한 문자열인 경우 분석을 진행하지 말고 다음 JSON만 반환하라:
{"error": "CONTEXT_IRRELEVANT", "message": "확인할 수 있는 기업이 아닙니다."}
이 경우 위의 리포트 JSON 스키마를 사용하지 않는다.
`;
```

- [ ] **Step 4: `lib/company-analysis.js` 빈 모듈을 먼저 만든다(Task 7에서 채움)**

테스트가 `lib/company-analysis.js`를 읽으므로 최소 파일을 둔다:

```js
import { COMPANY_REPORT_SYSTEM_PROMPT } from "../shared/prompts/companyReportPrompt.js";

export { COMPANY_REPORT_SYSTEM_PROMPT };
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm exec vitest run client/src/pages/companyReportPrompt.singleSource.test.ts client/src/pages/reportPrompt.singleSource.test.ts`
Expected: PASS (기존 자소서 프롬프트 테스트도 영향 없음).

- [ ] **Step 6: 커밋(승인 시)**

```bash
git add shared/prompts/companyReportPrompt.js shared/prompts/companyReportPrompt.d.ts lib/company-analysis.js client/src/pages/companyReportPrompt.singleSource.test.ts
git commit -m "feat(prompt): add the company report master prompt as a single source"
```

---

### Task 7: `lib/company-analysis.js` — 요청 정규화·해시·제목·처리량·파서·출처

**Files:**
- Modify: `lib/company-analysis.js`
- Modify: `lib/rate-limit.js`
- Test: `lib/company-analysis.test.js`

**Interfaces:**
- Produces:
  - `normalizeCompanyRequest(body)` → `{ company, jobKeyword, postingText, resumeAnalysisId }` (`postingText`는 `""` 가능, `resumeAnalysisId`는 `null` 가능). 실패 시 `ApiError("INVALID_REQUEST", 400)`.
  - `companyRequestHash(request)` → sha256 hex (kind `"COMPANY"` 포함).
  - `buildCompanyProjectTitle(company, jobKeyword)` → `"{회사} {직무} 기업 분석"`.
  - `companyAnalysisInput()` → `{ questionText: "", inputText: "", totalChars: null }`.
  - `parseModelJsonTolerant(rawText)` → object | throws `AnalysisModelFailureError("PARSE_ERROR")`.
  - `joinCandidateText(data)` → 모든 `parts[].text` 결합 문자열.
  - `extractGroundingSources(data)` → `Array<{ id, title, url, publisher }>` (중복 URL 제거, 최대 12).
  - `extractGroundingMeta(data)` → `{ searchQueries: string[], searchEntryPointHtml: string | null }`.
  - `lib/rate-limit.js`: `COMPANY_ANALYSIS_THROUGHPUT`, `getCompanyAnalysisThroughputPolicy()`.

- [ ] **Step 1: 실패하는 테스트**

`lib/company-analysis.test.js`:

```js
import { describe, expect, it } from "vitest";

import {
  buildCompanyProjectTitle,
  companyAnalysisInput,
  companyRequestHash,
  extractGroundingMeta,
  extractGroundingSources,
  joinCandidateText,
  normalizeCompanyRequest,
  parseModelJsonTolerant,
} from "./company-analysis.js";
import { COMPANY_ANALYSIS_THROUGHPUT, getCompanyAnalysisThroughputPolicy } from "./rate-limit.js";

const RESUME_ANALYSIS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("normalizeCompanyRequest", () => {
  it("accepts company and job keyword with optional posting text and résumé link", () => {
    expect(normalizeCompanyRequest({
      company: " 현대자동차 ",
      jobKeyword: "전략기획",
      postingText: "<b>수행직무</b> 시장 모니터링",
      resumeAnalysisId: RESUME_ANALYSIS_ID,
    })).toEqual({
      company: "현대자동차",
      jobKeyword: "전략기획",
      postingText: "수행직무 시장 모니터링",
      resumeAnalysisId: RESUME_ANALYSIS_ID,
    });
  });

  it("defaults optional fields when absent", () => {
    expect(normalizeCompanyRequest({ company: "카카오", jobKeyword: "서비스 기획" })).toEqual({
      company: "카카오",
      jobKeyword: "서비스 기획",
      postingText: "",
      resumeAnalysisId: null,
    });
  });

  it.each([
    [null],
    [{ company: "카카오" }],
    [{ company: "", jobKeyword: "기획" }],
    [{ company: "카카오", jobKeyword: "기획", questions: [] }],
    [{ company: "카".repeat(101), jobKeyword: "기획" }],
    [{ company: "카카오", jobKeyword: "기획", postingText: "가".repeat(4001) }],
    [{ company: "카카오", jobKeyword: "기획", resumeAnalysisId: "not-a-uuid" }],
  ])("rejects %j with INVALID_REQUEST", (body) => {
    expect(() => normalizeCompanyRequest(body)).toThrow(expect.objectContaining({
      code: "INVALID_REQUEST",
      statusCode: 400,
    }));
  });
});

describe("request hash, title, and stored input", () => {
  it("hashes the company request with a kind marker so it never collides with a résumé request", () => {
    const request = normalizeCompanyRequest({ company: "카카오", jobKeyword: "기획" });
    const hash = companyRequestHash(request);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(companyRequestHash({ ...request, jobKeyword: "마케팅" }));
  });

  it("builds the project title and the empty analysis input", () => {
    expect(buildCompanyProjectTitle("카카오", "기획")).toBe("카카오 기획 기업 분석");
    expect(companyAnalysisInput()).toEqual({ questionText: "", inputText: "", totalChars: null });
  });
});

describe("throughput policy", () => {
  it("uses a company-specific rate limit route and concurrency of 2", () => {
    expect(getCompanyAnalysisThroughputPolicy()).toBe(COMPANY_ANALYSIS_THROUGHPUT);
    expect(COMPANY_ANALYSIS_THROUGHPUT).toEqual({
      concurrencyLimit: 2,
      rateLimit: { route: "company-analysis", limit: 5, windowMs: 15 * 60 * 1000 },
    });
  });
});

describe("model output parsing", () => {
  it("joins every text part of the first candidate", () => {
    expect(joinCandidateText({
      candidates: [{ content: { parts: [{ text: "{\"a\":" }, { text: "1}" }, { inlineData: {} }] } }],
    })).toBe('{"a":1}');
  });

  it("parses JSON wrapped in fences or surrounded by prose", () => {
    expect(parseModelJsonTolerant('```json\n{"brief":{"oneLiner":"x"}}\n```')).toEqual({ brief: { oneLiner: "x" } });
    expect(parseModelJsonTolerant('검색 결과를 정리했습니다.\n{"brief":{"oneLiner":"x"}}\n끝.')).toEqual({ brief: { oneLiner: "x" } });
  });

  it("throws PARSE_ERROR when no JSON object can be recovered", () => {
    expect(() => parseModelJsonTolerant("no json here")).toThrow(expect.objectContaining({ code: "PARSE_ERROR" }));
    expect(() => parseModelJsonTolerant('{"broken":')).toThrow(expect.objectContaining({ code: "PARSE_ERROR" }));
  });
});

describe("grounding metadata", () => {
  const data = {
    candidates: [{
      groundingMetadata: {
        webSearchQueries: ["현대자동차 2026 실적", "현대자동차 전략기획"],
        searchEntryPoint: { renderedContent: "<div>chips</div>" },
        groundingChunks: [
          { web: { uri: "https://redirect/1", title: "hyundai.com" } },
          { web: { uri: "https://redirect/2", title: "dart.fss.or.kr" } },
          { web: { uri: "https://redirect/1", title: "hyundai.com" } },
          { retrievedContext: { uri: "ignored" } },
        ],
      },
    }],
  };

  it("numbers unique web sources from 1 and drops non-web chunks", () => {
    expect(extractGroundingSources(data)).toEqual([
      { id: 1, title: "hyundai.com", url: "https://redirect/1", publisher: "hyundai.com" },
      { id: 2, title: "dart.fss.or.kr", url: "https://redirect/2", publisher: "dart.fss.or.kr" },
    ]);
  });

  it("caps sources at 12", () => {
    const many = {
      candidates: [{
        groundingMetadata: {
          groundingChunks: Array.from({ length: 20 }, (_, index) => ({
            web: { uri: `https://redirect/${index}`, title: `site-${index}` },
          })),
        },
      }],
    };
    expect(extractGroundingSources(many)).toHaveLength(12);
  });

  it("reads search queries and the search entry point, tolerating their absence", () => {
    expect(extractGroundingMeta(data)).toEqual({
      searchQueries: ["현대자동차 2026 실적", "현대자동차 전략기획"],
      searchEntryPointHtml: "<div>chips</div>",
    });
    expect(extractGroundingMeta({ candidates: [{}] })).toEqual({ searchQueries: [], searchEntryPointHtml: null });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run lib/company-analysis.test.js`
Expected: FAIL — export 없음.

- [ ] **Step 3: `lib/rate-limit.js`에 정책 추가**

`ANALYSIS_THROUGHPUT` 아래에:

```js
// 기업 분석 리포트는 무료 티어가 없고 검색 그라운딩으로 호출이 길다.
// 동시 2건으로 함수 부하를 막고, 15분 5회로 비용을 통제한다.
export const COMPANY_ANALYSIS_THROUGHPUT = Object.freeze({
  concurrencyLimit: 2,
  rateLimit: Object.freeze({
    route: "company-analysis",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  }),
});

export function getCompanyAnalysisThroughputPolicy() {
  return COMPANY_ANALYSIS_THROUGHPUT;
}
```

- [ ] **Step 4: 순수 함수 구현**

`lib/company-analysis.js`를 다음으로 교체(모델 호출은 Task 8에서 추가):

```js
import { createHash } from "node:crypto";

import { AnalysisModelFailureError } from "./analysis-request-lifecycle.js";
import { ApiError } from "./api-handler.js";
import { COMPANY_REPORT_SYSTEM_PROMPT } from "../shared/prompts/companyReportPrompt.js";

export { COMPANY_REPORT_SYSTEM_PROMPT };

const MAX_NAME_CHARS = 100;
const MAX_POSTING_CHARS = 4000;
const MAX_SOURCES = 12;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// api/analyze.js 의 sanitizeInput 과 같은 규칙. 채용공고 붙여넣기에 태그·스크립트가 섞여 온다.
function sanitizeInput(value) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<\/?(?:iframe|object|embed|form|input|button|link|meta)\b[^>]*>/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:[^,]*,/gi, "")
    .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "")
    .trim();
}

/**
 * POST /api/analyze/company 본문. company·jobKeyword 필수, postingText(≤4000자)·
 * resumeAnalysisId(uuid) 선택. 허용 키 밖의 필드(예: questions)는 자소서 요청이 잘못
 * 들어온 것이므로 거부한다.
 */
export function normalizeCompanyRequest(body) {
  if (!isRecord(body)) throw new ApiError("INVALID_REQUEST", 400);

  const allowedKeys = new Set(["company", "jobKeyword", "postingText", "resumeAnalysisId"]);
  if (!Object.keys(body).every((key) => allowedKeys.has(key))) {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (typeof body.company !== "string" || typeof body.jobKeyword !== "string") {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (body.company.length > MAX_NAME_CHARS || body.jobKeyword.length > MAX_NAME_CHARS) {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (body.postingText !== undefined && (typeof body.postingText !== "string" || body.postingText.length > MAX_POSTING_CHARS)) {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (body.resumeAnalysisId !== undefined && body.resumeAnalysisId !== null
    && (typeof body.resumeAnalysisId !== "string" || !UUID_PATTERN.test(body.resumeAnalysisId))) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  const company = sanitizeInput(body.company);
  const jobKeyword = sanitizeInput(body.jobKeyword);
  if (company.length === 0 || jobKeyword.length === 0) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  return {
    company,
    jobKeyword,
    postingText: sanitizeInput(body.postingText),
    resumeAnalysisId: body.resumeAnalysisId ?? null,
  };
}

/** kind 를 섞어 같은 회사·직무의 자소서 요청 해시와 절대 겹치지 않게 한다. */
export function companyRequestHash(request) {
  return createHash("sha256")
    .update(JSON.stringify({
      kind: "COMPANY",
      company: request.company,
      jobKeyword: request.jobKeyword,
      postingText: request.postingText,
      resumeAnalysisId: request.resumeAnalysisId,
    }))
    .digest("hex");
}

export function buildCompanyProjectTitle(company, jobKeyword) {
  return `${company} ${jobKeyword} 기업 분석`;
}

/** Analysis 행의 자소서 전용 컬럼. NOT NULL 이라 빈 문자열, 글자 수는 없음. */
export function companyAnalysisInput() {
  return { questionText: "", inputText: "", totalChars: null };
}

/** grounded 응답은 parts 가 여러 개로 나뉘어 온다. 텍스트 파트를 모두 이어 붙인다. */
export function joinCandidateText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
}

/** 코드펜스·앞뒤 설명을 벗겨 첫 '{' 부터 마지막 '}' 까지를 JSON 으로 읽는다. */
export function parseModelJsonTolerant(rawText) {
  const text = String(rawText ?? "").replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AnalysisModelFailureError("PARSE_ERROR");
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AnalysisModelFailureError("PARSE_ERROR");
  }
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * groundingMetadata.groundingChunks[].web 을 1부터 번호 매긴 출처 목록으로 바꾼다.
 * uri 는 Google 리다이렉트 주소, title 은 보통 도메인명이다. 화면은 title 을 보이고 url 로 링크한다.
 */
export function extractGroundingSources(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];

  const seen = new Set();
  const sources = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (typeof uri !== "string" || uri.length === 0 || seen.has(uri)) continue;
    seen.add(uri);
    const title = typeof chunk.web.title === "string" && chunk.web.title.length > 0 ? chunk.web.title : hostnameOf(uri);
    sources.push({ id: sources.length + 1, title, url: uri, publisher: title });
    if (sources.length >= MAX_SOURCES) break;
  }
  return sources;
}

/** 검색어와 Google 검색 제안 칩(표시 의무). 없으면 빈 값. */
export function extractGroundingMeta(data) {
  const meta = data?.candidates?.[0]?.groundingMetadata;
  const searchQueries = Array.isArray(meta?.webSearchQueries)
    ? meta.webSearchQueries.filter((query) => typeof query === "string")
    : [];
  const rendered = meta?.searchEntryPoint?.renderedContent;
  return {
    searchQueries,
    searchEntryPointHtml: typeof rendered === "string" && rendered.length > 0 ? rendered : null,
  };
}
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm exec vitest run lib/company-analysis.test.js client/src/pages/companyReportPrompt.singleSource.test.ts`
Expected: PASS.

- [ ] **Step 6: 커밋(승인 시)**

```bash
git add lib/company-analysis.js lib/company-analysis.test.js lib/rate-limit.js
git commit -m "feat(company-analysis): add request normalization, grounding parsers, and throughput policy"
```

---

### Task 8: `analyzeCompany` — 그라운딩 호출 + 관대한 파서 + 복구 호출

**Files:**
- Modify: `lib/company-analysis.js`
- Test: `lib/company-analysis.test.js`

**Interfaces:**
- Consumes: Task 7의 파서·출처 함수, `readAiModelSettings`/`getActiveGeminiModel`(`lib/ai-model-settings.js`), `AnalysisModelFailureError`.
- Produces: `analyzeCompany(request, db, { fetcher = globalThis.fetch, now = Date.now, apiKey = process.env.GEMINI_API_KEY, asOf } = {})` → `{ ...report, sources, reportMeta, analysisMeta }`. `report.brief.asOf`는 서버가 덮어쓴다. 상수 `COMPANY_RESEARCH_MODEL = "gemini-2.5-flash"`, `COMPANY_TOTAL_DEADLINE_MS = 95000`, `COMPANY_RESEARCH_TIMEOUT_MS = 65000`, `COMPANY_REPAIR_MIN_MS = 20000`. `buildCompanyUserPrompt(request, asOf)` export.
- 실패 의미: HTTP 비정상 → `error.statusCode` 달린 Error(lifecycle이 `API_ERROR`로 분류), 타임아웃 → `AbortError`, 파싱 불가 → `PARSE_ERROR`, 모델이 `{error:"CONTEXT_IRRELEVANT"}` → 그대로 반환(lifecycle이 처리).

- [ ] **Step 1: 실패하는 테스트**

`lib/company-analysis.test.js` 상단 import에 `analyzeCompany, buildCompanyUserPrompt, COMPANY_RESEARCH_MODEL`을 추가하고 파일 끝에:

```js
const REPORT = {
  brief: { oneLiner: "전동화로 체급을 바꾸는 완성차", keywords: ["전동화"], asOf: "", positionInIndustry: "국내 1위" },
  businessMap: { summary: "", segments: [], customersAndCompetitors: "" },
  focusBusinesses: { statedDirection: "", items: [], translatedTalentKeywords: [] },
  financialSnapshot: { listed: true, market: "유가증권시장", revenueTrend: "", profitTrend: "", keyFigures: [], marketView: "", recentDisclosures: [], fundingNote: "", forApplicant: "" },
  currentIssues: [],
  roleInContext: { whereItSits: "", problemsItSolves: [], whyHiringNow: "", recentNewsForRole: [], postingReading: "" },
  opportunitiesAndRisks: { opportunities: [], risks: [] },
  businessCandidates: [],
  interviewPrep: { questions: [], primarySources: [] },
};

function geminiResponse({ text, parts, grounding = true, usage = { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 } }) {
  return new Response(JSON.stringify({
    candidates: [{
      content: { parts: parts ?? [{ text }] },
      groundingMetadata: grounding
        ? {
          webSearchQueries: ["현대자동차 전략기획"],
          searchEntryPoint: { renderedContent: "<div>chips</div>" },
          groundingChunks: [{ web: { uri: "https://redirect/1", title: "hyundai.com" } }],
        }
        : undefined,
    }],
    usageMetadata: usage,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function recordingFetcher(responses) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), signal: init.signal });
    const next = responses.shift();
    if (typeof next === "function") return next();
    return next;
  };
  return { calls, fetcher };
}

const request = { company: "현대자동차", jobKeyword: "전략기획", postingText: "", resumeAnalysisId: null };
const db = { aiModelSetting: { findUnique: async () => null } };

describe("buildCompanyUserPrompt", () => {
  it("names the company, role, as-of date, and the five research topics", () => {
    const prompt = buildCompanyUserPrompt({ ...request, postingText: "수행직무: 시장 모니터링" }, "2026-09-06");
    expect(prompt).toContain("[기업]: 현대자동차");
    expect(prompt).toContain("[직무]: 전략기획");
    expect(prompt).toContain("[기준일]: 2026-09-06");
    expect(prompt).toContain("[채용공고]");
    expect(prompt).toContain("수행직무: 시장 모니터링");
    for (const topic of ["사업부문", "주력 사업", "실적", "공시", "직무", "이슈"]) {
      expect(prompt).toContain(topic);
    }
    expect(buildCompanyUserPrompt(request, "2026-09-06")).not.toContain("[채용공고]");
  });
});

describe("analyzeCompany", () => {
  it("returns the grounded report with sources, meta, and usage after one call", async () => {
    const { calls, fetcher } = recordingFetcher([
      geminiResponse({ parts: [{ text: "```json\n" + JSON.stringify(REPORT).slice(0, 40) }, { text: JSON.stringify(REPORT).slice(40) + "\n```" }] }),
    ]);

    const result = await analyzeCompany(request, db, { fetcher, apiKey: "test-key", asOf: "2026-09-06" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(`/models/${COMPANY_RESEARCH_MODEL}:generateContent`);
    expect(calls[0].body.tools).toEqual([{ google_search: {} }]);
    expect(calls[0].body.generationConfig.responseMimeType).toBeUndefined();
    expect(result.brief.asOf).toBe("2026-09-06");
    expect(result.sources).toEqual([{ id: 1, title: "hyundai.com", url: "https://redirect/1", publisher: "hyundai.com" }]);
    expect(result.reportMeta).toEqual({
      kind: "COMPANY",
      schemaVersion: 1,
      asOf: "2026-09-06",
      searchQueries: ["현대자동차 전략기획"],
      searchEntryPointHtml: "<div>chips</div>",
      linkedResumeAnalysisId: null,
      repaired: false,
    });
    expect(result.analysisMeta).toMatchObject({
      modelProvider: "gemini",
      modelName: COMPANY_RESEARCH_MODEL,
      httpStatus: 200,
      tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
  });

  it("repairs unparseable research output with one JSON-mode call and keeps the research sources", async () => {
    const { calls, fetcher } = recordingFetcher([
      geminiResponse({ text: "조사 메모: 전동화 투자 확대, 매출 성장..." }),
      geminiResponse({ text: JSON.stringify(REPORT), grounding: false, usage: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } }),
    ]);

    const result = await analyzeCompany(request, db, { fetcher, apiKey: "test-key", asOf: "2026-09-06" });

    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain("/models/gemini-2.5-flash-lite:generateContent");
    expect(calls[1].body.tools).toBeUndefined();
    expect(calls[1].body.generationConfig.responseMimeType).toBe("application/json");
    expect(calls[1].body.contents[0].parts[0].text).toContain("조사 메모: 전동화 투자 확대");
    expect(result.sources).toHaveLength(1);
    expect(result.reportMeta.repaired).toBe(true);
    expect(result.analysisMeta.tokenUsage).toEqual({ promptTokens: 110, completionTokens: 55, totalTokens: 165 });
  });

  it("fails with PARSE_ERROR when the repair call also returns no JSON", async () => {
    const { fetcher } = recordingFetcher([
      geminiResponse({ text: "메모만" }),
      geminiResponse({ text: "여전히 메모", grounding: false }),
    ]);

    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key" })).rejects.toMatchObject({ code: "PARSE_ERROR" });
  });

  it("skips the repair call when less than the minimum budget remains", async () => {
    let clock = 0;
    const now = () => clock;
    const { calls, fetcher } = recordingFetcher([
      () => { clock += 80_000; return geminiResponse({ text: "메모만" }); },
      geminiResponse({ text: JSON.stringify(REPORT), grounding: false }),
    ]);

    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key", now })).rejects.toMatchObject({ code: "PARSE_ERROR" });
    expect(calls).toHaveLength(1);
  });

  it("passes CONTEXT_IRRELEVANT through for the lifecycle to classify", async () => {
    const { fetcher } = recordingFetcher([
      geminiResponse({ text: '{"error":"CONTEXT_IRRELEVANT","message":"확인할 수 있는 기업이 아닙니다."}' }),
    ]);

    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key" })).resolves.toMatchObject({ error: "CONTEXT_IRRELEVANT" });
  });

  it("surfaces provider HTTP failures with their status code", async () => {
    const { fetcher } = recordingFetcher([new Response("overloaded", { status: 503 })]);

    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key" })).rejects.toMatchObject({ statusCode: 503 });
  });

  it("refuses to call the provider without an API key", async () => {
    const { calls, fetcher } = recordingFetcher([]);
    await expect(analyzeCompany(request, db, { fetcher, apiKey: undefined })).rejects.toMatchObject({ code: "API_ERROR" });
    expect(calls).toHaveLength(0);
  });

  it("carries the linked résumé analysis id into reportMeta", async () => {
    const { fetcher } = recordingFetcher([geminiResponse({ text: JSON.stringify(REPORT) })]);
    const result = await analyzeCompany({ ...request, resumeAnalysisId: RESUME_ANALYSIS_ID }, db, { fetcher, apiKey: "test-key" });
    expect(result.reportMeta.linkedResumeAnalysisId).toBe(RESUME_ANALYSIS_ID);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run lib/company-analysis.test.js`
Expected: FAIL — `analyzeCompany` 없음.

- [ ] **Step 3: 구현**

`lib/company-analysis.js` 상단 import에 추가:

```js
import { getActiveGeminiModel, readAiModelSettings } from "./ai-model-settings.js";
```

파일 끝에 추가:

```js
// ── 모델 호출 ───────────────────────────────────────────────────────────────
// 검색 그라운딩은 응답 시간이 길다. 총 데드라인 95s 를 1차(조사, ≤65s)와 2차(복구)가
// 나눠 쓴다. 100s 모델 타임아웃 < 125s TTL < 120s maxDuration 관계(CLAUDE.md 함정 4) 안이다.
export const COMPANY_RESEARCH_MODEL = "gemini-2.5-flash";
export const COMPANY_TOTAL_DEADLINE_MS = 95000;
export const COMPANY_RESEARCH_TIMEOUT_MS = 65000;
export const COMPANY_REPAIR_MIN_MS = 20000;
// 2.5-flash 의 기본 thinking 은 지연·비용을 늘린다. 조사 품질에 필요한 최소만 남긴다.
const RESEARCH_THINKING_BUDGET = 512;

const RESEARCH_TOPICS = [
  "1) 사업부문과 돈 버는 구조(주력 제품·고객·경쟁사)",
  "2) 최근 1~2년 밀고 있는 주력 사업·신사업과 실제 투자·조직 움직임",
  "3) 최근 실적(매출·영업이익 방향), 주요 공시·IR, 상장사면 최근 주가·시가총액 흐름",
  "4) 지원 직무와 직접 연결된 최근 소식(조직 개편, 채용 확대, 관련 프로젝트)",
  "5) 최근 12개월의 핵심 이슈와 그 의미",
];

export function buildCompanyUserPrompt(request, asOf) {
  let prompt = `[기업]: ${request.company}\n[직무]: ${request.jobKeyword}\n[기준일]: ${asOf}\n`;
  if (request.postingText) {
    prompt += `\n[채용공고]\n${request.postingText}\n`;
  }
  prompt += "\n다음 다섯 주제를 검색 도구로 각각 확인한 뒤, 마스터 프롬프트의 JSON 스키마로 리포트를 작성하세요.\n";
  prompt += `${RESEARCH_TOPICS.join("\n")}\n`;
  prompt += "\n각 사실에는 참고한 출처 번호를 sourceIds 로 남기고, 반드시 한국어로 작성하세요. JSON 외에 다른 텍스트는 절대 포함하지 마세요.";
  return prompt;
}

function todayIsoDate(now) {
  return new Date(now()).toISOString().slice(0, 10);
}

async function fetchWithDeadline(fetcher, url, options, { deadlineAt, now, maxMs }) {
  const remaining = deadlineAt - now();
  const budget = Math.min(remaining, maxMs);
  if (budget <= 0) {
    const error = new Error("Company analysis deadline exceeded");
    error.name = "AbortError";
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), budget);
  const startedAt = now();
  try {
    const response = await fetcher(url, { ...options, signal: controller.signal });
    return { response, responseTimeMs: now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

function usageOf(data) {
  const usage = data?.usageMetadata ?? {};
  return {
    promptTokens: Number(usage.promptTokenCount ?? 0),
    completionTokens: Number(usage.candidatesTokenCount ?? 0),
    totalTokens: Number(usage.totalTokenCount ?? 0),
  };
}

function sumUsage(first, second) {
  return {
    promptTokens: first.promptTokens + second.promptTokens,
    completionTokens: first.completionTokens + second.completionTokens,
    totalTokens: first.totalTokens + second.totalTokens,
  };
}

async function callGemini({ apiKey, body, fetcher, modelName, deadline }) {
  const { response, responseTimeMs } = await fetchWithDeadline(
    fetcher,
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    deadline,
  );
  if (!response.ok) {
    const error = new Error("Model request failed");
    error.statusCode = response.status;
    throw error;
  }
  const data = await response.json();
  return { data, responseTimeMs, httpStatus: response.status };
}

/**
 * 1차: 검색 그라운딩 + "JSON만 출력" 지시(2.5 계열은 검색 도구와 responseMimeType 을 함께 못 쓴다).
 * 2차(1차 파싱 실패 시에만): 기본 모델 + JSON 모드로 1차 원문을 스키마에 맞춰 다시 쓴다.
 * 출처는 언제나 1차의 groundingMetadata 에서 온다.
 */
export async function analyzeCompany(request, db, {
  fetcher = globalThis.fetch,
  now = Date.now,
  apiKey = process.env.GEMINI_API_KEY,
  asOf,
} = {}) {
  if (!apiKey) throw new AnalysisModelFailureError("API_ERROR");

  const startedAt = now();
  const deadlineAt = startedAt + COMPANY_TOTAL_DEADLINE_MS;
  const reportDate = asOf ?? todayIsoDate(now);
  const userPrompt = buildCompanyUserPrompt(request, reportDate);

  const research = await callGemini({
    apiKey,
    fetcher,
    modelName: COMPANY_RESEARCH_MODEL,
    deadline: { deadlineAt, now, maxMs: COMPANY_RESEARCH_TIMEOUT_MS },
    body: {
      contents: [{ role: "user", parts: [{ text: `${COMPANY_REPORT_SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.4,
        thinkingConfig: { thinkingBudget: RESEARCH_THINKING_BUDGET },
      },
    },
  });

  const researchText = joinCandidateText(research.data);
  const sources = extractGroundingSources(research.data);
  const grounding = extractGroundingMeta(research.data);
  let usage = usageOf(research.data);
  let modelName = COMPANY_RESEARCH_MODEL;
  let httpStatus = research.httpStatus;
  let parsed;
  let repaired = false;

  try {
    parsed = parseModelJsonTolerant(researchText);
  } catch (parseError) {
    if (deadlineAt - now() < COMPANY_REPAIR_MIN_MS || researchText.trim().length === 0) {
      throw parseError;
    }
    const repairModel = getActiveGeminiModel(await readAiModelSettings(db));
    const repair = await callGemini({
      apiKey,
      fetcher,
      modelName: repairModel,
      deadline: { deadlineAt, now, maxMs: COMPANY_TOTAL_DEADLINE_MS },
      body: {
        contents: [{
          role: "user",
          parts: [{
            text: `${COMPANY_REPORT_SYSTEM_PROMPT}\n\n다음은 검색으로 조사한 메모입니다. 이 메모의 사실만 사용해 마스터 프롬프트의 JSON 스키마로 리포트를 작성하세요. 메모에 없는 사실을 추가하지 마세요.\n\n[기업]: ${request.company}\n[직무]: ${request.jobKeyword}\n[기준일]: ${reportDate}\n\n[조사 메모]\n${researchText}`,
          }],
        }],
        generationConfig: { responseMimeType: "application/json" },
      },
    });
    parsed = parseModelJsonTolerant(joinCandidateText(repair.data));
    usage = sumUsage(usage, usageOf(repair.data));
    modelName = `${COMPANY_RESEARCH_MODEL}+${repairModel}`;
    httpStatus = repair.httpStatus;
    repaired = true;
  }

  if (!isRecord(parsed)) throw new AnalysisModelFailureError("PARSE_ERROR");
  if (parsed.error === "CONTEXT_IRRELEVANT") return parsed;

  const brief = isRecord(parsed.brief) ? { ...parsed.brief, asOf: reportDate } : { asOf: reportDate };
  return {
    ...parsed,
    brief,
    sources,
    reportMeta: {
      kind: "COMPANY",
      schemaVersion: 1,
      asOf: reportDate,
      searchQueries: grounding.searchQueries,
      searchEntryPointHtml: grounding.searchEntryPointHtml,
      linkedResumeAnalysisId: request.resumeAnalysisId ?? null,
      repaired,
    },
    analysisMeta: {
      modelProvider: "gemini",
      modelName,
      responseTimeMs: now() - startedAt,
      httpStatus,
      tokenUsage: usage,
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run lib/company-analysis.test.js`
Expected: PASS. ("skips the repair call" 테스트는 `now` 주입으로 80s를 흘려 잔여 15s < 20s가 되는 경로.)

- [ ] **Step 5: 커밋(승인 시)**

```bash
git add lib/company-analysis.js lib/company-analysis.test.js
git commit -m "feat(company-analysis): call Gemini with search grounding and a JSON repair fallback"
```

---

### Task 9: `api/analyze.js` — kind 주입 일반화와 `?kind=company` 디스패치

**Files:**
- Modify: `api/analyze.js`
- Modify: `api/analyze.d.ts`
- Test: `tests/api/analyze-company.test.js` (신규)

**Interfaces:**
- Consumes: Task 7·8의 `normalizeCompanyRequest`, `companyRequestHash`, `buildCompanyProjectTitle`, `companyAnalysisInput`, `analyzeCompany`; `getCompanyAnalysisThroughputPolicy`; Task 2의 `reserveAnalysis(tx, userId, kind)`.
- Produces:
  - `createAnalyzeHandler(options)`에 추가 옵션(기본값 = 자소서 현행): `kind = "RESUME"`, `normalizeRequest = normalizeRequest`, `hashRequest = requestHash`, `buildProjectTitle = buildProjectTitle`, `analysisInput = resumeAnalysisInput`, `isEnabled = (settings) => settings?.analysisEnabled === true`, `disabledCode = "ANALYSIS_DISABLED"`, `creditsExhaustedCode = "ANALYSIS_CREDITS_EXHAUSTED"`, `verifyRequest = async () => {}`.
  - `export function createCompanyAnalyzeHandler(overrides = {})`.
  - 기본 export 디스패치: `split=1` → 분리, `kind=company` → 기업, 그 외 자소서.

- [ ] **Step 1: 실패하는 테스트**

`tests/api/analyze-company.test.js`:

```js
import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "../../lib/auth.js";
import { EntitlementUnavailableError } from "../../lib/analysis-entitlements.js";
import { companyRequestHash, normalizeCompanyRequest } from "../../lib/company-analysis.js";
import analyzeHandler, { createAnalyzeHandler, createCompanyAnalyzeHandler } from "../../api/analyze.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const RESUME_ANALYSIS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IDEMPOTENCY_KEY = "company-request-key-1234";

function request(overrides = {}) {
  return {
    body: { company: "현대자동차", jobKeyword: "전략기획" },
    headers: { "idempotency-key": IDEMPOTENCY_KEY },
    method: "POST",
    query: { kind: "company" },
    ...overrides,
  };
}

function response() {
  return {
    headers: {},
    statusCode: null,
    body: undefined,
    json(body) { this.body = body; return body; },
    setHeader(name, value) { this.headers[name] = value; },
    status(statusCode) { this.statusCode = statusCode; return this; },
  };
}

function createDatabase({ analysisEnabled = true, companyAnalysisEnabled = true, ownedResumeAnalysis = true } = {}) {
  const db = {
    $transaction: async (work) => work(db),
    $queryRaw: vi.fn(async () => []),
    analysis: {
      create: vi.fn(async ({ data }) => ({ id: "analysis-1", ...data })),
      findFirst: vi.fn(async ({ where }) => (ownedResumeAnalysis && where.id === RESUME_ANALYSIS_ID ? { id: where.id } : null)),
      update: vi.fn(async ({ data, where }) => ({ id: where.id, ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    auditEvent: { create: vi.fn(async ({ data }) => ({ id: "audit-1", ...data })) },
    analysisRequest: {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }) => ({ id: "request-1", ...data })),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async ({ data, where }) => ({ id: where.id, ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    analysisReservation: { count: vi.fn(async () => 0), updateMany: vi.fn(async () => ({ count: 1 })) },
    analysisEntitlement: {
      findUnique: vi.fn(async ({ where: { userId } }) => ({ id: `entitlement-${userId}`, companyCreditsGranted: 1, premiumCreditsGranted: 0, userId })),
      upsert: vi.fn(async ({ where: { userId } }) => ({ id: `entitlement-${userId}`, companyCreditsGranted: 1, premiumCreditsGranted: 0, userId })),
    },
    entitlementSetting: {
      findUnique: vi.fn(async () => ({ analysisEnabled, premiumEnabled: false, companyAnalysisEnabled })),
    },
    project: { create: vi.fn(async ({ data }) => ({ id: "project-1", ...data })) },
    tokenUsage: { create: vi.fn(async ({ data }) => ({ id: "token-1", ...data })) },
  };
  return db;
}

const activeUser = async () => ({ applicationUser: { id: USER_ID } });
const rateAllowed = async () => ({ allowed: true, retryAfterSeconds: 1 });
const companySummary = async () => ({
  premiumEnabled: false, freeRemaining: 1, bonusRemaining: 0, premiumRemaining: 0, remaining: 1,
  companyAnalysisEnabled: true, companyRemaining: 1,
});

function companyHandler(overrides = {}) {
  return createCompanyAnalyzeHandler({
    consumeRateLimit: rateAllowed,
    enqueueBackgroundWork: () => {},
    getEntitlementSummary: companySummary,
    model: vi.fn(),
    requireUser: activeUser,
    reserveAnalysis: vi.fn(async (_tx, _userId, kind) => ({ reservationId: "reservation-1", source: "premium", kind })),
    ...overrides,
  });
}

describe("company analysis API", () => {
  it("rejects an unauthenticated request before reading the body", async () => {
    const model = vi.fn();
    const handler = companyHandler({
      db: createDatabase(),
      model,
      requireUser: async () => { throw new AuthorizationError("AUTHENTICATION_REQUIRED", 401, "secret"); },
    });
    const res = response();

    await handler(request({ body: "{not json" }), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "AUTHENTICATION_REQUIRED", requestId: expect.any(String) });
    expect(model).not.toHaveBeenCalled();
  });

  it("rejects non-POST methods", async () => {
    const res = response();
    await companyHandler({ db: createDatabase() })(request({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
  });

  it("rejects a résumé-shaped body on the company route", async () => {
    const res = response();
    await companyHandler({ db: createDatabase() })(
      request({ body: { company: "현대자동차", jobKeyword: "전략기획", questions: [] } }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("INVALID_REQUEST");
  });

  it("returns 404 when the linked résumé analysis is not owned by the user", async () => {
    const db = createDatabase({ ownedResumeAnalysis: false });
    const res = response();

    await companyHandler({ db })(request({ body: { company: "현대자동차", jobKeyword: "전략기획", resumeAnalysisId: RESUME_ANALYSIS_ID } }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("RESUME_ANALYSIS_NOT_FOUND");
    expect(db.analysis.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: RESUME_ANALYSIS_ID, userId: USER_ID, kind: "RESUME" },
    }));
    expect(db.analysisRequest.create).not.toHaveBeenCalled();
  });

  it("returns 503 COMPANY_ANALYSIS_DISABLED while the switch is off", async () => {
    const res = response();
    await companyHandler({ db: createDatabase({ companyAnalysisEnabled: false }) })(request(), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe("COMPANY_ANALYSIS_DISABLED");
  });

  it("returns 409 COMPANY_CREDITS_EXHAUSTED from the company pool, not the résumé pool", async () => {
    const res = response();
    await companyHandler({
      db: createDatabase(),
      reserveAnalysis: vi.fn(async () => { throw new EntitlementUnavailableError("COMPANY_CREDITS_EXHAUSTED"); }),
    })(request(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("COMPANY_CREDITS_EXHAUSTED");
  });

  it("accepts the request, reserves a COMPANY credit, and stores an empty-input COMPANY analysis", async () => {
    const db = createDatabase();
    const reserve = vi.fn(async (_tx, _userId, kind) => ({ reservationId: "reservation-1", source: "premium", kind }));
    const model = vi.fn();
    const res = response();

    await companyHandler({ db, model, reserveAnalysis: reserve })(request(), res);

    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({
      analysis_id: "analysis-1",
      analysis_request_id: "request-1",
      project_id: "project-1",
      requestId: expect.any(String),
      status: "PENDING",
    });
    expect(reserve).toHaveBeenCalledWith(db, USER_ID, "COMPANY");
    expect(db.project.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, title: "현대자동차 전략기획 기업 분석", company: "현대자동차", jobKeyword: "전략기획" },
    });
    expect(db.analysis.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, projectId: "project-1", kind: "COMPANY", questionText: "", inputText: "", totalChars: null, status: "PENDING" },
    });
    const expectedHash = companyRequestHash(normalizeCompanyRequest({ company: "현대자동차", jobKeyword: "전략기획" }));
    expect(db.analysisRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ requestHash: expectedHash, reservationId: "reservation-1" }),
    }));
    expect(model).not.toHaveBeenCalled();
  });

  it("uses the company throughput policy for concurrency and rate limits", async () => {
    const db = createDatabase();
    db.analysisRequest.count = vi.fn(async () => 2);
    const res = response();

    await companyHandler({ db })(request(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("ANALYSIS_CONCURRENCY_LIMITED");
  });

  it("keeps the résumé handler untouched: no kind query still stores a RESUME analysis", async () => {
    const db = createDatabase();
    const reserve = vi.fn(async (_tx, _userId, kind) => ({ reservationId: "reservation-1", source: "free", kind }));
    const handler = createAnalyzeHandler({
      consumeRateLimit: rateAllowed,
      db,
      enqueueBackgroundWork: () => {},
      getEntitlementSummary: companySummary,
      model: vi.fn(),
      requireUser: activeUser,
      reserveAnalysis: reserve,
    });
    const res = response();

    await handler({
      body: { company: "현대자동차", jobKeyword: "전략기획", questions: [{ question: "지원 동기", answer: "가".repeat(200) }] },
      headers: { "idempotency-key": IDEMPOTENCY_KEY },
      method: "POST",
    }, res);

    expect(res.statusCode).toBe(202);
    expect(reserve).toHaveBeenCalledWith(db, USER_ID, "RESUME");
    expect(db.analysis.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ kind: "RESUME", totalChars: 200 }),
    }));
  });

  it("dispatches ?kind=company from the default export before touching the résumé handler", async () => {
    const res = response();
    await analyzeHandler(request({ headers: {} }), res);
    // 인증이 없으니 401 — 하지만 자소서 본문 검증(questions 필수)이 먼저 돌았다면 400 이었을 것이다.
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run tests/api/analyze-company.test.js`
Expected: FAIL — `createCompanyAnalyzeHandler` 없음.

- [ ] **Step 3: 구현 — import와 자소서 기본 조각**

`api/analyze.js` import 블록에 추가:

```js
import {
  analyzeCompany,
  buildCompanyProjectTitle,
  companyAnalysisInput,
  companyRequestHash,
  normalizeCompanyRequest,
} from "../lib/company-analysis.js";
import { consumeUserRateLimit, getAnalysisThroughputPolicy, getCompanyAnalysisThroughputPolicy } from "../lib/rate-limit.js";
```

(기존 `import { consumeUserRateLimit, getAnalysisThroughputPolicy } from "../lib/rate-limit.js";`는 위 줄로 교체.)

`createQuestionText`/`createInputText` 아래에 자소서 입력 조각을 추가:

```js
/** 자소서 분석의 Analysis 입력 컬럼. 기업 분석은 companyAnalysisInput 을 대신 쓴다. */
function resumeAnalysisInput(request) {
  return {
    questionText: createQuestionText(request.questions),
    inputText: createInputText(request.questions),
    totalChars: request.totalChars,
  };
}

/** 연결할 자소서 분석이 지정되면 본인 소유의 RESUME 분석인지 확인한다. */
async function verifyCompanyRequest(request, { db, userId }) {
  if (!request.resumeAnalysisId) return;
  const owned = await db.analysis.findFirst({
    where: { id: request.resumeAnalysisId, userId, kind: "RESUME" },
    select: { id: true },
  });
  if (!owned) throw new ApiError("RESUME_ANALYSIS_NOT_FOUND", 404);
}
```

- [ ] **Step 4: 구현 — `allocateAnalysisRequest`에 kind·입력·제목 주입**

시그니처와 본문을 다음으로 바꾼다:

```js
async function allocateAnalysisRequest({
  analysisInput,
  buildProjectTitle: titleOf,
  consumeRateLimit,
  db,
  getSummary,
  getThroughputPolicy,
  hash,
  idempotencyKey,
  kind,
  request,
  reserve,
  userId,
}) {
  return db.$transaction(async (tx) => {
    const existing = await findExistingRequest(tx, userId, idempotencyKey);
    const reused = idempotencyResult(existing, hash);
    if (reused) return { type: "stored", ...reused };

    const summary = await getSummary(tx, userId);
    const policy = getThroughputPolicy(summary);
    // 동시성은 kind 를 가리지 않고 계정 단위로 센다 — 함수 부하 보호가 목적이다.
    const activeCount = await tx.analysisRequest.count({
      where: {
        userId,
        status: { in: ["PENDING", "CALLING", "PERSISTENCE_PENDING"] },
      },
    });
    if (activeCount >= policy.concurrencyLimit) {
      throw new AnalysisConcurrencyLimitError();
    }

    const rate = await consumeRateLimit(tx, {
      userId,
      policy: policy.rateLimit,
    });
    if (!rate.allowed) return { type: "rate_limited", rate };

    const reservation = await reserve(tx, userId, kind);
    const project = await tx.project.create({
      data: {
        userId,
        title: titleOf(request.company, request.jobKeyword),
        company: request.company || null,
        jobKeyword: request.jobKeyword || null,
      },
    });
    const analysis = await tx.analysis.create({
      data: {
        userId,
        projectId: project.id,
        kind,
        ...analysisInput(request),
        status: "PENDING",
      },
    });
    const analysisRequest = await tx.analysisRequest.create({
      data: {
        userId,
        idempotencyKey,
        requestHash: hash,
        reservationId: reservation.reservationId,
        analysisId: analysis.id,
        expiresAt: new Date(Date.now() + ANALYSIS_REQUEST_TTL_MS),
      },
    });
    return { type: "new", analysis, analysisRequest, project, reservation };
  });
}
```

- [ ] **Step 5: 구현 — `createAnalyzeHandler` 옵션과 본문**

시그니처:

```js
export function createAnalyzeHandler({
  analysisInput = resumeAnalysisInput,
  buildProjectTitle: titleOf = buildProjectTitle,
  cancelReservation = cancelAnalysisReservation,
  consumeRateLimit = consumeUserRateLimit,
  creditsExhaustedCode = "ANALYSIS_CREDITS_EXHAUSTED",
  db = prisma,
  disabledCode = "ANALYSIS_DISABLED",
  enqueueBackgroundWork = (work) => waitUntil(work()),
  finalizeReservation = finalizeAnalysisReservation,
  getEntitlementSummary: getSummary = getEntitlementSummary,
  getAnalysisThroughputPolicy: getThroughputPolicy = getAnalysisThroughputPolicy,
  hashRequest = requestHash,
  isEnabled = (settings) => settings?.analysisEnabled === true,
  kind = "RESUME",
  model = analyzeCoverLetter,
  normalizeRequest: normalize = normalizeRequest,
  requireUser = requireActiveApplicationUser,
  reserveAnalysis: reserve = reserveAnalysis,
  verifyRequest = async () => {},
} = {}) {
```

본문에서 바꿀 곳(나머지는 그대로):

```js
      const request = normalize(req.body);
      const hash = hashRequest(request);
      await verifyRequest(request, { db, userId: applicationUser.id });
```

```js
      const settings = await db.entitlementSetting.findUnique({
        where: { id: SETTINGS_ID },
        select: { analysisEnabled: true, companyAnalysisEnabled: true },
      });
      if (!isEnabled(settings)) {
        return sendError(res, 503, disabledCode, requestId);
      }
```

```js
        allocation = await allocateAnalysisRequest({
          analysisInput,
          buildProjectTitle: titleOf,
          consumeRateLimit,
          db,
          getSummary,
          getThroughputPolicy,
          hash,
          idempotencyKey,
          kind,
          request,
          reserve,
          userId: applicationUser.id,
        });
```

```js
        if (error instanceof EntitlementUnavailableError) {
          throw new ApiError(error.code ?? creditsExhaustedCode, 409);
        }
```

- [ ] **Step 6: 구현 — 기업 핸들러 팩토리와 디스패치**

파일 하단을 다음으로 교체:

```js
export const maxDuration = 120;

const COMPANY_HANDLER_DEFAULTS = Object.freeze({
  analysisInput: companyAnalysisInput,
  buildProjectTitle: buildCompanyProjectTitle,
  creditsExhaustedCode: "COMPANY_CREDITS_EXHAUSTED",
  disabledCode: "COMPANY_ANALYSIS_DISABLED",
  getAnalysisThroughputPolicy: getCompanyAnalysisThroughputPolicy,
  hashRequest: companyRequestHash,
  // 전체 분석 스위치가 꺼지면 기업 분석도 함께 멈춘다.
  isEnabled: (settings) => settings?.analysisEnabled === true && settings?.companyAnalysisEnabled === true,
  kind: "COMPANY",
  model: analyzeCompany,
  normalizeRequest: normalizeCompanyRequest,
  verifyRequest: verifyCompanyRequest,
});

/** 기업 분석 리포트 핸들러. 자소서 핸들러와 같은 파이프라인에 kind 조각만 주입한다. */
export function createCompanyAnalyzeHandler(overrides = {}) {
  return createAnalyzeHandler({ ...COMPANY_HANDLER_DEFAULTS, ...overrides });
}

const analyzeHandler = createAnalyzeHandler();
const companyAnalyzeHandler = createCompanyAnalyzeHandler();
const resumeSplitHandler = createResumeSplitHandler();

// /api/analyze/split → ?split=1, /api/analyze/company → ?kind=company 로 rewrite 되어
// 이 함수 하나로 들어온다 (Hobby 12함수 제한).
export default function handler(req, res) {
  if (req.query?.split === "1") return resumeSplitHandler(req, res);
  if (req.query?.kind === "company") return companyAnalyzeHandler(req, res);
  return analyzeHandler(req, res);
}
```

`api/analyze.d.ts`에 추가:

```ts
export declare function createAnalyzeHandler(options?: Record<string, unknown>): typeof analyzeHandler;
export declare function createCompanyAnalyzeHandler(options?: Record<string, unknown>): typeof analyzeHandler;
```

- [ ] **Step 7: 통과 + 자소서 회귀 확인**

Run: `pnpm exec vitest run tests/api/analyze-company.test.js tests/api/analyze-atomic.test.js tests/api/analyze-auth.test.js tests/api/analyze-error.test.js tests/api/analyze-report-format.test.js tests/api/analyze-split.test.js tests/api/analyze-timeout.test.js tests/api/analyze-runtime-routing.test.js client/src/pages/reportPrompt.singleSource.test.ts`
Expected: PASS. 기존 테스트 중 `analysis.create` 호출을 `toHaveBeenCalledWith`로 정확히 단언하는 곳이 있으면 `kind: "RESUME"`을 기대 객체에 추가한다(`expect.objectContaining` 사용처는 그대로).

- [ ] **Step 8: 커밋(승인 시)**

```bash
git add api/analyze.js api/analyze.d.ts tests/api/analyze-company.test.js tests/api/analyze-atomic.test.js
git commit -m "feat(api): serve company analysis through the analyze handler with kind injection"
```

---

### Task 10: 라우팅 — `vercel.json` rewrite + `vite.config.ts` `apiRoute()`

**Files:**
- Modify: `vercel.json` (rewrites 배열, `/api/analyze/split` 항목 바로 아래) — **다른 미커밋 변경(CSP)은 그대로 둔다**
- Modify: `vite.config.ts:14-16`
- Test: `tests/api/company-analysis-routing.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트**

```js
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viteSource = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
const vercelConfig = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));

describe("company analysis routing", () => {
  it("maps /api/analyze/company to the analyze function with kind=company in Vite", () => {
    expect(viteSource).toContain('if (pathname === "/api/analyze/company")');
    expect(viteSource).toContain('return { file: "api/analyze.js", query: { kind: "company" } }');
  });

  it("rewrites /api/analyze/company to ?kind=company on Vercel before the SPA fallback", () => {
    const rewrites = vercelConfig.rewrites;
    const companyIndex = rewrites.findIndex((rule) => rule.source === "/api/analyze/company");
    const fallbackIndex = rewrites.findIndex((rule) => rule.destination === "/index.html");
    expect(companyIndex).toBeGreaterThan(-1);
    expect(rewrites[companyIndex].destination).toBe("/api/analyze?kind=company");
    expect(companyIndex).toBeLessThan(fallbackIndex);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run tests/api/company-analysis-routing.test.js`
Expected: FAIL.

- [ ] **Step 3: 구현**

`vite.config.ts`의 split 분기 아래에:

```ts
  if (pathname === "/api/analyze/company")
    return { file: "api/analyze.js", query: { kind: "company" } };
```

`vercel.json` rewrites의 `/api/analyze/split` 객체 바로 뒤에:

```json
    {
      "source": "/api/analyze/company",
      "destination": "/api/analyze?kind=company"
    },
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run tests/api/company-analysis-routing.test.js tests/api/analyze-runtime-routing.test.js tests/security/deployment-security.test.js`
Expected: PASS.

- [ ] **Step 5: 커밋(승인 시) — `vercel.json`은 이 hunk만**

`vercel.json`에는 무관한 미커밋 변경이 있으므로 부분 스테이징한다:

```bash
git add vite.config.ts tests/api/company-analysis-routing.test.js
git add -p vercel.json
git commit -m "feat(routing): expose POST /api/analyze/company in Vercel and Vite"
```

(`git add -p`에서 rewrites hunk만 `y`, CSP hunk는 `n`. 대화형이 불가한 환경이면 커밋을 사용자에게 넘긴다.)

---

### Task 11: 폴링·조회·프로젝트 응답에 `kind`

**Files:**
- Modify: `api/analysis-requests/[id].js`
- Modify: `api/analysis/[id].js`
- Modify: `api/projects.js`
- Test: `tests/api/analysis-request-status.test.js`, `tests/api/protected-user-routes.test.js`

**Interfaces:**
- Produces: 세 응답에 `kind: "RESUME" | "COMPANY"`(`analysis`가 없으면 `"RESUME"`). 프로젝트 요약은 `data.brief.oneLiner`도 폴백.

- [ ] **Step 1: 테스트 갱신·추가**

`tests/api/analysis-request-status.test.js`에서 성공 응답 `toEqual` 3곳(105·142·166·197행 부근)에 `kind: "RESUME",`을 추가한다. `storedRequest()` 픽스처의 `analysis`에 `kind: "RESUME"`을 넣는다. 새 테스트:

```js
  it("reports the analysis kind so the client can route to the right report page", async () => {
    const { db } = createDatabase({
      stored: storedRequest({ analysis: { errorCode: null, id: "analysis-1", projectId: "project-1", kind: "COMPANY" } }),
    });
    const handler = createAnalysisRequestStatusHandler({ db, requireUser: activeUser });
    const res = response();

    await handler(request(), res);

    expect(res.body).toMatchObject({ status: "SUCCEEDED", analysis_id: "analysis-1", kind: "COMPANY" });
  });
```

`tests/api/protected-user-routes.test.js`의 프로젝트 목록 기대 객체에 `kind: "RESUME"`을 추가하고, 새 테스트:

```js
  it("labels a company analysis project and summarizes it from the brief", async () => {
    const handler = createProjectsHandler({
      db: {
        project: {
          findMany: vi.fn(async () => [{
            id: "p2",
            title: "현대자동차 전략기획 기업 분석",
            company: "현대자동차",
            jobKeyword: "전략기획",
            createdAt: new Date("2026-09-06T00:00:00Z"),
            _count: { analyses: 1 },
            analyses: [{
              id: "a2",
              kind: "COMPANY",
              totalChars: null,
              questionText: "",
              aiResponseJson: { brief: { oneLiner: "전동화로 체급을 바꾸는 완성차" } },
            }],
          }]),
        },
      },
      requireUser: activeUser,
    });
    const res = response();

    await handler(request(), res);

    expect(res.body[0]).toMatchObject({
      kind: "COMPANY",
      question_count: 0,
      total_chars: 0,
      summary: "전동화로 체급을 바꾸는 완성차",
    });
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run tests/api/analysis-request-status.test.js tests/api/protected-user-routes.test.js`
Expected: FAIL — `kind` 없음.

- [ ] **Step 3: 구현**

`api/analysis-requests/[id].js`: `OWNED_STATUS_SELECT.analysis.select`에 `kind: true`, `statusResponse`에 `kind: analysisRequest.analysis?.kind ?? "RESUME",`.

`api/analysis/[id].js`: select에 `kind: true`, 응답에 `kind: analysis.kind ?? "RESUME",`.

`api/projects.js`: `analyses.select`에 `kind: true`, `extractSummary`의 반환을

```js
    return data.summary
      ?? data.firstImpression?.summaryOneLiner
      ?? data.firstImpression?.persona
      ?? data.brief?.oneLiner
      ?? null;
```

로, 매핑에 `kind: latest?.kind ?? "RESUME",` 추가.

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run tests/api/analysis-request-status.test.js tests/api/protected-user-routes.test.js tests/api`
Expected: PASS (다른 API 테스트가 응답 전체를 `toEqual`로 단언해 깨지면 `kind: "RESUME"`을 추가).

- [ ] **Step 5: 커밋(승인 시)**

```bash
git add "api/analysis-requests/[id].js" "api/analysis/[id].js" api/projects.js tests/api/analysis-request-status.test.js tests/api/protected-user-routes.test.js
git commit -m "feat(api): expose the analysis kind in status, report, and project responses"
```

---

### Task 12: 수동 프로브 스크립트 (테스트 아님)

**Files:**
- Create: `scripts/manual/company-analysis-probe.mjs`

**목적:** 실제 Gemini 1회 호출로 (a) 2.5-flash + `google_search` 조합이 200을 돌려주는지, (b) 1차 지연(ms), (c) 출처 수, (d) `searchEntryPoint.renderedContent` 유무와 길이, (e) 복구 호출이 발생했는지를 기록한다. 비용이 드는 실제 호출이므로 사용자가 직접 실행한다.

- [ ] **Step 1: 스크립트 작성**

```js
// 실제 Gemini 를 1회 호출해 그라운딩 조합·지연·출처를 기록하는 수동 프로브.
// 실행: GEMINI_API_KEY=... node scripts/manual/company-analysis-probe.mjs "현대자동차" "전략기획"
// 리포트 본문은 출력하지 않는다(로그에 AI 응답 금지 규칙). 구조 요약만 찍는다.
import { analyzeCompany } from "../../lib/company-analysis.js";

const [company = "현대자동차", jobKeyword = "전략기획"] = process.argv.slice(2);
const db = { aiModelSetting: { findUnique: async () => null } };
const startedAt = Date.now();

try {
  const result = await analyzeCompany({ company, jobKeyword, postingText: "", resumeAnalysisId: null }, db);
  const elapsedMs = Date.now() - startedAt;
  if (result.error) {
    console.log(JSON.stringify({ outcome: result.error, elapsedMs }, null, 2));
    process.exit(0);
  }
  console.log(JSON.stringify({
    outcome: "ok",
    elapsedMs,
    repaired: result.reportMeta.repaired,
    modelName: result.analysisMeta.modelName,
    tokenUsage: result.analysisMeta.tokenUsage,
    sourceCount: result.sources.length,
    searchQueries: result.reportMeta.searchQueries,
    searchEntryPointHtmlLength: result.reportMeta.searchEntryPointHtml?.length ?? 0,
    sectionKeys: Object.keys(result).filter((key) => !["sources", "reportMeta", "analysisMeta"].includes(key)),
    counts: {
      segments: result.businessMap?.segments?.length ?? 0,
      focusItems: result.focusBusinesses?.items?.length ?? 0,
      keyFigures: result.financialSnapshot?.keyFigures?.length ?? 0,
      issues: result.currentIssues?.length ?? 0,
      roleNews: result.roleInContext?.recentNewsForRole?.length ?? 0,
      candidates: result.businessCandidates?.length ?? 0,
      questions: result.interviewPrep?.questions?.length ?? 0,
    },
  }, null, 2));
} catch (error) {
  console.log(JSON.stringify({
    outcome: "failed",
    elapsedMs: Date.now() - startedAt,
    code: error?.code ?? null,
    statusCode: error?.statusCode ?? null,
    name: error?.name ?? null,
  }, null, 2));
  process.exit(1);
}
```

- [ ] **Step 2: 구문 확인(실행은 하지 않는다)**

Run: `node --check scripts/manual/company-analysis-probe.mjs`
Expected: 출력 없음(구문 OK).

- [ ] **Step 3: 사용자에게 실행 요청 문구를 완료 보고에 포함**

```bash
GEMINI_API_KEY=... node scripts/manual/company-analysis-probe.mjs "현대자동차" "전략기획"
```

기록할 것: `elapsedMs`(65s 근접 여부), `repaired`(복구 빈도), `sourceCount`, `searchEntryPointHtmlLength`(검색 제안 칩 표시 의무·CSP 판단 근거), `counts`(프롬프트 제약 준수).

- [ ] **Step 4: 커밋(승인 시)**

```bash
git add scripts/manual/company-analysis-probe.mjs
git commit -m "chore(scripts): add a manual grounding probe for company analysis"
```

---

### Task 13: 전체 검증과 완료 보고

- [ ] **Step 1: 대상 테스트 전체**

Run:

```bash
pnpm exec vitest run lib/analysis-entitlements.test.js lib/company-analysis.test.js lib/entitlement-products.test.js tests/api scripts/vercel-function-limit.test.js client/src/lib/entitlements.test.ts client/src/pages/companyReportPrompt.singleSource.test.ts client/src/pages/reportPrompt.singleSource.test.ts
```

Expected: PASS. (`main` 기존 실패 7건은 이 작업과 무관 — 메모리 `main-failing-tests` 참조. 그 7건 외 실패가 있으면 이 작업 탓이다.)

- [ ] **Step 2: 타입 체크**

Run: `pnpm check`
Expected: 오류 0.

- [ ] **Step 3: 완료 보고 형식**

```text
가정: 기업 리포트는 자소서와 같은 테이블(kind)·같은 상태 머신을 쓴다. 크레딧은 companyCreditsGranted 별도 풀. 상품·결제·화면은 후속 플랜.
변경: 마이그레이션 1개(미적용), lib 3개, api 5개, 라우팅 2곳, 프롬프트 1개, 테스트 N개, 수동 프로브 1개.
검증: 위 vitest 명령 출력, pnpm check. 마이그레이션은 사용자가 DIRECT_URL 로 적용해야 함. 실제 Gemini 호출은 프로브 스크립트로 사용자가 1회 실행.
남은 위험: 2.5-flash + google_search 조합·지연은 프로브로 확정. 검색 제안 칩 CSP. 관리자 대시보드 analysis.count 가 기업 리포트 포함.
```

---

## Self-Review 결과

- **Spec coverage(§5 기준):** 5-1 데이터 모델 → Task 1. 5-2 크레딧 풀 → Task 2·3·5(단, `checkoutUrls`는 상품 플랜으로 이월 — 상품 5종이 생겨야 의미가 있다). 5-3 상품 → 후속 플랜(명시). 5-4 API 표면 → Task 9·10·11(`GET /api/projects` `kind` 포함). 5-5 Gemini 호출 → Task 6·7·8·12. 5-6 클라이언트 → 후속 플랜(파서만 Task 5). 5-7 테스트 → 각 Task에 분산(`tests/api/company-analysis-grounding.test.js`는 lib 패턴에 맞춰 `lib/company-analysis.test.js`로 위치 변경). 5-8 PR1·PR2 → 이 플랜.
- **Placeholder scan:** TBD/TODO 없음. 프롬프트 본문·SQL·테스트 코드 모두 실제 내용.
- **Type consistency:** `reserveAnalysis(tx, userId, kind)` 시그니처가 Task 2 정의·Task 9 사용·테스트 단언에서 일치. `grantGroblePurchase` 반환 `{granted, credits, companyCredits}` 일치. `analyzeCompany` 반환의 `reportMeta.repaired`가 Task 8 구현·테스트에서 일치. `companyAnalysisInput()` → `{questionText:"", inputText:"", totalChars:null}`이 Task 7 정의·Task 9 단언에서 일치. `COMPANY_ANALYSIS_THROUGHPUT`은 `lib/rate-limit.js`에 두는 것으로 스펙(§5-4 "lib/company-analysis.js") 대비 위치만 조정 — 정책의 단일 정의처가 rate-limit.js이기 때문.
