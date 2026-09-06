# 기업 분석 리포트 3단계(상품·결제, 티어형) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이용권을 "베이직(자소서 1 또는 기업 1) → 스탠다드(자소서 2 + 기업 1) → 프리미엄(자소서 3 + 기업 3)" 티어로 팔 수 있게 한다 — 상품 3종(`COMPANY_SINGLE`·`STANDARD`·`PREMIUM`) 추가, 상품별 그로블 설정을 DB 카탈로그로 이전, 웹훅 번들 지급, 이용권 페이지 티어 카드, 관리자 상품 설정 화면.

**Architecture:** 서버는 `lib/entitlement-products.js`를 상품 정의·설정 읽기의 단일 정의처로 키우고(`PURCHASE_PRODUCTS` 5종 + `readPurchaseProductSettings(db)`), 새 테이블 `purchase_product_settings`(상품별 contentId·결제 URL·판매 여부)를 웹훅·구매 의도·관리자 집계가 함께 읽는다. `GET /api/entitlements`는 `checkoutUrls`(쿼리 키 → URL|null)를 가산하고 기존 두 URL 필드는 유지한다. 클라이언트는 `pricing.ts`를 5상품으로 넓히고 이용권 페이지를 티어 카드 3장(베이직은 선택 버튼 2개)으로 바꾼다. 새 `api/` 파일은 0개(관리자 엔드포인트는 `api/admin/[...route].js` 라우터에 키로 추가).

**Tech Stack:** Prisma 7(수기 SQL 마이그레이션) · Vercel Serverless ESM JS · React 19 + Vite + Tailwind 4/Radix · Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-company-analysis-report-design.md` — §5-1~5-3(데이터 모델·크레딧 풀·상품), **§7-3(티어형 가격·상품 구성 확정 + 컷오버 절차 — §3 가격안·§5-3 `PURCHASE_PRODUCTS`·§5-6 토글 설계를 덮어씀)**.

## Global Constraints

- `pnpm`만. npm·락파일 변경 금지. **DB 명령 금지**(`prisma migrate deploy|dev|reset`, `db push` 실행 금지 — 마이그레이션은 파일만 작성, 적용은 사용자가). 실제 Gemini·Groble 호출 금지.
- **Vercel Hobby 12함수 한도**: `api/` 아래 새 `.js` 파일 금지(`scripts/vercel-function-limit.test.js`). 관리자 엔드포인트는 `lib/admin-handlers/*.js` + `api/admin/[...route].js`의 `DEFAULT_HANDLERS` 키로만 추가한다(`/api/admin/:path*` rewrite와 `vite.config.ts`의 admin catch-all이 이미 있어 라우팅 파일 변경 없음).
- **상품·가격(스펙 §7-3, 확정)**:

  | `PurchaseProduct` | 쿼리 키 | 티어·라벨 | 판매가 | 정가/따로 살 때 | 지급(자소서·기업) | 판매 |
  | --- | --- | --- | --- | --- | --- | --- |
  | `SINGLE` | `single` | 베이직 · 자소서 진단 1회 | 5,900 | 9,900(11/30까지 할인) | 1 · 0 | ○ |
  | `COMPANY_SINGLE` | `company` | 베이직 · 기업 분석 1회 | 5,900 | 5,900(취소선 없음) | 0 · 1 | ○(등록 후) |
  | `STANDARD` | `standard` | 스탠다드 | 14,900 | 17,700 | 2 · 1 | ○(기존 3회권 상품 승계) |
  | `PREMIUM` | `premium` | 프리미엄 | 25,900 | 35,400 | 3 · 3 | ○(등록 후) |
  | `TRIPLE` | `triple` | 3회권(구) | 14,900 | 29,700 | 3 · 0 | ✕ 레거시(기록 라벨·전환기 지급용) |

  `PURCHASE_PRODUCT_KEYS` 순서: `SINGLE, COMPANY_SINGLE, STANDARD, PREMIUM, TRIPLE`. 가격 숫자는 `client/src/lib/pricing.ts`에만 쓴다(서버는 금액을 모른다 — 그로블 상품가가 진실).
- **에러 코드·필드명은 계약**: 기존 `PREMIUM_SALES_DISABLED`(403)·`PREMIUM_CHECKOUT_NOT_CONFIGURED`(503)·`INVALID_PURCHASE_PRODUCT`(400)·웹훅 코드(`UNEXPECTED_GROBLE_PRODUCT` 422, `GROBLE_PREMIUM_PRODUCT_NOT_CONFIGURED` 500 등) 유지. 신규: `COMPANY_SALES_DISABLED`(403, 기업 크레딧이 든 상품인데 `companyAnalysisEnabled`가 꺼짐), `INVALID_PRODUCT_SETTING`(400)·`DUPLICATE_CONTENT_ID`(409, 관리자 설정). 응답 필드 `purchaseIntentId`·`checkoutUrl`·`grantedCredits`·`grantedCompanyCredits`·`checkoutUrls`·`groblePaymentUrl`(= `checkoutUrls.standard`)·`grobleSinglePaymentUrl`(= `checkoutUrls.single`).
- 판매 가능 조건: `premiumEnabled` AND 상품 행 `active` AND 결제 URL 존재. 기업 크레딧이 든 상품(`companyCredits > 0`)은 추가로 `companyAnalysisEnabled`. 꺼져 있으면 `checkoutUrls`에서 `null`, 구매 의도는 403.
- 쿼리 `?product` 없음 → `STANDARD`(구 클라이언트가 3회권 결제로 쓰던 경로를 스탠다드가 승계; **Ruling**: 예전 기본값 `TRIPLE`은 판매 종료라 더 이상 기본값일 수 없다).
- 웹훅은 **결제된 contentId 기준으로 지급**한다. contentId → 상품 대응은 DB 행이 우선, `SINGLE`은 env `GROBLE_SINGLE_CONTENT_ID`, `TRIPLE`은 env `GROBLE_PREMIUM_CONTENT_ID`를 fallback으로 읽되 **그 값을 이미 어떤 DB 행이 쓰고 있으면 fallback을 버린다**(컷오버 시 관리자가 `STANDARD` 행에 옛 3회권 contentId를 넣는 순간 2+1 지급으로 바뀐다). 새 env 변수는 추가하지 않는다(`.env.example` 변경 없음).
- 기존 `entitlement_settings.groble_payment_url`·`groble_single_payment_url` 컬럼은 **삭제하지 않는다**(마이그레이션이 새 테이블로 백필만). 코드는 더 이상 읽지 않는다.
- 클라이언트 테스트 스타일: 순수 로직은 `lib/*.test.ts` 단위 테스트, JSX는 소스 문자열 테스트, 렌더 검증은 `// @vitest-environment jsdom` + RTL(기존 `Entitlements.purchase.test.tsx`·`Checkout.test.tsx` 패턴). 서버 핸들러 테스트는 `vi.hoisted` 가짜 prisma 주입, 실제 DB·네트워크 없음.
- 기존 소스 문자열 테스트가 묶어 둔 것 중 유지: `Entitlements.tsx`의 `PRICING[product]`·`TRIPLE_PER_USE_PRICE`·`line-through`·`plan.discountLabel`·`window.open(path, "_blank")`·"현재 추가 이용권 판매를 준비하고 있어요."·"결제를 완료하면 이용권이 곧 반영돼요"·`getLoginRedirectPath("/entitlements")`·`navigate("/my/entitlements")`·"무료 체험"·mailto 문의; `Checkout.tsx`의 흐름(창 먼저 열고 구매 의도는 새 탭에서). `renderPaidPlanCard("single")`/`("triple")` 핀은 티어 카드로 바뀌므로 테스트도 함께 고친다(Task 6).
- TS 변경 후 `pnpm check` 0 오류. 커밋은 Task별, 메시지 끝 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. `git add`는 해당 Task 파일만(경로 명시). 무관한 미커밋 변경 `client/src/pages/Login.tsx`, `vercel.json`, `client/src/lib/googleIdentity*.ts`, `groble-cover-4x3.png`는 스테이징·수정·stash 금지. `git stash`·`git checkout -- <file>`·`git reset`·`git clean` 금지. 저장소 전체 prettier 금지.
- 문서·주석 한국어, 식별자 원형. 로그·감사 이벤트에 이메일·토큰·원문 금지(기존 `createSafeDiagnostic` 유지).
- 랜딩 `PricingSection.tsx`·GNB·업셀 CTA·샘플은 **④ 진입점 플랜**으로 미룬다(이 플랜은 이용권 페이지·체크아웃·관리자만).

---

## 파일 구조

| 파일 | 역할 | 상태 |
| --- | --- | --- |
| `prisma/schema.prisma` | `PurchaseProduct` 5값, `PurchaseProductSetting` 모델, 레거시 URL 컬럼 주석 | 수정 |
| `prisma/migrations/20260907_add_tier_purchase_products/migration.sql` | enum 값 3개 추가(별도 파일 — 같은 트랜잭션에서 새 값 사용 불가) | 생성 |
| `prisma/migrations/20260907_add_purchase_product_settings/migration.sql` | 상품 설정 테이블 + 5행 백필 | 생성 |
| `tests/api/purchase-product-settings-migration.test.js` | 마이그레이션 SQL 문자열 검사 | 생성 |
| `lib/entitlement-products.js` · `.test.js` | `PURCHASE_PRODUCTS`, `PURCHASE_PRODUCT_KEYS`, `PRODUCT_QUERY_KEYS`, `parsePurchaseProductQuery`, `resolveProductForContentId(contentId, contentIdByProduct)`, `resolveProductForPaymentRecord`, `readPurchaseProductSettings(db, env)`, `contentIdsBySettings` | 수정 |
| `lib/groble-webhook-handler.js` · `tests/api/groble-webhook-handler.test.js` | 설정 주입(`readProductSettings`), `parseGroblePaidEvent(body, contentIdByProduct)`, 번들 지급, 응답 `grantedCompanyCredits` | 수정 |
| `lib/admin-handlers/dashboard.js` · `user-detail.js` · `tests/api/admin/dashboard-payments.test.js` | contentId 맵을 설정에서 읽음, `byProduct` 5키 | 수정 |
| `api/entitlements.js` · `tests/api/entitlements.test.js` | `checkoutUrls`, 상품별 게이트, `COMPANY_SALES_DISABLED`, 기본 상품 `STANDARD` | 수정 |
| `lib/admin-handlers/product-settings.js` · `tests/api/admin/product-settings.test.js` · `api/admin/[...route].js` | 관리자 상품 설정 GET/PATCH(upsert) + 라우터 키 | 생성/수정 |
| `client/src/lib/pricing.ts` · `.test.ts` | 5상품 가격·라벨, `companyUses`, `PURCHASE_PRODUCT_KEYS`, `PurchaseProductKey`, `PRODUCT_KEY_BY_PRODUCT`, `TIER_PRODUCTS`, `COMPANY_REPORT_INCLUDED_FEATURES`, `savingsFor` | 수정 |
| `client/src/lib/entitlements.ts` · `.test.ts` | `checkoutUrls` 파싱(구서버 호환), `PurchaseProductKey` 재수출 | 수정 |
| `client/src/pages/Checkout.tsx` · `.test.tsx` | `PRODUCT_KEYS` 5키 | 수정 |
| `client/src/pages/Entitlements.tsx` · `.test.ts` · `.purchase.test.tsx` | 티어 카드 3장(베이직 선택 버튼), `canPurchase` → `checkoutUrls`, `#company` 해시, 기업 리포트 구성 안내 | 수정 |
| `client/src/pages/companyAnalyzeErrors.ts` · `.test.ts` | `COMPANY_CREDITS_EXHAUSTED` → `/entitlements#company` | 수정 |
| `client/src/lib/admin-product-settings.ts` · `.test.ts` | 관리자 상품 설정 API 클라이언트 | 생성 |
| `client/src/pages/admin/settings/SettingsPage.tsx` · `SettingsPage.products.test.ts` | "결제 상품 설정" 카드(5행: contentId·URL·판매 스위치·저장) | 수정/생성 |
| `client/src/hooks/admin/useDashboardData.ts` · `client/src/components/admin/dashboard/KpiGrid.tsx` | `byProduct` 5키 타입, 추정 매출 합산 일반화 | 수정 |

---

### Task 1: Prisma — 상품 enum 3값, `PurchaseProductSetting` 테이블, 마이그레이션 2개

**Files:**
- Modify: `prisma/schema.prisma` (enum `PurchaseProduct` 109-114행, model `EntitlementSetting` 135-149행 근처)
- Create: `prisma/migrations/20260907_add_tier_purchase_products/migration.sql`
- Create: `prisma/migrations/20260907_add_purchase_product_settings/migration.sql`
- Test: `tests/api/purchase-product-settings-migration.test.js`

**Interfaces:**
- Produces: Prisma 모델 `purchaseProductSetting` — `product: PurchaseProduct(@id)`, `grobleContentId: String?(@unique)`, `paymentUrl: String(@default(""))`, `active: Boolean(@default(true))`, `createdAt`, `updatedAt`. 테이블 `purchase_product_settings`. 마이그레이션이 5행을 넣는다: `SINGLE`(1회권 URL 백필, active) · `STANDARD`(구 3회권 URL 백필, active) · `TRIPLE`·`COMPANY_SINGLE`·`PREMIUM`(URL "" · inactive).

- [ ] **Step 1: 실패하는 테스트**

`tests/api/purchase-product-settings-migration.test.js`:

```js
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const enumMigration = readFileSync(
  new URL("../../prisma/migrations/20260907_add_tier_purchase_products/migration.sql", import.meta.url),
  "utf8",
);
const tableMigration = readFileSync(
  new URL("../../prisma/migrations/20260907_add_purchase_product_settings/migration.sql", import.meta.url),
  "utf8",
);
const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

describe("purchase product settings migration", () => {
  it("adds the tier products to the enum in its own migration", () => {
    for (const value of ["COMPANY_SINGLE", "STANDARD", "PREMIUM"]) {
      expect(enumMigration).toContain(`ALTER TYPE purchase_product ADD VALUE IF NOT EXISTS '${value}'`);
    }
    // 새 enum 값은 같은 트랜잭션 안에서 쓸 수 없으므로 테이블 마이그레이션과 파일을 나눈다.
    expect(enumMigration).not.toContain("purchase_product_settings");
  });

  it("creates the per-product settings table and backfills every product row", () => {
    expect(tableMigration).toContain("CREATE TABLE purchase_product_settings");
    expect(tableMigration).toContain("product purchase_product PRIMARY KEY");
    expect(tableMigration).toContain("groble_content_id TEXT UNIQUE");
    // 1회권 URL 은 SINGLE 로, 구 3회권 URL 은 스탠다드가 승계한다.
    expect(tableMigration).toMatch(/'SINGLE'[\s\S]*groble_single_payment_url/);
    expect(tableMigration).toMatch(/'STANDARD'[\s\S]*groble_payment_url/);
    for (const value of ["'TRIPLE'", "'COMPANY_SINGLE'", "'PREMIUM'"]) {
      expect(tableMigration).toContain(value);
    }
    // 롤백 여지를 남기기 위해 옛 컬럼은 지우지 않는다.
    expect(tableMigration).not.toMatch(/DROP COLUMN/i);
  });

  it("declares the Prisma model that the settings reader queries", () => {
    expect(schema).toContain("model PurchaseProductSetting");
    expect(schema).toContain('@@map("purchase_product_settings")');
    for (const value of ["COMPANY_SINGLE", "STANDARD", "PREMIUM"]) {
      expect(schema).toContain(value);
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run tests/api/purchase-product-settings-migration.test.js`
Expected: FAIL (ENOENT).

- [ ] **Step 3: `prisma/schema.prisma`**

```prisma
enum PurchaseProduct {
  SINGLE
  TRIPLE
  COMPANY_SINGLE
  STANDARD
  PREMIUM

  @@map("purchase_product")
}
```

`EntitlementSetting`의 두 URL 필드 위에 주석(필드는 그대로):

```prisma
  /// 2026-09-07 이후 purchase_product_settings 로 이전됨. 코드는 더 이상 읽지 않는다(롤백용으로만 남김).
  groblePaymentUrl          String  @map("groble_payment_url") @db.Text
  /// 2026-09-07 이후 purchase_product_settings 로 이전됨. 코드는 더 이상 읽지 않는다(롤백용으로만 남김).
  grobleSinglePaymentUrl    String  @default("") @map("groble_single_payment_url") @db.Text
```

`EntitlementSetting` 바로 아래에:

```prisma
/// 상품별 Groble 연결. contentId 는 웹훅이 결제 상품을 판별하는 키, paymentUrl 은 구매 의도가 ref 를 붙여 여는 결제 페이지.
/// active 가 false 이면 그 상품은 팔지 않는다(지급 판별에는 영향 없음 — 이미 결제된 건은 언제나 지급).
model PurchaseProductSetting {
  product         PurchaseProduct @id
  grobleContentId String?         @unique @map("groble_content_id") @db.Text
  paymentUrl      String          @default("") @map("payment_url") @db.Text
  active          Boolean         @default(true)

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@map("purchase_product_settings")
}
```

- [ ] **Step 4: 마이그레이션 ① `20260907_add_tier_purchase_products/migration.sql`**

```sql
-- 티어형 이용권: 베이직(기업 분석 1회), 스탠다드(자소서 2 + 기업 1), 프리미엄(자소서 3 + 기업 3).
-- 새 enum 값은 같은 트랜잭션에서 쓸 수 없어(Postgres 제약) 이 값을 쓰는 백필은
-- 다음 마이그레이션(20260907_add_purchase_product_settings)에 둔다.
ALTER TYPE purchase_product ADD VALUE IF NOT EXISTS 'COMPANY_SINGLE';
ALTER TYPE purchase_product ADD VALUE IF NOT EXISTS 'STANDARD';
ALTER TYPE purchase_product ADD VALUE IF NOT EXISTS 'PREMIUM';
```

- [ ] **Step 5: 마이그레이션 ② `20260907_add_purchase_product_settings/migration.sql`**

```sql
-- 상품별 Groble 설정 카탈로그. 상품이 5개가 되면서 entitlement_settings 의 URL 컬럼 2개
-- (groble_payment_url = 3회권, groble_single_payment_url = 1회권)로는 늘릴 수 없어 행 단위로 옮긴다.
-- 옛 컬럼은 롤백 여지를 위해 남긴다(코드는 더 이상 읽지 않음).
CREATE TABLE purchase_product_settings (
  product purchase_product PRIMARY KEY,
  groble_content_id TEXT UNIQUE,
  payment_url TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1회권은 그대로 베이직(자소서)로 팔린다. contentId 는 env 에 있으므로 비워 두고
-- 관리자 화면에서 입력할 때까지 코드가 env 를 fallback 으로 읽는다.
INSERT INTO purchase_product_settings (product, payment_url, active)
SELECT 'SINGLE', COALESCE(groble_single_payment_url, ''), true FROM entitlement_settings WHERE id = 'singleton'
ON CONFLICT (product) DO NOTHING;

-- 구 3회권의 그로블 상품(결제 URL·contentId)은 스탠다드가 승계한다. 이름·설명은 그로블에서 고친다.
INSERT INTO purchase_product_settings (product, payment_url, active)
SELECT 'STANDARD', COALESCE(groble_payment_url, ''), true FROM entitlement_settings WHERE id = 'singleton'
ON CONFLICT (product) DO NOTHING;

-- 3회권(구)은 판매 종료. 기업 분석 1회·프리미엄은 그로블 등록 전이라 URL 없음·판매 안 함으로 시작.
INSERT INTO purchase_product_settings (product, payment_url, active) VALUES
  ('TRIPLE', '', false),
  ('COMPANY_SINGLE', '', false),
  ('PREMIUM', '', false)
ON CONFLICT (product) DO NOTHING;
```

`prisma/migrations/20260826_secure_admin_credit_tables/migration.sql`을 열어 그 파일이 새 테이블에 보안 문장(RLS·REVOKE/GRANT 등)을 붙이는 관례가 있으면 같은 형식으로 한 줄을 이 파일 끝에 추가하고, 없으면 붙이지 않는다. 판단을 보고서에 적는다.

- [ ] **Step 6: Prisma 생성·검증**

Run: `pnpm exec prisma validate && pnpm exec prisma generate`
Expected: 오류 없음. (DB에 적용하지 않는다.)

- [ ] **Step 7: 테스트 통과 확인**

Run: `pnpm exec vitest run tests/api/purchase-product-settings-migration.test.js`
Expected: PASS 3/3.

- [ ] **Step 8: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations/20260907_add_tier_purchase_products/migration.sql prisma/migrations/20260907_add_purchase_product_settings/migration.sql tests/api/purchase-product-settings-migration.test.js
git commit -m "feat(prisma): add the tier purchase products and the per-product Groble settings table"
```

---

### Task 2: 상품 카탈로그·설정 읽기·웹훅 번들 지급

**Files:**
- Modify: `lib/entitlement-products.js` (전체 교체), `lib/entitlement-products.test.js` (전체 교체)
- Modify: `lib/groble-webhook-handler.js` (import 6행, `parseGroblePaidEvent` 89-137행, factory 145-153행, 172행 호출, 186·200행 조기 반환, 214-221행 지급, 224행 응답)
- Modify: `lib/admin-handlers/dashboard.js` (`summarizePayments` 33-45행과 호출부), `lib/admin-handlers/user-detail.js` (`contentIds` 객체)
- Test: `tests/api/groble-webhook-handler.test.js`, `tests/api/admin/dashboard-payments.test.js`, (있으면) `tests/api/admin/user-detail.test.js`

**Interfaces:**
- Consumes: Task 1의 `prisma.purchaseProductSetting.findMany()` (필드 `product`, `grobleContentId`, `paymentUrl`, `active`).
- Produces (`lib/entitlement-products.js`):
  - `PURCHASE_PRODUCTS: { SINGLE:{resumeCredits:1,companyCredits:0}, COMPANY_SINGLE:{0,1}, STANDARD:{2,1}, PREMIUM:{3,3}, TRIPLE:{3,0} }` (`credits` 키는 없앤다).
  - `PURCHASE_PRODUCT_KEYS = ["SINGLE","COMPANY_SINGLE","STANDARD","PREMIUM","TRIPLE"]`.
  - `PRODUCT_QUERY_KEYS = { SINGLE:"single", COMPANY_SINGLE:"company", STANDARD:"standard", PREMIUM:"premium", TRIPLE:"triple" }`.
  - `parsePurchaseProductQuery(value)` — 5키, `undefined` → `"STANDARD"`, 그 외 `null`.
  - `resolveProductForContentId(contentId, contentIdByProduct = {})`, `resolveProductForPaymentRecord(rawEvent, contentIdByProduct)`.
  - `readPurchaseProductSettings(db, env = process.env)` → `{ [product]: { contentId: string|null, paymentUrl: string, active: boolean } }` 5키. env fallback(`SINGLE`←`GROBLE_SINGLE_CONTENT_ID`, `TRIPLE`←`GROBLE_PREMIUM_CONTENT_ID`)은 그 값을 쓰는 DB 행이 없을 때만.
  - `contentIdsBySettings(settings)` → `{ [product]: contentId }`.
- Produces (`lib/groble-webhook-handler.js`): `createGrobleWebhookHandler({ logger, now, prismaClient, readProductSettings = readPurchaseProductSettings, readRawBody, webhookSecret })` — `premiumContentId`·`singleContentId` 파라미터 제거; `parseGroblePaidEvent(body, contentIdByProduct)`; 성공 응답 `{ ok: true, grantedCredits, grantedCompanyCredits }`.

- [ ] **Step 1: 실패하는 테스트 — `lib/entitlement-products.test.js` 전체 교체**

```js
import { describe, expect, it } from "vitest";

import {
  PRODUCT_QUERY_KEYS,
  PURCHASE_PRODUCTS,
  PURCHASE_PRODUCT_KEYS,
  contentIdsBySettings,
  parsePurchaseProductQuery,
  readPurchaseProductSettings,
  resolveProductForContentId,
  resolveProductForPaymentRecord,
} from "./entitlement-products.js";

const CONTENT_IDS = {
  SINGLE: "6HteWn",
  COMPANY_SINGLE: "cmp001",
  STANDARD: "4SGBV5",
  PREMIUM: "prm001",
};

describe("PURCHASE_PRODUCTS", () => {
  it("defines the tier products with the confirmed credit splits", () => {
    expect(PURCHASE_PRODUCT_KEYS).toEqual(["SINGLE", "COMPANY_SINGLE", "STANDARD", "PREMIUM", "TRIPLE"]);
    expect(PURCHASE_PRODUCTS).toEqual({
      SINGLE: { resumeCredits: 1, companyCredits: 0 },
      COMPANY_SINGLE: { resumeCredits: 0, companyCredits: 1 },
      STANDARD: { resumeCredits: 2, companyCredits: 1 },
      PREMIUM: { resumeCredits: 3, companyCredits: 3 },
      TRIPLE: { resumeCredits: 3, companyCredits: 0 },
    });
    expect(PRODUCT_QUERY_KEYS).toEqual({
      SINGLE: "single", COMPANY_SINGLE: "company", STANDARD: "standard", PREMIUM: "premium", TRIPLE: "triple",
    });
  });
});

describe("parsePurchaseProductQuery", () => {
  it("파라미터가 없으면 구 3회권 경로를 승계한 스탠다드로 본다", () => {
    expect(parsePurchaseProductQuery(undefined)).toBe("STANDARD");
  });

  it("다섯 가지 쿼리 키를 상품 키로 바꾼다", () => {
    expect(parsePurchaseProductQuery("single")).toBe("SINGLE");
    expect(parsePurchaseProductQuery("company")).toBe("COMPANY_SINGLE");
    expect(parsePurchaseProductQuery("standard")).toBe("STANDARD");
    expect(parsePurchaseProductQuery("premium")).toBe("PREMIUM");
    expect(parsePurchaseProductQuery("triple")).toBe("TRIPLE");
  });

  it("모르는 값이면 null 을 준다", () => {
    expect(parsePurchaseProductQuery("quintuple")).toBeNull();
    expect(parsePurchaseProductQuery("SINGLE")).toBeNull();
    expect(parsePurchaseProductQuery("")).toBeNull();
    expect(parsePurchaseProductQuery("__proto__")).toBeNull();
  });
});

describe("resolveProductForContentId", () => {
  it("맵에 등록된 contentId 를 상품으로 되짚는다", () => {
    expect(resolveProductForContentId("4SGBV5", CONTENT_IDS)).toBe("STANDARD");
    expect(resolveProductForContentId("prm001", CONTENT_IDS)).toBe("PREMIUM");
  });

  it("등록되지 않은 contentId 는 상품으로 보지 않는다", () => {
    expect(resolveProductForContentId("nope", CONTENT_IDS)).toBeNull();
    expect(resolveProductForContentId("4SGBV5", {})).toBeNull();
    expect(resolveProductForContentId("4SGBV5")).toBeNull();
  });

  it("빈 문자열·null contentId 는 어떤 상품과도 맞추지 않는다", () => {
    expect(resolveProductForContentId("", { SINGLE: "" })).toBeNull();
    expect(resolveProductForContentId(null, { SINGLE: null })).toBeNull();
  });
});

describe("resolveProductForPaymentRecord", () => {
  it("저장된 product 를 그대로 쓴다", () => {
    expect(resolveProductForPaymentRecord({ product: "PREMIUM" }, {})).toBe("PREMIUM");
    expect(resolveProductForPaymentRecord({ product: "TRIPLE" }, {})).toBe("TRIPLE");
  });

  it("product 가 없던 옛 기록은 contentId 로 되짚는다", () => {
    expect(resolveProductForPaymentRecord({ contentId: "6HteWn" }, CONTENT_IDS)).toBe("SINGLE");
  });

  it("모르는 상품이면 지어내지 않고 null 을 준다", () => {
    expect(resolveProductForPaymentRecord({ product: "GOLD", contentId: "x" }, CONTENT_IDS)).toBeNull();
    expect(resolveProductForPaymentRecord(null, CONTENT_IDS)).toBeNull();
  });
});

describe("readPurchaseProductSettings", () => {
  function db(rows) {
    return { purchaseProductSetting: { findMany: async () => rows } };
  }
  const ENV = { GROBLE_PREMIUM_CONTENT_ID: "4SGBV5", GROBLE_SINGLE_CONTENT_ID: "6HteWn" };

  it("returns every product, filling legacy env content ids only where no row has one", async () => {
    const settings = await readPurchaseProductSettings(
      db([
        { product: "STANDARD", grobleContentId: null, paymentUrl: "https://groble.im/t", active: true },
        { product: "COMPANY_SINGLE", grobleContentId: "cmp001", paymentUrl: "", active: false },
      ]),
      ENV,
    );

    expect(Object.keys(settings)).toEqual(PURCHASE_PRODUCT_KEYS);
    expect(settings.SINGLE).toEqual({ contentId: "6HteWn", paymentUrl: "", active: false });
    // 전환 전: 구 3회권 contentId 는 env 를 통해 TRIPLE(자소서 3) 에 대응한다 — 초과 지급은 있어도 부족 지급은 없다.
    expect(settings.TRIPLE).toEqual({ contentId: "4SGBV5", paymentUrl: "", active: false });
    expect(settings.STANDARD).toEqual({ contentId: null, paymentUrl: "https://groble.im/t", active: true });
    expect(settings.COMPANY_SINGLE).toEqual({ contentId: "cmp001", paymentUrl: "", active: false });
    expect(settings.PREMIUM).toEqual({ contentId: null, paymentUrl: "", active: false });
  });

  it("drops the env fallback once a DB row already uses that content id (cutover)", async () => {
    const settings = await readPurchaseProductSettings(
      db([{ product: "STANDARD", grobleContentId: "4SGBV5", paymentUrl: "https://groble.im/t", active: true }]),
      ENV,
    );
    expect(settings.STANDARD.contentId).toBe("4SGBV5");
    expect(settings.TRIPLE.contentId).toBeNull();
    expect(contentIdsBySettings(settings)).toEqual({ SINGLE: "6HteWn", STANDARD: "4SGBV5" });
  });

  it("treats a blank DB content id as unset so the env fallback still applies", async () => {
    const settings = await readPurchaseProductSettings(
      db([{ product: "SINGLE", grobleContentId: "", paymentUrl: "https://groble.im/s", active: true }]),
      ENV,
    );
    expect(settings.SINGLE).toEqual({ contentId: "6HteWn", paymentUrl: "https://groble.im/s", active: true });
  });

  it("works without any env at all", async () => {
    const settings = await readPurchaseProductSettings(db([]), {});
    expect(contentIdsBySettings(settings)).toEqual({});
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run lib/entitlement-products.test.js`
Expected: FAIL.

- [ ] **Step 3: `lib/entitlement-products.js` 전체 교체**

```js
// 유료 이용권 상품 정의의 단일 정의처.
// 크레딧 수는 상품 정의의 일부라 배포 코드와 함께 바뀌어야 하므로 DB가 아닌 상수로 둔다.
// (금액은 Groble 상품 설정이 진실이고, 서버는 금액을 검증하지 않는다.)
// 상품별 Groble 연결(contentId·결제 URL·판매 여부)은 purchase_product_settings 테이블에서 읽는다.
// 티어: 베이직 = SINGLE(자소서 1) 또는 COMPANY_SINGLE(기업 1) / 스탠다드 = 자소서 2 + 기업 1 / 프리미엄 = 자소서 3 + 기업 3.
// TRIPLE(구 3회권)은 판매 종료 — 과거 기록 라벨과 전환기 지급을 위해 남긴다.
export const PURCHASE_PRODUCTS = Object.freeze({
  SINGLE: { resumeCredits: 1, companyCredits: 0 },
  COMPANY_SINGLE: { resumeCredits: 0, companyCredits: 1 },
  STANDARD: { resumeCredits: 2, companyCredits: 1 },
  PREMIUM: { resumeCredits: 3, companyCredits: 3 },
  TRIPLE: { resumeCredits: 3, companyCredits: 0 },
});

export const PURCHASE_PRODUCT_KEYS = Object.freeze(Object.keys(PURCHASE_PRODUCTS));

/** 구매 의도 쿼리스트링(?product=)과 GET /api/entitlements 의 checkoutUrls 키. 클라이언트 pricing.ts 와 같아야 한다. */
export const PRODUCT_QUERY_KEYS = Object.freeze({
  SINGLE: "single",
  COMPANY_SINGLE: "company",
  STANDARD: "standard",
  PREMIUM: "premium",
  TRIPLE: "triple",
});

const PRODUCT_BY_QUERY_KEY = Object.freeze(
  Object.fromEntries(Object.entries(PRODUCT_QUERY_KEYS).map(([product, key]) => [key, product])),
);

/**
 * 구매 의도 생성 쿼리스트링을 상품 키로 변환한다.
 * 파라미터가 없으면 구 클라이언트가 3회권 결제로 쓰던 경로를 승계한 STANDARD, 무효 값이면 null.
 */
export function parsePurchaseProductQuery(value) {
  if (value === undefined) {
    return "STANDARD";
  }

  return typeof value === "string" && Object.hasOwn(PRODUCT_BY_QUERY_KEY, value)
    ? PRODUCT_BY_QUERY_KEY[value]
    : null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * Groble contentId 를 상품 키로 바꾼다. 웹훅(지급 판단)과 관리자 화면(과거 기록 표시)이
 * 같은 규칙을 써야 하므로 여기 한 곳에 둔다. 등록되지 않은 contentId 는 null.
 */
export function resolveProductForContentId(contentId, contentIdByProduct = {}) {
  if (!isNonEmptyString(contentId)) {
    return null;
  }

  for (const product of PURCHASE_PRODUCT_KEYS) {
    const candidate = contentIdByProduct[product];
    if (isNonEmptyString(candidate) && candidate === contentId) {
      return product;
    }
  }

  return null;
}

/**
 * 저장된 결제 기록(payment_entitlements.raw_event)에서 상품을 읽는다.
 * 상품 구분이 생기기 전 기록에는 product 가 없어 contentId 로 되짚는다.
 * 어느 쪽으로도 알 수 없으면 지어내지 않고 null.
 */
export function resolveProductForPaymentRecord(rawEvent, contentIdByProduct) {
  if (rawEvent === null || typeof rawEvent !== "object") {
    return null;
  }

  if (Object.hasOwn(PURCHASE_PRODUCTS, rawEvent.product)) {
    return rawEvent.product;
  }

  return resolveProductForContentId(rawEvent.contentId, contentIdByProduct);
}

/**
 * 카탈로그 도입 전에는 env 로 contentId 를 관리했다(GROBLE_PREMIUM_CONTENT_ID = 구 3회권).
 * 행에 값이 없고, 그 값을 쓰는 다른 행도 없을 때만 fallback 으로 쓴다 — 관리자가 STANDARD 행에
 * 구 3회권 contentId 를 넣는 순간(컷오버) TRIPLE 대응이 사라져 2+1 지급으로 바뀐다.
 */
const LEGACY_CONTENT_ID_ENV = Object.freeze({
  SINGLE: "GROBLE_SINGLE_CONTENT_ID",
  TRIPLE: "GROBLE_PREMIUM_CONTENT_ID",
});

/**
 * 상품별 설정을 5상품 모두 채운 객체로 돌려준다. 행이 없는 상품은 팔지 않는 것으로 본다
 * (마이그레이션이 5행을 넣지만, 적용 전 배포·삭제된 행에도 화면이 깨지지 않게).
 */
export async function readPurchaseProductSettings(db, env = process.env) {
  const rows = await db.purchaseProductSetting.findMany();
  const rowByProduct = new Map(rows.map((row) => [row.product, row]));
  const usedContentIds = new Set(
    rows.map((row) => row.grobleContentId).filter((value) => isNonEmptyString(value)),
  );

  const settings = {};
  for (const product of PURCHASE_PRODUCT_KEYS) {
    const row = rowByProduct.get(product);
    const envName = LEGACY_CONTENT_ID_ENV[product];
    const legacyContentId = envName ? env?.[envName] : undefined;
    const fallback =
      isNonEmptyString(legacyContentId) && !usedContentIds.has(legacyContentId) ? legacyContentId : null;

    settings[product] = {
      contentId: isNonEmptyString(row?.grobleContentId) ? row.grobleContentId : fallback,
      paymentUrl: isNonEmptyString(row?.paymentUrl) ? row.paymentUrl : "",
      active: row?.active === true,
    };
  }
  return settings;
}

/** readPurchaseProductSettings 결과에서 contentId 가 있는 상품만 { product: contentId } 로 뽑는다. */
export function contentIdsBySettings(settings) {
  const contentIds = {};
  for (const product of PURCHASE_PRODUCT_KEYS) {
    const contentId = settings?.[product]?.contentId;
    if (isNonEmptyString(contentId)) {
      contentIds[product] = contentId;
    }
  }
  return contentIds;
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run lib/entitlement-products.test.js`
Expected: PASS.

- [ ] **Step 5: 실패하는 테스트 — `tests/api/groble-webhook-handler.test.js`**

파일을 먼저 읽는다. 다음을 바꾼다:

(a) `createHandler` 헬퍼(82-92행 근처)에서 `premiumContentId`·`singleContentId`를 지우고 `readProductSettings`를 넣는다:

```js
const CONTENT_ID = "4SGBV5";           // 기존 상수 유지 — 이제 STANDARD 의 contentId
const SINGLE_CONTENT_ID = "6HteWn";    // 기존 상수 유지(1회권)
const COMPANY_CONTENT_ID = "cmp001";
const PREMIUM_CONTENT_ID = "prm001";

function settingsWith(overrides = {}) {
  const base = {
    SINGLE: { contentId: SINGLE_CONTENT_ID, paymentUrl: "https://www.groble.im/payment/SINGLE", active: true },
    COMPANY_SINGLE: { contentId: COMPANY_CONTENT_ID, paymentUrl: "", active: false },
    STANDARD: { contentId: CONTENT_ID, paymentUrl: "https://www.groble.im/payment/4SGBV5", active: true },
    PREMIUM: { contentId: PREMIUM_CONTENT_ID, paymentUrl: "", active: false },
    TRIPLE: { contentId: null, paymentUrl: "", active: false },
  };
  return { ...base, ...overrides };
}

function createHandler(overrides = {}) {
  return createGrobleWebhookHandler({
    logger: mocks.logger,
    now: () => NOW,
    prismaClient: mocks.prisma,
    readProductSettings: async () => settingsWith(),
    webhookSecret: SECRET,
    ...overrides,
  });
}
```

(b) 기존 "grants the intent owner three credits for one valid signed premium payment"(CONTENT_ID 결제)는 이제 `STANDARD` 결제다 — 제목을 "grants two résumé credits and one company credit for a signed standard payment"로 바꾸고, `purchaseIntent.findUnique`가 `product: "STANDARD"`를 주게 하고, 지급 단언을 `expect.objectContaining({ resumeCredits: 2, companyCredits: 1 })`, 응답을 `{ ok: true, grantedCredits: 2, grantedCompanyCredits: 1 }`(mock `grantGroblePurchase`가 `{ granted: true, credits: 2, companyCredits: 1 }`을 주도록)로 바꾼다.

(c) "grants one credit for a signed single-plan payment": 지급 단언 `resumeCredits: 1, companyCredits: 0`, 응답에 `grantedCompanyCredits: 0`.

(d) "rejects a single-plan payment while GROBLE_SINGLE_CONTENT_ID is not configured" → 제목 "rejects a single-plan payment while its content id is not configured", `createHandler({ readProductSettings: async () => settingsWith({ SINGLE: { contentId: null, paymentUrl: "", active: false } }) })`, 기대 422 `UNEXPECTED_GROBLE_PRODUCT` 그대로.

(e) "acknowledges a repeated provider payment without granting credits twice"의 응답 단언에 `grantedCompanyCredits: 0` 추가.

(f) 새 테스트 3개(요청 빌더·서명 헬퍼는 파일의 실제 이름을 쓴다 — 아래 `signedRequest(bodyFor(...))`는 자리표시):

```js
  it("grants both pools for a premium payment and reports both counts", async () => {
    mocks.prisma.purchaseIntent.findUnique.mockResolvedValue({
      id: INTENT_ID, product: "PREMIUM", status: "PENDING", userId: USER_ID,
    });
    mocks.grantGroblePurchase.mockResolvedValue({ granted: true, credits: 3, companyCredits: 3 });

    const res = await invoke(createHandler(), signedRequest(bodyFor(PREMIUM_CONTENT_ID)));

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, grantedCredits: 3, grantedCompanyCredits: 3 });
    expect(mocks.grantGroblePurchase).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resumeCredits: 3, companyCredits: 3, userId: USER_ID }),
    );
  });

  it("grants only the company pool for a company-single payment", async () => {
    mocks.prisma.purchaseIntent.findUnique.mockResolvedValue({
      id: INTENT_ID, product: "COMPANY_SINGLE", status: "PENDING", userId: USER_ID,
    });
    mocks.grantGroblePurchase.mockResolvedValue({ granted: true, credits: 0, companyCredits: 1 });

    const res = await invoke(createHandler(), signedRequest(bodyFor(COMPANY_CONTENT_ID)));

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, grantedCredits: 0, grantedCompanyCredits: 1 });
    expect(mocks.grantGroblePurchase).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resumeCredits: 0, companyCredits: 1 }),
    );
  });

  it("reads product settings only after the signature is verified", async () => {
    const readProductSettings = vi.fn(async () => settingsWith());
    // 서명 훼손 방식과 기대 상태 코드는 "rejects an altered signature before opening a transaction" 과 같게.
    const res = await invoke(createHandler({ readProductSettings }), alteredSignatureRequest());

    expect(res.statusCode).toBe(EXPECTED_STATUS_OF_ALTERED_SIGNATURE);
    expect(readProductSettings).not.toHaveBeenCalled();
  });
```

- [ ] **Step 6: 실패 확인**

Run: `pnpm exec vitest run tests/api/groble-webhook-handler.test.js`
Expected: FAIL.

- [ ] **Step 7: `lib/groble-webhook-handler.js`**

import:

```js
import {
  PURCHASE_PRODUCTS,
  contentIdsBySettings,
  readPurchaseProductSettings,
  resolveProductForContentId,
} from "./entitlement-products.js";
```

`parseGroblePaidEvent`:

```js
export function parseGroblePaidEvent(body, contentIdByProduct = {}) {
  ...(MALFORMED_GROBLE_PAYLOAD / UNSUPPORTED_GROBLE_EVENT / MALFORMED_GROBLE_PAID_EVENT 검사는 그대로)...

  // 어떤 상품에도 contentId 가 없으면 설정이 안 된 것 — 코드명은 하위 호환으로 유지한다.
  if (Object.keys(contentIdByProduct).length === 0) {
    throw new GrobleWebhookError("GROBLE_PREMIUM_PRODUCT_NOT_CONFIGURED", 500);
  }

  const product = resolveProductForContentId(object.content.id, contentIdByProduct);
  if (!product) {
    throw new GrobleWebhookError("UNEXPECTED_GROBLE_PRODUCT", 422);
  }
  ...(이하 그대로)...
}
```

factory:

```js
export function createGrobleWebhookHandler({
  logger = console.warn,
  now = Date.now,
  prismaClient = prisma,
  readProductSettings = readPurchaseProductSettings,
  readRawBody = readGrobleRawBody,
  webhookSecret = process.env.GROBLE_WEBHOOK_SECRET,
} = {}) {
```

핸들러 본문 — 서명 검증 **다음**에 설정을 읽는다:

```js
      body = parseVerifiedGrobleWebhook({ headers: req.headers ?? {}, now: now(), rawBody, secret: webhookSecret });
      // 상품 판별표는 서명이 확인된 뒤에만 읽는다 — 미서명 요청이 DB 왕복을 일으키지 않게.
      const productSettings = await readProductSettings(prismaClient);
      event = parseGroblePaidEvent(body, contentIdsBySettings(productSettings));
```

조기 반환 두 곳을 `return { credits: 0, companyCredits: 0, granted: false };`로, 지급 호출을:

```js
        const split = PURCHASE_PRODUCTS[event.product];
        return grantGroblePurchase(tx, {
          resumeCredits: split.resumeCredits,
          companyCredits: split.companyCredits,
          providerPaymentId: event.providerPaymentId,
          rawEvent: event.rawEvent,
          userId: purchaseIntent.userId,
        });
```

응답:

```js
      return res.status(200).json({
        ok: true,
        grantedCredits: grant.credits,
        grantedCompanyCredits: grant.companyCredits ?? 0,
      });
```

`grep -rn "parseGroblePaidEvent\|premiumContentId\|singleContentId" lib api tests scripts`로 다른 호출자를 확인하고, 있으면 같은 시그니처로 맞춘다(보고서에 목록).

- [ ] **Step 8: 관리자 집계 호출부**

`lib/admin-handlers/dashboard.js`: import에 `PURCHASE_PRODUCT_KEYS, contentIdsBySettings, readPurchaseProductSettings` 추가, `summarizePayments(payments, todayStart, contentIds)`:

```js
function summarizePayments(payments, todayStart, contentIds) {
  const byProduct = Object.fromEntries([...PURCHASE_PRODUCT_KEYS, "UNKNOWN"].map((key) => [key, 0]));
  let today = 0;
  payments.forEach(({ createdAt, rawEvent }) => {
    byProduct[resolveProductForPaymentRecord(rawEvent, contentIds) ?? "UNKNOWN"] += 1;
    if (createdAt >= todayStart) today += 1;
  });
  return { total: payments.length, today, byProduct };
}
```

호출부에서 `const contentIds = contentIdsBySettings(await readPurchaseProductSettings(prisma));`(기존 `Promise.all`이 있으면 그 안에)로 얻어 넘긴다. `process.env.GROBLE_*` 직접 참조는 지운다.

`lib/admin-handlers/user-detail.js`: `contentIds` 객체를 `const contentIds = contentIdsBySettings(await readPurchaseProductSettings(prisma));`로.

테스트 `tests/api/admin/dashboard-payments.test.js`: hoisted prisma mock에 `purchaseProductSetting: { findMany: vi.fn() }` 추가, `beforeEach`에서 `mockResolvedValue([])`(env fallback 경로로 기존 기대 유지). `byProduct` 기대 리터럴을 `{ SINGLE: 1, COMPANY_SINGLE: 0, STANDARD: 0, PREMIUM: 0, TRIPLE: 2, UNKNOWN: 0 }` / 전부 0으로 바꾼다(기존 픽스처의 `GROBLE_PREMIUM_CONTENT_ID` 결제 2건은 env fallback으로 `TRIPLE`). 새 케이스: `findMany`가 `[{ product: "STANDARD", grobleContentId: <GROBLE_PREMIUM_CONTENT_ID 와 같은 값>, paymentUrl: "", active: true }]`를 주면 같은 결제 2건이 `STANDARD: 2, TRIPLE: 0`으로 세어진다(컷오버 후 표시). `tests/api/admin/user-detail.test.js`가 있으면 같은 mock 추가.

- [ ] **Step 9: 통과 확인**

Run: `pnpm exec vitest run lib/entitlement-products.test.js tests/api/groble-webhook-handler.test.js tests/api/admin lib/analysis-entitlements.test.js`
Expected: PASS 전부.

- [ ] **Step 10: 커밋**

```bash
git add lib/entitlement-products.js lib/entitlement-products.test.js lib/groble-webhook-handler.js tests/api/groble-webhook-handler.test.js lib/admin-handlers/dashboard.js lib/admin-handlers/user-detail.js tests/api/admin/dashboard-payments.test.js
git commit -m "feat(products): catalog the tier products, read per-product Groble settings, and grant bundles from the webhook"
```

---

### Task 3: `GET /api/entitlements`의 `checkoutUrls`와 상품별 구매 의도 게이트

**Files:**
- Modify: `api/entitlements.js` (import 6행, `getEntitlements` 58-79행, `createPurchaseIntent` 84-120행)
- Test: `tests/api/entitlements.test.js`

**Interfaces:**
- Consumes: Task 2의 `PURCHASE_PRODUCTS`, `PURCHASE_PRODUCT_KEYS`, `PRODUCT_QUERY_KEYS`, `parsePurchaseProductQuery`, `readPurchaseProductSettings(prisma)`.
- Produces: `GET /api/entitlements` 응답에 `checkoutUrls: { single, company, standard, premium, triple }`(각 `string|null`) 가산. `groblePaymentUrl = checkoutUrls.standard`, `grobleSinglePaymentUrl = checkoutUrls.single`(하위 호환). `POST …/purchase-intents?product=<키>`: 400 `INVALID_PURCHASE_PRODUCT` → 403 `PREMIUM_SALES_DISABLED` → 403 `COMPANY_SALES_DISABLED` → 503 `PREMIUM_CHECKOUT_NOT_CONFIGURED` → 201.

- [ ] **Step 1: 실패하는 테스트 — `tests/api/entitlements.test.js`**

(a) hoisted `prisma` mock에 `purchaseProductSetting: { findMany: vi.fn() }` 추가. 상수 추가: `const COMPANY_CHECKOUT_URL = "https://www.groble.im/payment/COMPANY";`, `const PREMIUM_CHECKOUT_URL = "https://www.groble.im/payment/PREMIUM";`. `beforeEach`:

```js
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: false, companyAnalysisEnabled: false });
    mocks.prisma.purchaseProductSetting.findMany.mockResolvedValue([
      { product: "SINGLE", grobleContentId: "6HteWn", paymentUrl: SINGLE_CHECKOUT_URL, active: true },
      { product: "COMPANY_SINGLE", grobleContentId: "cmp001", paymentUrl: COMPANY_CHECKOUT_URL, active: true },
      { product: "STANDARD", grobleContentId: "4SGBV5", paymentUrl: CHECKOUT_URL, active: true },
      { product: "PREMIUM", grobleContentId: "prm001", paymentUrl: PREMIUM_CHECKOUT_URL, active: true },
      { product: "TRIPLE", grobleContentId: null, paymentUrl: "", active: false },
    ]);
```

스위치를 켜는 테스트는 `findUnique`를 `{ premiumEnabled: true, companyAnalysisEnabled: <케이스별> }`로 덮는다. `findUnique` 반환값에 URL 컬럼을 넣던 곳은 모두 제거한다.

(b) 기존 테스트 수정:
- "exposes the checkout URLs only while premium sales are enabled": 켜졌을 때(`companyAnalysisEnabled: false`) `checkoutUrls`가 `{ single: SINGLE_CHECKOUT_URL, company: null, standard: CHECKOUT_URL, premium: null, triple: null }`, `groblePaymentUrl === CHECKOUT_URL`, `grobleSinglePaymentUrl === SINGLE_CHECKOUT_URL`; 꺼졌을 때 전부 null.
- "hides an unconfigured single-plan checkout URL even while sales are enabled": SINGLE 행 `paymentUrl: ""`로 덮고 `checkoutUrls.single === null`, `grobleSinglePaymentUrl === null`.
- "creates a purchase intent for the token user and stamps its id on the checkout URL"(product 없음): `purchaseIntent.create`가 `product: "STANDARD"`로 호출되고 `checkoutUrl`이 `CHECKOUT_URL?ref=…`.
- "refuses purchase intents when no checkout URL is configured": STANDARD 행 `paymentUrl: ""` → 503.
- "refuses a single-plan purchase while its checkout URL is unconfigured": SINGLE 행 `paymentUrl: ""` → 503.
- 나머지 구매 의도 테스트는 `findUnique`가 `premiumEnabled: true`를 주도록만 바꾼다.

(c) 새 테스트:

```js
  it("exposes company product checkout URLs only while the company analysis switch is on", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true, companyAnalysisEnabled: true });

    const response = await invokeEntitlements();

    expect(response.statusCode).toBe(200);
    expect(response.body.checkoutUrls).toEqual({
      single: SINGLE_CHECKOUT_URL,
      company: COMPANY_CHECKOUT_URL,
      standard: CHECKOUT_URL,
      premium: PREMIUM_CHECKOUT_URL,
      triple: null, // 판매 종료(행 비활성·URL 없음)
    });
  });

  it("hides the standard tier while the company analysis switch is off because it includes a company credit", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true, companyAnalysisEnabled: false });

    const response = await invokeEntitlements();

    expect(response.body.checkoutUrls.standard).toBeNull();
    expect(response.body.groblePaymentUrl).toBeNull();
  });

  it("refuses a premium purchase while the company analysis switch is off", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true, companyAnalysisEnabled: false });

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?product=premium",
      query: { product: "premium" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: "COMPANY_SALES_DISABLED" });
    expect(mocks.prisma.purchaseIntent.create).not.toHaveBeenCalled();
  });

  it("creates a company-single purchase intent against its own checkout URL", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true, companyAnalysisEnabled: true });

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?product=company",
      query: { product: "company" },
    });

    expect(response.statusCode).toBe(201);
    expect(mocks.prisma.purchaseIntent.create).toHaveBeenCalledWith({
      data: { product: "COMPANY_SINGLE", status: "PENDING", userId: mocks.authenticatedUser.id },
    });
    expect(response.body).toEqual({ purchaseIntentId: INTENT_ID, checkoutUrl: `${COMPANY_CHECKOUT_URL}?ref=${INTENT_ID}` });
  });

  it("refuses the retired triple product even when sales are on", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true, companyAnalysisEnabled: true });

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?product=triple",
      query: { product: "triple" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({ error: "PREMIUM_CHECKOUT_NOT_CONFIGURED" });
  });
```

**주의(스탠다드와 기업 스위치)**: 스탠다드는 기업 크레딧 1이 포함되므로 `companyAnalysisEnabled`가 꺼져 있으면 팔리지 않는다. 배포 직후 기업 스위치가 꺼진 동안 스탠다드(구 3회권 승계)가 잠깐 안 팔리는 셈이다. **Ruling**: 스펙 §7-3 컷오버 절차대로 배포 직후 관리자가 기업 스위치를 켠다(2단계까지 배포된 지금도 관리자 QA가 끝나 켤 수 있는 상태). 쓸 수 없는 크레딧을 파는 것보다 잠깐 안 파는 쪽이 옳다. 이 사실을 완료 보고에 적는다.

(기존 테스트가 `query`를 넘기는 방식을 그대로 따른다.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run tests/api/entitlements.test.js`
Expected: FAIL.

- [ ] **Step 3: `api/entitlements.js`**

import:

```js
import {
  PRODUCT_QUERY_KEYS,
  PURCHASE_PRODUCTS,
  PURCHASE_PRODUCT_KEYS,
  parsePurchaseProductQuery,
  readPurchaseProductSettings,
} from "../lib/entitlement-products.js";
```

`SETTINGS_ID` 아래:

```js
const SWITCH_SELECT = { premiumEnabled: true, companyAnalysisEnabled: true };

/**
 * 상품 하나의 결제 URL. 전체 판매 스위치 → (기업 크레딧 포함 상품이면) 기업 분석 스위치 →
 * 상품 행의 active 와 URL 순으로 닫힌다. 닫혀 있으면 null.
 */
function checkoutUrlFor(product, productSettings, switches) {
  if (!switches?.premiumEnabled) return null;
  if (PURCHASE_PRODUCTS[product].companyCredits > 0 && !switches.companyAnalysisEnabled) return null;
  const setting = productSettings[product];
  return setting.active && setting.paymentUrl ? setting.paymentUrl : null;
}

function checkoutUrlsFor(productSettings, switches) {
  return Object.fromEntries(
    PURCHASE_PRODUCT_KEYS.map((product) => [PRODUCT_QUERY_KEYS[product], checkoutUrlFor(product, productSettings, switches)]),
  );
}
```

`getEntitlements`:

```js
async function getEntitlements(res, user) {
  // 표시용 조회라 잠금 트랜잭션 대신 조회 전용 요약을 쓴다 — 왕복이 병렬화되어 빠르다.
  const [summary, switches, productSettings, feedbackRewardClaimed] = await Promise.all([
    getEntitlementSummaryReadOnly(prisma, user.id),
    prisma.entitlementSetting.findUnique({ where: { id: SETTINGS_ID }, select: SWITCH_SELECT }),
    readPurchaseProductSettings(prisma),
    hasClaimedFeedbackReward(prisma, user.id),
  ]);
  const checkoutUrls = checkoutUrlsFor(productSettings, switches);

  return res.status(200).json({
    ...summary,
    // 구버전 클라이언트 호환: 두 필드는 "3회권(→스탠다드)"·"1회권" URL 의미를 유지한다.
    groblePaymentUrl: checkoutUrls.standard,
    grobleSinglePaymentUrl: checkoutUrls.single,
    checkoutUrls,
    feedbackRewardClaimed,
  });
}
```

`createPurchaseIntent`의 설정 조회·게이트:

```js
  const [switches, productSettings] = await Promise.all([
    prisma.entitlementSetting.findUnique({ where: { id: SETTINGS_ID }, select: SWITCH_SELECT }),
    readPurchaseProductSettings(prisma),
  ]);

  if (!switches?.premiumEnabled) {
    return res.status(403).json({ error: "PREMIUM_SALES_DISABLED" });
  }

  // 기업 분석 크레딧이 든 상품은 기업 분석 스위치가 켜져야 판다 — 쓸 수 없는 크레딧을 팔지 않는다.
  if (PURCHASE_PRODUCTS[product].companyCredits > 0 && !switches.companyAnalysisEnabled) {
    return res.status(403).json({ error: "COMPANY_SALES_DISABLED" });
  }

  const paymentUrl = checkoutUrlFor(product, productSettings, switches);
  if (!paymentUrl) {
    return res.status(503).json({ error: "PREMIUM_CHECKOUT_NOT_CONFIGURED" });
  }
```

이하(구매 의도 생성·`ref` 스탬프·201)는 그대로. `TODO(유료 오픈)` 주석은 지우지 않는다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run tests/api/entitlements.test.js tests/api/protected-user-routes.test.js`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add api/entitlements.js tests/api/entitlements.test.js
git commit -m "feat(entitlements): expose per-product checkout URLs and gate company products behind the company switch"
```

---

### Task 4: 관리자 상품 설정 엔드포인트 `/api/admin/product-settings`

**Files:**
- Create: `lib/admin-handlers/product-settings.js`
- Modify: `api/admin/[...route].js` (import + `DEFAULT_HANDLERS`에 `"product-settings"` 키)
- Test: `tests/api/admin/product-settings.test.js`, `scripts/vercel-function-limit.test.js`(변경 없음, 실행만)

**Interfaces:**
- Consumes: Task 2의 `PURCHASE_PRODUCT_KEYS`, `PURCHASE_PRODUCTS`, `readPurchaseProductSettings`; `prisma.purchaseProductSetting.upsert`.
- Produces:
  - `GET /api/admin/product-settings` → `{ products: [{ product, contentId: string|null, paymentUrl: string, active: boolean, resumeCredits, companyCredits }] }` 5개, `PURCHASE_PRODUCT_KEYS` 순서.
  - `PATCH /api/admin/product-settings` body `{ product, contentId?: string|null, paymentUrl?: string, active?: boolean }` → 같은 목록. 400 `INVALID_PRODUCT_SETTING`, 409 `DUPLICATE_CONTENT_ID`(Prisma `P2002`).
  - 관리자 클라이언트 경로: `"/api/admin/product-settings"`.

- [ ] **Step 1: 실패하는 테스트 — `tests/api/admin/product-settings.test.js`**

```js
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: { purchaseProductSetting: { findMany: vi.fn(), upsert: vi.fn() } },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({ requireAdministrator: mocks.requireAdministrator }));
vi.mock("../../../lib/prisma.js", () => ({ default: mocks.prisma }));

const { default: handler } = await import("../../../lib/admin-handlers/product-settings.js");

function response() {
  return {
    body: undefined,
    statusCode: 200,
    json(payload) { this.body = payload; return this; },
    status(statusCode) { this.statusCode = statusCode; return this; },
  };
}

async function invoke({ body, method = "GET" } = {}) {
  const res = response();
  await handler({ body, headers: { authorization: "Bearer admin-token" }, method, url: "/api/admin/product-settings" }, res);
  return res;
}

const ROWS = [
  { product: "STANDARD", grobleContentId: "4SGBV5", paymentUrl: "https://www.groble.im/payment/4SGBV5", active: true },
  { product: "COMPANY_SINGLE", grobleContentId: null, paymentUrl: "", active: false },
];

describe("admin product settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GROBLE_PREMIUM_CONTENT_ID", "4SGBV5");
    vi.stubEnv("GROBLE_SINGLE_CONTENT_ID", "env-single");
    mocks.requireAdministrator.mockResolvedValue({ applicationUser: { id: "11111111-1111-4111-8111-111111111111", role: "admin" } });
    mocks.prisma.purchaseProductSetting.findMany.mockResolvedValue(ROWS);
    mocks.prisma.purchaseProductSetting.upsert.mockResolvedValue({});
  });

  it("lists every product with its settings, credit split, and env fallback content id", async () => {
    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(res.body.products.map((row) => row.product)).toEqual(["SINGLE", "COMPANY_SINGLE", "STANDARD", "PREMIUM", "TRIPLE"]);
    expect(res.body.products[0]).toEqual({ product: "SINGLE", contentId: "env-single", paymentUrl: "", active: false, resumeCredits: 1, companyCredits: 0 });
    expect(res.body.products[2]).toEqual({ product: "STANDARD", contentId: "4SGBV5", paymentUrl: "https://www.groble.im/payment/4SGBV5", active: true, resumeCredits: 2, companyCredits: 1 });
    // 구 3회권 env contentId 는 STANDARD 행이 이미 쓰므로 TRIPLE 에는 붙지 않는다(컷오버 완료 상태).
    expect(res.body.products[4]).toEqual({ product: "TRIPLE", contentId: null, paymentUrl: "", active: false, resumeCredits: 3, companyCredits: 0 });
  });

  it("upserts one product's settings from a PATCH and returns the refreshed list", async () => {
    const res = await invoke({ method: "PATCH", body: { product: "PREMIUM", contentId: "prm001", paymentUrl: "https://www.groble.im/payment/PRM", active: true } });

    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.purchaseProductSetting.upsert).toHaveBeenCalledWith({
      where: { product: "PREMIUM" },
      create: { product: "PREMIUM", grobleContentId: "prm001", paymentUrl: "https://www.groble.im/payment/PRM", active: true },
      update: { grobleContentId: "prm001", paymentUrl: "https://www.groble.im/payment/PRM", active: true },
    });
    expect(res.body.products).toHaveLength(5);
  });

  it("clears a content id with null and trims whitespace", async () => {
    await invoke({ method: "PATCH", body: { product: "STANDARD", contentId: null, paymentUrl: "  https://www.groble.im/payment/X  " } });

    expect(mocks.prisma.purchaseProductSetting.upsert).toHaveBeenCalledWith({
      where: { product: "STANDARD" },
      create: { product: "STANDARD", grobleContentId: null, paymentUrl: "https://www.groble.im/payment/X" },
      update: { grobleContentId: null, paymentUrl: "https://www.groble.im/payment/X" },
    });
  });

  it("rejects an unknown product, an empty patch, and a non-http payment URL", async () => {
    for (const body of [
      { product: "GOLD", active: true },
      { product: "SINGLE" },
      { product: "SINGLE", paymentUrl: "javascript:alert(1)" },
      { product: "SINGLE", active: "yes" },
      { product: "SINGLE", contentId: "x".repeat(65) },
      { product: "SINGLE", contentId: "   " },
    ]) {
      const res = await invoke({ method: "PATCH", body });
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "INVALID_PRODUCT_SETTING" });
    }
    expect(mocks.prisma.purchaseProductSetting.upsert).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint clash on the content id to 409", async () => {
    mocks.prisma.purchaseProductSetting.upsert.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));

    const res = await invoke({ method: "PATCH", body: { product: "PREMIUM", contentId: "4SGBV5" } });

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: "DUPLICATE_CONTENT_ID" });
  });

  it("refuses non-administrators before touching settings", async () => {
    // 거부 에러 객체는 tests/api/admin/entitlements.test.js 의 같은 케이스에서 복사한다.
    mocks.requireAdministrator.mockRejectedValue(FORBIDDEN_ERROR_FROM_ENTITLEMENTS_TEST);

    const res = await invoke();

    expect(res.statusCode).toBe(403);
    expect(mocks.prisma.purchaseProductSetting.findMany).not.toHaveBeenCalled();
  });

  it("answers other methods with the documented 405", async () => {
    const res = await invoke({ method: "DELETE" });
    expect(res.statusCode).toBe(405);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run tests/api/admin/product-settings.test.js`
Expected: FAIL (모듈 없음).

- [ ] **Step 3: `lib/admin-handlers/product-settings.js`**

```js
import { requireAdministrator } from "../auth.js";
import { PURCHASE_PRODUCTS, PURCHASE_PRODUCT_KEYS, readPurchaseProductSettings } from "../entitlement-products.js";
import prisma from "../prisma.js";
import { handleRequestError, requestIdFor, sendMethodNotAllowed } from "../request-errors.js";

const MAX_CONTENT_ID_LENGTH = 64;
const MAX_PAYMENT_URL_LENGTH = 500;

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * PATCH 본문 → upsert 데이터. 최소 한 필드가 있어야 하고, 각 필드는 타입·형식·길이를 검사한다.
 * contentId 는 null 로 지울 수 있고, paymentUrl 은 "" 로 지운다. 무효면 null.
 */
function parsePatchBody(body) {
  if (body === null || typeof body !== "object" || !PURCHASE_PRODUCT_KEYS.includes(body.product)) {
    return null;
  }

  const data = {};
  if ("contentId" in body) {
    if (body.contentId === null) {
      data.grobleContentId = null;
    } else if (typeof body.contentId === "string") {
      const trimmed = body.contentId.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_CONTENT_ID_LENGTH) return null;
      data.grobleContentId = trimmed;
    } else {
      return null;
    }
  }
  if ("paymentUrl" in body) {
    if (typeof body.paymentUrl !== "string") return null;
    const trimmed = body.paymentUrl.trim();
    if (trimmed.length > MAX_PAYMENT_URL_LENGTH || (trimmed.length > 0 && !isHttpUrl(trimmed))) return null;
    data.paymentUrl = trimmed;
  }
  if ("active" in body) {
    if (typeof body.active !== "boolean") return null;
    data.active = body.active;
  }

  return Object.keys(data).length === 0 ? null : { product: body.product, data };
}

async function listProducts() {
  const settings = await readPurchaseProductSettings(prisma);
  return {
    products: PURCHASE_PRODUCT_KEYS.map((product) => ({ product, ...settings[product], ...PURCHASE_PRODUCTS[product] })),
  };
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);

  try {
    await requireAdministrator(req, prisma);

    if (req.method === "GET") {
      return res.status(200).json(await listProducts());
    }

    if (req.method === "PATCH") {
      const patch = parsePatchBody(req.body);
      if (!patch) {
        return res.status(400).json({ error: "INVALID_PRODUCT_SETTING" });
      }

      try {
        await prisma.purchaseProductSetting.upsert({
          where: { product: patch.product },
          create: { product: patch.product, ...patch.data },
          update: patch.data,
        });
      } catch (error) {
        if (error?.code === "P2002") {
          return res.status(409).json({ error: "DUPLICATE_CONTENT_ID" });
        }
        throw error;
      }

      return res.status(200).json(await listProducts());
    }

    return sendMethodNotAllowed(res, requestId);
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/product-settings");
  }
}
```

`api/admin/[...route].js`: `import productSettingsHandler from "../../lib/admin-handlers/product-settings.js";`(알파벳 순 자리)와 `DEFAULT_HANDLERS`에 `"product-settings": productSettingsHandler,`(`prompt-detail` 앞).

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run tests/api/admin scripts/vercel-function-limit.test.js`
Expected: PASS(함수 수 12 유지).

- [ ] **Step 5: 커밋**

```bash
git add lib/admin-handlers/product-settings.js "api/admin/[...route].js" tests/api/admin/product-settings.test.js
git commit -m "feat(admin): manage per-product Groble settings through the admin router"
```

---

### Task 5: 클라이언트 가격·요약 파서·체크아웃 키

**Files:**
- Modify: `client/src/lib/pricing.ts` (전체 교체), `client/src/lib/pricing.test.ts`
- Modify: `client/src/lib/entitlements.ts` (타입 1-16행, `parseEntitlementSummary` 51-97행), `client/src/lib/entitlements.test.ts`
- Modify: `client/src/pages/Checkout.tsx` (14행 `PRODUCT_KEYS`), `client/src/pages/Checkout.test.tsx`

**Interfaces:**
- Produces (`pricing.ts`):
  - `PURCHASE_PRODUCT_KEYS = ["single", "company", "standard", "premium", "triple"] as const`, `type PurchaseProductKey`.
  - `PricingPlan` + `companyUses: number`; `PRICING: Record<PurchaseProductKey, PricingPlan>`.
  - `type PurchaseProduct = "SINGLE" | "COMPANY_SINGLE" | "STANDARD" | "PREMIUM" | "TRIPLE"`, `PRODUCT_KEY_BY_PRODUCT`, `productLabel`, `estimatedAmountFor`(기존 시그니처 유지).
  - `TIERS: readonly [{ key: "basic", label: "베이직", products: ["single", "company"] }, { key: "standard", …, products: ["standard"] }, { key: "premium", …, products: ["premium"] }]`.
  - `savingsFor(plan)`, `COMPANY_REPORT_INCLUDED_FEATURES`, 기존 `TRIPLE_PER_USE_PRICE`·`SEASONAL_DISCOUNT_LABEL`·`REPORT_INCLUDED_FEATURES`·`formatKrw` 유지.
- Produces (`entitlements.ts`): `EntitlementSummary.checkoutUrls: Record<PurchaseProductKey, string | null>`; `export type { PurchaseProductKey } from "./pricing"`.
- Produces (`Checkout.tsx`): `?product=` 5키 허용.

- [ ] **Step 1: 실패하는 테스트 — `client/src/lib/pricing.test.ts`에 추가**

기존 테스트는 유지한다(`productLabel("TRIPLE") === "3회권"` 등이 있으면 그대로 통과해야 한다). 다음 `describe`를 추가:

```ts
describe("tier pricing", () => {
  it("keeps every tier's unit price falling as the tier rises", () => {
    const unit = (key: PurchaseProductKey) => {
      const plan = PRICING[key];
      return plan.salePrice / (plan.uses + plan.companyUses);
    };
    expect(unit("single")).toBe(5_900);
    expect(unit("company")).toBe(5_900);
    expect(unit("standard")).toBeLessThan(unit("single"));
    expect(unit("premium")).toBeLessThan(unit("standard"));
  });

  it("prices bundles against the basic unit price so the savings claim is honest", () => {
    const basic = PRICING.single.salePrice;
    expect(PRICING.standard.listPrice).toBe(basic * (PRICING.standard.uses + PRICING.standard.companyUses));
    expect(PRICING.premium.listPrice).toBe(basic * (PRICING.premium.uses + PRICING.premium.companyUses));
    expect(savingsFor(PRICING.standard)).toBe(2_800);
    expect(savingsFor(PRICING.premium)).toBe(9_500);
    expect(PRICING.standard.discountLabel).toBe("2,800원 절약");
    expect(PRICING.premium.discountLabel).toBe("9,500원 절약");
  });

  it("gives the company single no strikethrough price", () => {
    expect(PRICING.company.listPrice).toBe(PRICING.company.salePrice);
    expect(PRICING.company.discountLabel).toBe("");
  });

  it("maps server product keys to pricing keys and labels", () => {
    expect(PRODUCT_KEY_BY_PRODUCT).toEqual({ SINGLE: "single", COMPANY_SINGLE: "company", STANDARD: "standard", PREMIUM: "premium", TRIPLE: "triple" });
    expect(productLabel("STANDARD")).toBe("스탠다드");
    expect(productLabel("PREMIUM")).toBe("프리미엄");
    expect(productLabel("COMPANY_SINGLE")).toBe("기업 분석 1회");
    expect(estimatedAmountFor("PREMIUM")).toBe(25_900);
  });

  it("lists the tiers in ascending order with the basic tier offering a choice", () => {
    expect(TIERS.map((tier) => tier.key)).toEqual(["basic", "standard", "premium"]);
    expect(TIERS[0].products).toEqual(["single", "company"]);
    expect(PURCHASE_PRODUCT_KEYS).toEqual(["single", "company", "standard", "premium", "triple"]);
  });
});
```

import에 `PRODUCT_KEY_BY_PRODUCT, PURCHASE_PRODUCT_KEYS, TIERS, savingsFor, type PurchaseProductKey`를 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run client/src/lib/pricing.test.ts`
Expected: FAIL.

- [ ] **Step 3: `client/src/lib/pricing.ts` 전체 교체**

```ts
// 이용권 가격 표시의 단일 정의처. 랜딩(PricingSection)과 이용권 페이지(Entitlements)가 공유한다.
// 실제 결제 금액은 Groble 상품 설정이 진실이므로, 여기 값을 바꿀 땐 Groble 상품 가격도 함께 맞춘다.
// 티어(스펙 §7-3): 베이직 5,900(자소서 1 또는 기업 1) → 스탠다드 14,900(자소서 2 + 기업 1) → 프리미엄 25,900(자소서 3 + 기업 3).

/** 서버 쿼리 키(lib/entitlement-products.js PRODUCT_QUERY_KEYS)와 같다. checkoutUrls 의 키이기도 하다. */
export const PURCHASE_PRODUCT_KEYS = ["single", "company", "standard", "premium", "triple"] as const;
export type PurchaseProductKey = (typeof PURCHASE_PRODUCT_KEYS)[number];

export type PricingPlan = {
  /** 카드·버튼 라벨 */
  label: string;
  /** 정가 또는 "따로 살 때"(번들) 가격(원) — 취소선으로 표기. 판매가와 같으면 취소선 없음 */
  listPrice: number;
  /** 판매가(원) */
  salePrice: number;
  /** 할인·절약 배지 문구. 빈 문자열이면 배지 없음 */
  discountLabel: string;
  /** 자소서 분석 횟수 */
  uses: number;
  /** 기업 분석 횟수 */
  companyUses: number;
};

export const PRICING: Record<PurchaseProductKey, PricingPlan> = {
  single: {
    label: "자소서 진단 1회",
    listPrice: 9_900,
    salePrice: 5_900,
    discountLabel: "40% 할인",
    uses: 1,
    companyUses: 0,
  },
  company: {
    label: "기업 분석 1회",
    listPrice: 5_900,
    salePrice: 5_900,
    discountLabel: "",
    uses: 0,
    companyUses: 1,
  },
  standard: {
    label: "스탠다드",
    listPrice: 17_700,
    salePrice: 14_900,
    discountLabel: "2,800원 절약",
    uses: 2,
    companyUses: 1,
  },
  premium: {
    label: "프리미엄",
    listPrice: 35_400,
    salePrice: 25_900,
    discountLabel: "9,500원 절약",
    uses: 3,
    companyUses: 3,
  },
  // 판매 종료. 과거 결제 기록의 라벨·추정 금액에만 쓴다.
  triple: {
    label: "3회권",
    listPrice: 29_700,
    salePrice: 14_900,
    discountLabel: "약 50% 할인",
    uses: 3,
    companyUses: 0,
  },
};

/** 티어 카드 순서. 베이직은 상품 둘 중 하나를 고른다. */
export const TIERS = [
  { key: "basic", label: "베이직", products: ["single", "company"] },
  { key: "standard", label: "스탠다드", products: ["standard"] },
  { key: "premium", label: "프리미엄", products: ["premium"] },
] as const;

/** 스탠다드 기준 회당 가격(원, 14,900 / 3회). 반올림 값이며 pricing.test.ts가 산술 일치를 검증한다. */
export const TRIPLE_PER_USE_PRICE = 4_967;

export const SEASONAL_DISCOUNT_LABEL = "하반기 채용 시즌 기념 할인";

/**
 * 어떤 이용권이든 자소서 리포트에 공통으로 담기는 구성.
 * 실제 리포트 섹션(shared/prompts/reportPrompt.js·ReportShowcase)과 일치해야 한다 — 과장 금지.
 */
export const REPORT_INCLUDED_FEATURES = [
  "지원 기업의 채용 기준 분석",
  "채용 담당자 시선의 첫인상 진단",
  "강점과 보완점 핵심 진단",
  "원문 문장별 첨삭 피드백",
  "면접 예상 질문과 모범 답변 가이드",
  "합격 확률을 높이는 액션 플랜",
];

/** 기업 분석 리포트 구성(companyReportNavigation.ts 의 9섹션과 일치해야 한다 — 과장 금지). */
export const COMPANY_REPORT_INCLUDED_FEATURES = [
  "무엇을 팔아 돈을 버는지와 요즘 힘을 싣는 사업",
  "매출·이익·주가 흐름과 최근 1년 주요 이슈",
  "지원 직무가 하는 일과 직무 관련 최신 소식",
  "자소서에 쓸 사업 소재와 면접 예상 질문",
  "출처 링크가 붙은 부록",
];

export function formatKrw(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function savingsFor(plan: PricingPlan): number {
  return plan.listPrice - plan.salePrice;
}

/** 서버가 쓰는 상품 키(lib/entitlement-products.js). 상품을 알 수 없는 결제는 null. */
export type PurchaseProduct = "SINGLE" | "COMPANY_SINGLE" | "STANDARD" | "PREMIUM" | "TRIPLE";

export const PRODUCT_KEY_BY_PRODUCT: Record<PurchaseProduct, PurchaseProductKey> = {
  SINGLE: "single",
  COMPANY_SINGLE: "company",
  STANDARD: "standard",
  PREMIUM: "premium",
  TRIPLE: "triple",
};

export function productLabel(product: PurchaseProduct | null): string {
  return product ? PRICING[PRODUCT_KEY_BY_PRODUCT[product]].label : "–";
}

/**
 * 결제 금액은 저장되지 않으므로(금액의 진실은 Groble) 현재 판매가로 되짚는다.
 * 가격을 바꾸면 과거 결제도 새 가격으로 보이니, 화면에는 반드시 '추정'으로 표기한다.
 */
export function estimatedAmountFor(product: PurchaseProduct | null): number | null {
  return product ? PRICING[PRODUCT_KEY_BY_PRODUCT[product]].salePrice : null;
}
```

기존 `pricing.test.ts`의 "names the server product keys in Korean"이 `productLabel("SINGLE") === "1회권"`을 기대하면 `"자소서 진단 1회"`로 고친다(라벨 변경은 의도). 그 외 기존 산술 테스트(40%·50%·`TRIPLE_PER_USE_PRICE`·`single.listPrice * triple.uses`)는 값이 그대로라 통과한다.

- [ ] **Step 4: `client/src/lib/entitlements.ts`**

타입·재수출:

```ts
import { PURCHASE_PRODUCT_KEYS, type PurchaseProductKey } from "./pricing";

export type { PurchaseProductKey };

export type EntitlementSummary = {
  premiumEnabled: boolean;
  freeRemaining: number;
  premiumRemaining: number;
  remaining: number;
  groblePaymentUrl: string | null;
  grobleSinglePaymentUrl: string | null;
  /** 상품 키별 결제 URL. 판매 스위치·상품 활성·URL 이 모두 갖춰진 상품만 문자열, 나머지 null. */
  checkoutUrls: Record<PurchaseProductKey, string | null>;
  feedbackRewardClaimed: boolean;
  companyAnalysisEnabled: boolean;
  companyRemaining: number;
};
```

기존 `export type PurchaseProductKey = "single" | "triple";` 줄은 지운다. `parseEntitlementSummary`에 `checkoutUrls` 파싱을 추가한다(`readNonNegativeInteger` 아래에 헬퍼):

```ts
function readCheckoutUrl(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new EntitlementApiError(`Invalid ${field} response`);
  }
  return value;
}

/** 구버전 서버 응답(checkoutUrls 없음)은 두 URL 필드로 1회권·스탠다드만 채우고 나머지는 닫힌 것으로 본다. */
function readCheckoutUrls(payload: Record<string, unknown>): Record<PurchaseProductKey, string | null> {
  const source = isRecord(payload.checkoutUrls) ? payload.checkoutUrls : null;
  const urls = {} as Record<PurchaseProductKey, string | null>;
  for (const key of PURCHASE_PRODUCT_KEYS) {
    urls[key] = source ? readCheckoutUrl(source[key], `checkoutUrls.${key}`) : null;
  }
  if (!source) {
    urls.single = readCheckoutUrl(payload.grobleSinglePaymentUrl, "grobleSinglePaymentUrl");
    urls.standard = readCheckoutUrl(payload.groblePaymentUrl, "groblePaymentUrl");
  }
  return urls;
}
```

반환 객체에 `checkoutUrls: readCheckoutUrls(payload),`를 `grobleSinglePaymentUrl` 다음 줄에 넣는다.

`client/src/lib/entitlements.test.ts`: 기존 "returns the server-provided credit counts…" 기대 객체에 `checkoutUrls: { single: null, company: null, standard: null, premium: null, triple: null }`을 추가한다(다른 `toEqual` 기대에도 같은 키 추가). 새 케이스 2개:

```ts
  it("reads per-product checkout URLs and treats missing keys as closed", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        premiumEnabled: true, freeRemaining: 0, premiumRemaining: 0, remaining: 0,
        groblePaymentUrl: "https://www.groble.im/payment/4SGBV5",
        grobleSinglePaymentUrl: null,
        checkoutUrls: { single: null, standard: "https://www.groble.im/payment/4SGBV5", premium: "https://www.groble.im/payment/PRM" },
      });

    const summary = await fetchEntitlementSummary("access-token", fetcher);
    expect(summary.checkoutUrls).toEqual({
      single: null, company: null, standard: "https://www.groble.im/payment/4SGBV5", premium: "https://www.groble.im/payment/PRM", triple: null,
    });
  });

  it("derives checkout URLs from the legacy fields when an old server omits checkoutUrls", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        premiumEnabled: true, freeRemaining: 0, premiumRemaining: 0, remaining: 0,
        groblePaymentUrl: "https://www.groble.im/payment/4SGBV5",
        grobleSinglePaymentUrl: "https://www.groble.im/payment/6HteWn",
      });

    const summary = await fetchEntitlementSummary("access-token", fetcher);
    expect(summary.checkoutUrls.standard).toBe("https://www.groble.im/payment/4SGBV5");
    expect(summary.checkoutUrls.single).toBe("https://www.groble.im/payment/6HteWn");
    expect(summary.checkoutUrls.premium).toBeNull();
  });

  it("rejects a malformed checkout URL instead of rendering a broken button", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        premiumEnabled: true, freeRemaining: 0, premiumRemaining: 0, remaining: 0,
        groblePaymentUrl: null, checkoutUrls: { premium: 42 },
      });

    await expect(fetchEntitlementSummary("access-token", fetcher)).rejects.toEqual(
      new EntitlementApiError("Invalid checkoutUrls.premium response"),
    );
  });
```

`createPurchaseIntent` 테스트 "stamps the requested product onto the purchase-intent query string"에 `"premium"` 케이스를 하나 추가한다(`?product=premium`).

- [ ] **Step 5: `client/src/pages/Checkout.tsx`**

```ts
import { PRICING, PURCHASE_PRODUCT_KEYS } from "@/lib/pricing";

const PRODUCT_KEYS: readonly PurchaseProductKey[] = PURCHASE_PRODUCT_KEYS;
```

(기존 `import { PRICING } from "@/lib/pricing";` 줄을 위로 교체. `readProduct`는 그대로.) 주석의 `(/checkout?product=single|triple)`를 `(/checkout?product=single|company|standard|premium)`로 고친다.

`client/src/pages/Checkout.test.tsx`: "creates the purchase intent for the requested product…"와 같은 형태로 `visit("?product=premium")` 케이스를 추가해 `createPurchaseIntent`가 `"premium"`으로 호출되는지 확인한다. `"quintuple"` 거부 케이스는 그대로.

- [ ] **Step 6: 통과 확인**

Run: `pnpm exec vitest run client/src/lib/pricing.test.ts client/src/lib/entitlements.test.ts client/src/pages/Checkout.test.tsx && pnpm check`
Expected: 테스트 PASS. `pnpm check`는 이 시점에 `Entitlements.tsx`(`PAID_PLAN_COPY: Record<PurchaseProductKey, …>`가 5키를 요구)·`KpiGrid.tsx`·`useDashboardData.ts`에서 오류가 날 수 있다 — **그 오류 목록을 보고서에 적고 커밋한다**(Task 6·7이 고친다). 다른 파일의 오류가 있으면 이 Task에서 고친다.

- [ ] **Step 7: 커밋**

```bash
git add client/src/lib/pricing.ts client/src/lib/pricing.test.ts client/src/lib/entitlements.ts client/src/lib/entitlements.test.ts client/src/pages/Checkout.tsx client/src/pages/Checkout.test.tsx
git commit -m "feat(client): price the tier products and read per-product checkout URLs"
```

---

### Task 6: 이용권 페이지 — 티어 카드 3장(베이직 선택 버튼), `checkoutUrls` 게이트, `#company` 해시

**Files:**
- Modify: `client/src/pages/Entitlements.tsx` (import 10-22행, `PAID_PLAN_COPY` 31-45행, `canPurchase` 143-150행, `renderPaidPlanButton`·`renderPaidPlanCard` 152-244행, 카드 그리드 `<div className="grid gap-6 md:grid-cols-3">`와 `renderPaidPlanCard("single")`/`("triple")` 호출, "어떤 이용권을 선택하든" 안내 블록)
- Modify: `client/src/pages/Entitlements.test.ts`, `client/src/pages/Entitlements.purchase.test.tsx`
- Modify: `client/src/pages/companyAnalyzeErrors.ts` (31행 `actionHref`), `client/src/pages/companyAnalyzeErrors.test.ts` (11행)

**Interfaces:**
- Consumes: Task 5의 `PRICING`, `TIERS`, `PurchaseProductKey`, `savingsFor`, `COMPANY_REPORT_INCLUDED_FEATURES`, `EntitlementSummary.checkoutUrls`.
- Produces: 카드 4장(무료 체험 + 베이직 + 스탠다드 + 프리미엄), 베이직 카드 `id="basic"`에 선택 버튼("자소서 진단 1회" / "기업 분석 1회"), 구매 버튼 라벨 `${plan.label} 구매하기`; `/entitlements#company`로 들어오면 베이직 카드가 기업 분석 선택 상태로 스크롤됨.

- [ ] **Step 1: 실패하는 테스트 — `client/src/pages/Entitlements.test.ts`**

"renders every plan card…" 케이스에서 `renderPaidPlanCard("single")`·`renderPaidPlanCard("triple")` 두 줄을 다음으로 바꾼다:

```ts
    // 티어 카드 3장: 베이직(선택 버튼 2개) + 스탠다드 + 프리미엄. 카드 수·순서는 pricing.ts 의 TIERS 가 정한다.
    expect(pageSource).toContain("TIERS.map(");
    expect(pageSource).toContain('id="basic"');
    expect(pageSource).toContain("자소서 진단 1회");
    expect(pageSource).toContain("기업 분석 1회");
    expect(pageSource).toContain("COMPANY_REPORT_INCLUDED_FEATURES");
```

"gates the checkout button…" 케이스에서 `summary.premiumEnabled && paymentUrl`·`summary.grobleSinglePaymentUrl`·`summary.groblePaymentUrl` 세 줄을 다음으로 바꾼다:

```ts
    // 상품별 결제 URL은 서버가 스위치·활성·URL을 모두 반영해 준다 — 페이지는 있는지만 본다.
    expect(pageSource).toContain("summary.checkoutUrls[product]");
    expect(pageSource).not.toContain("summary.groblePaymentUrl");
    expect(pageSource).not.toContain("summary.grobleSinglePaymentUrl");
```

새 케이스:

```ts
  it("lands the company credit deep link on the basic card with the company option selected", () => {
    expect(pageSource).toContain('window.location.hash === "#company"');
    expect(pageSource).toContain('setBasicChoice("company")');
    expect(pageSource).toContain('getElementById("basic")');
  });
```

`client/src/pages/Entitlements.purchase.test.tsx`:
- `SUMMARY`에 `checkoutUrls: { single: "https://www.groble.im/payment/6HteWn", company: "https://www.groble.im/payment/CMP", standard: "https://www.groble.im/payment/4SGBV5", premium: "https://www.groble.im/payment/PRM", triple: null }, companyAnalysisEnabled: true, companyRemaining: 0` 추가.
- 버튼 이름 정규식을 바꾼다: `/3회권 구매하기/` → `/스탠다드 구매하기/`, `/1회권 구매하기/` → `/자소서 진단 1회 구매하기/`. `window.open` 기대 `"/checkout?product=single"` 유지, `navigate` 기대 `"/checkout?product=triple"` → `"/checkout?product=standard"`.
- "still says sales are unavailable when the server reports no checkout URL": 요약을 `{ ...SUMMARY, premiumEnabled: false, groblePaymentUrl: null, grobleSinglePaymentUrl: null, checkoutUrls: { single: null, company: null, standard: null, premium: null, triple: null } }`로.
- 새 케이스 3개:

```ts
  it("switches the basic card to the company product and opens its checkout", async () => {
    signedIn();
    const open = vi.fn().mockReturnValue({});
    vi.stubGlobal("open", open);

    render(<Entitlements />);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /자소서 진단 1회 구매하기/ })[0].hasAttribute("disabled")).toBe(false);
    });

    screen.getByRole("radio", { name: /기업 분석 1회/ }).click();
    screen.getAllByRole("button", { name: /기업 분석 1회 구매하기/ })[0].click();

    expect(open).toHaveBeenCalledWith("/checkout?product=company", "_blank");
    vi.unstubAllGlobals();
  });

  it("opens the premium checkout from the premium card", async () => {
    signedIn();
    const open = vi.fn().mockReturnValue({});
    vi.stubGlobal("open", open);

    render(<Entitlements />);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /프리미엄 구매하기/ })[0].hasAttribute("disabled")).toBe(false);
    });
    screen.getAllByRole("button", { name: /프리미엄 구매하기/ })[0].click();

    expect(open).toHaveBeenCalledWith("/checkout?product=premium", "_blank");
    vi.unstubAllGlobals();
  });

  it("shows the preparing note only for products whose checkout URL is missing", async () => {
    signedIn();
    mocks.fetchEntitlementSummary.mockResolvedValue({
      ...SUMMARY,
      checkoutUrls: { ...SUMMARY.checkoutUrls, premium: null },
    });

    render(<Entitlements />);

    await waitFor(() => {
      expect(screen.getAllByText(/판매를 준비하고 있어요/)).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: /스탠다드 구매하기/ })[0].hasAttribute("disabled")).toBe(false);
    });
  });
```

`client/src/pages/companyAnalyzeErrors.test.ts` 11행: `actionHref: "/entitlements#company"`.

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run client/src/pages/Entitlements.test.ts client/src/pages/Entitlements.purchase.test.tsx client/src/pages/companyAnalyzeErrors.test.ts`
Expected: FAIL.

- [ ] **Step 3: `client/src/pages/companyAnalyzeErrors.ts`**

`COMPANY_CREDITS_EXHAUSTED` 분기의 `actionHref: "/entitlements"` → `actionHref: "/entitlements#company"`. 메시지 "판매가 열리면 이용권 페이지에서 구매할 수 있어요." → "이용권 페이지에서 기업 분석 1회 또는 스탠다드·프리미엄을 구매할 수 있어요." (테스트의 `message` 기대도 같이 고친다.)

- [ ] **Step 4: `client/src/pages/Entitlements.tsx`**

import 교체:

```tsx
import {
  COMPANY_REPORT_INCLUDED_FEATURES,
  PRICING,
  REPORT_INCLUDED_FEATURES,
  SEASONAL_DISCOUNT_LABEL,
  TIERS,
  TRIPLE_PER_USE_PRICE,
  formatKrw,
  savingsFor,
} from "@/lib/pricing";
```

`PAID_PLAN_COPY`를 상품 키 5개 중 판매 4개로 다시 쓴다(타입은 `Partial<Record<PurchaseProductKey, …>>`가 아니라 명시 4키):

```tsx
const PAID_PLAN_COPY: Record<
  "single" | "company" | "standard" | "premium",
  { lead: string; body: string; perUseNote: string }
> = {
  single: {
    lead: "당장 앞둔 마감 하나에 집중하고 싶다면.",
    body: "지금 쓴 자소서가 채용 담당자에게 어떻게 읽히는지, 제출 전에 확인해 보세요.",
    perUseNote: "이번 지원, 제출 전 마지막 점검",
  },
  company: {
    lead: "자소서를 쓰기 전에 회사부터 알고 싶다면.",
    body: "무엇을 팔아 돈을 버는지, 요즘 힘을 싣는 사업이 무엇인지, 자소서에 쓸 사업 소재까지 한 리포트로 받아 보세요.",
    perUseNote: "회사 한 곳, 자소서 쓰기 전 조사",
  },
  standard: {
    lead: "한 회사를 제대로 준비하고, 고쳐 쓴 자소서까지 다시 확인.",
    body: "기업 분석으로 소재를 잡고, 자소서 진단을 두 번 받으세요. 고쳐 쓴 자소서가 정말 나아졌는지 확인할 수 있어요.",
    perUseNote: `회당 ${formatKrw(TRIPLE_PER_USE_PRICE)} — 커피 한 잔 값`,
  },
  premium: {
    lead: "세 회사를 완전히 대비하고 싶다면.",
    body: "회사마다 기업 분석 리포트와 자소서 진단을 한 번씩. 지원하는 회사가 바뀌면 리포트의 기준도 바뀝니다.",
    perUseNote: "회사 세 곳, 조사부터 진단까지",
  },
};

type BasicChoice = "single" | "company";
```

상태 추가(`isMobileMenuOpen` 아래): `const [basicChoice, setBasicChoice] = useState<BasicChoice>("single");`

해시 처리 효과(`loadEntitlements` 효과 아래):

```tsx
  // /entitlements#company — 기업 분석 이용권이 없어서 온 사용자는 베이직 카드의 기업 분석을 바로 고른 상태로 만난다.
  useEffect(() => {
    if (window.location.hash === "#company") {
      setBasicChoice("company");
      document.getElementById("basic")?.scrollIntoView({ block: "start" });
    }
  }, []);
```

`canPurchase`:

```tsx
  // 결제 게이트: 서버가 판매 스위치·상품 활성·결제 URL을 모두 반영해 checkoutUrls 를 준다. 페이지는 있는지만 본다.
  const canPurchase = (product: PurchaseProductKey) => Boolean(summary?.checkoutUrls[product]);
```

`renderPaidPlanButton(product)`의 `highlighted` 스타일 조건을 `product === "triple"` → `product === "premium"`으로. 버튼 라벨은 기존대로 `${plan.label} 구매하기`(베이직은 선택에 따라 "자소서 진단 1회 구매하기" / "기업 분석 1회 구매하기").

`renderPaidPlanCard`를 티어 기준으로 바꾼다:

```tsx
  const renderTierCard = (tier: (typeof TIERS)[number]) => {
    const product: PurchaseProductKey = tier.key === "basic" ? basicChoice : tier.products[0];
    const plan = PRICING[product];
    const copy = PAID_PLAN_COPY[product as keyof typeof PAID_PLAN_COPY];
    const highlighted = tier.key === "premium";
    const hasStrike = plan.listPrice > plan.salePrice;
    const usesLabel = [
      plan.uses > 0 ? `자소서 진단 ${plan.uses}회` : null,
      plan.companyUses > 0 ? `기업 분석 ${plan.companyUses}회` : null,
    ].filter(Boolean).join(" + ");

    return (
      <div
        key={tier.key}
        id={tier.key}
        className={`flex h-full flex-col rounded-2xl border bg-white/[0.02] p-8 md:p-9 ${
          highlighted ? "border-blue-500/[0.25]" : "border-white/[0.06]"
        }`}
      >
        <p className={`text-lg font-bold tracking-tight ${highlighted ? "text-blue-400" : "text-zinc-200"}`}>
          {tier.label}
        </p>
        {tier.key === "basic" ? (
          <div role="radiogroup" aria-label="베이직 구성 선택" className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
            {tier.products.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={basicChoice === choice}
                onClick={() => setBasicChoice(choice)}
                className={`h-8 rounded-md text-[12.5px] font-semibold transition-colors ${
                  basicChoice === choice ? "bg-white/[0.12] text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {PRICING[choice].label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[13px] font-medium text-zinc-400">{usesLabel}</p>
        )}
        <p className="mt-4 text-[2.4rem] font-bold leading-none tracking-tight text-white">
          {formatKrw(plan.salePrice)}
          <span className="ml-1.5 text-[15px] font-medium text-zinc-500">/ {plan.uses + plan.companyUses}회</span>
        </p>
        {hasStrike ? (
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 text-[15px]">
            <span className="font-light text-zinc-400 line-through decoration-zinc-300/60 decoration-[1.5px]">
              {tier.key === "basic" ? "정가" : "따로 사면"} {formatKrw(plan.listPrice)}
            </span>
            <span className="text-lg font-extrabold tracking-tight text-sky-300">{plan.discountLabel}</span>
          </p>
        ) : (
          <p className="mt-3 text-[15px] font-light text-zinc-500">신상품 · 정가 판매</p>
        )}
        <p className="mt-1.5 text-xs font-light text-zinc-500">{copy.perUseNote}</p>
        <p className="mt-6 text-[14.5px] font-medium leading-relaxed text-zinc-200">{copy.lead}</p>
        <p className="mb-7 mt-2 flex-1 text-[13px] font-light leading-[1.8] text-zinc-500">{copy.body}</p>
        {renderPaidPlanButton(product)}
      </div>
    );
  };
```

`savingsFor`는 `discountLabel`이 정확한지 테스트가 보증하므로 카드에서는 `plan.discountLabel`을 그대로 쓴다(`savingsFor` import는 안내 블록에서 쓴다 — 아래).

카드 그리드: `<div className="grid gap-6 md:grid-cols-3">` → `<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">`, 그 안의 `{renderPaidPlanCard("single")}` `{renderPaidPlanCard("triple")}` 두 줄을 `{TIERS.map((tier) => renderTierCard(tier))}`로. 기존 `renderPaidPlanCard` 함수는 지운다.

"어떤 이용권을 선택하든, 리포트에는 이 모든 게 담깁니다" 블록 아래에 기업 분석 안내 블록을 추가한다:

```tsx
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-7 py-6">
              <p className="text-[14px] font-semibold text-zinc-200">
                기업 분석 리포트에는 이런 게 담깁니다
              </p>
              <p className="mt-1 text-xs font-light text-zinc-500">
                스탠다드·프리미엄에 포함되고, 베이직에서 따로 고를 수도 있어요. 세 곳을 준비하면 프리미엄이 {formatKrw(savingsFor(PRICING.premium))} 저렴합니다.
              </p>
              <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {COMPANY_REPORT_INCLUDED_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-[13.5px] font-light text-zinc-400">
                    <Check className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm exec vitest run client/src/pages/Entitlements.test.ts client/src/pages/Entitlements.purchase.test.tsx client/src/pages/companyAnalyzeErrors.test.ts client/src/pages/CompanyAnalyze.source.test.ts && pnpm check`
Expected: PASS. `pnpm check`에 남는 오류는 `KpiGrid.tsx`·`useDashboardData.ts`(Task 7)뿐이어야 한다 — 보고서에 적는다.

- [ ] **Step 6: 커밋**

```bash
git add client/src/pages/Entitlements.tsx client/src/pages/Entitlements.test.ts client/src/pages/Entitlements.purchase.test.tsx client/src/pages/companyAnalyzeErrors.ts client/src/pages/companyAnalyzeErrors.test.ts
git commit -m "feat(entitlements): sell the basic, standard, and premium tiers with a basic-tier product choice"
```

---

### Task 7: 관리자 화면 — 결제 상품 설정 카드, 대시보드 상품 키·추정 매출

**Files:**
- Create: `client/src/lib/admin-product-settings.ts`, `client/src/lib/admin-product-settings.test.ts`
- Modify: `client/src/pages/admin/settings/SettingsPage.tsx` (import, 상태·핸들러 100-150행 근처, 기업 분석 리포트 `Card` 다음·`<fieldset disabled>` 앞)
- Create: `client/src/pages/admin/settings/SettingsPage.products.test.ts`
- Modify: `client/src/hooks/admin/useDashboardData.ts` (6행 `PaymentSummary`), `client/src/components/admin/dashboard/KpiGrid.tsx` (11행 import, 35-40행 `estimatedRevenue`)

**Interfaces:**
- Consumes: Task 4의 `GET/PATCH /api/admin/product-settings`; Task 5의 `PurchaseProduct`, `productLabel`, `estimatedAmountFor`, `PRODUCT_KEY_BY_PRODUCT`.
- Produces (`admin-product-settings.ts`): `interface AdminProductSetting { product: PurchaseProduct; contentId: string | null; paymentUrl: string; active: boolean; resumeCredits: number; companyCredits: number }`, `fetchProductSettings(): Promise<AdminProductSetting[]>`, `updateProductSetting(product, patch: { contentId?: string | null; paymentUrl?: string; active?: boolean }): Promise<AdminProductSetting[]>`.
- Produces (`useDashboardData.ts`): `byProduct: Record<PurchaseProduct | "UNKNOWN", number>`.

- [ ] **Step 1: 실패하는 테스트 — `client/src/lib/admin-product-settings.test.ts`**

`client/src/lib/admin-entitlements.test.ts`의 구조(`vi.mock("./supabase")`로 `getSession` 모킹, `fetch` 스텁, 응답 헬퍼)를 그대로 따라 작성한다:

```ts
describe("admin product settings API client", () => {
  it("reads the product list with the active Supabase bearer token", async () => {
    // fetch 가 "/api/admin/product-settings" 를 GET 으로, Authorization: Bearer <token> 헤더와 함께 호출하는지
    // 응답 { products: [ {product:"SINGLE", contentId:"6HteWn", paymentUrl:"", active:true, resumeCredits:1, companyCredits:0} ] } 가 그대로 배열로 돌아오는지
  });

  it("patches one product with only the given fields", async () => {
    // updateProductSetting("PREMIUM", { paymentUrl: "https://www.groble.im/payment/PRM", active: true })
    // → method PATCH, body JSON.stringify({ product: "PREMIUM", paymentUrl: "...", active: true }) (contentId 키 없음)
  });

  it("sends null to clear a content id", async () => {
    // updateProductSetting("STANDARD", { contentId: null }) → body 에 "contentId":null 포함
  });

  it("rejects before requesting when the administrator session is missing", async () => { /* admin-entitlements.test.ts 와 동일 */ });

  it("surfaces the server error code", async () => {
    // 409 { error: "DUPLICATE_CONTENT_ID" } → rejects with Error("DUPLICATE_CONTENT_ID")
  });

  it("rejects a malformed response", async () => {
    // { products: "nope" } → rejects
  });
});
```

각 케이스의 단언은 `admin-entitlements.test.ts`가 쓰는 방식(호출 인자 검사·`rejects.toThrow`)으로 완성한다.

`client/src/pages/admin/settings/SettingsPage.products.test.ts`(소스 문자열):

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./SettingsPage.tsx", import.meta.url), "utf8");

describe("SettingsPage product settings card", () => {
  it("renders one editable row per purchase product from the admin API", () => {
    expect(source).toContain('from "@/lib/admin-product-settings"');
    expect(source).toContain("fetchProductSettings()");
    expect(source).toContain("updateProductSetting(");
    expect(source).toContain("결제 상품 설정");
    expect(source).toContain("productLabel(row.product)");
    // contentId·결제 URL 입력과 판매 스위치, 행별 저장
    expect(source).toContain("Groble contentId");
    expect(source).toContain("결제 URL");
    expect(source).toContain("판매");
    expect(source).toContain("DUPLICATE_CONTENT_ID");
  });

  it("keeps the card outside the read-only fieldset", () => {
    expect(source.indexOf("결제 상품 설정")).toBeLessThan(source.indexOf('<fieldset disabled'));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run client/src/lib/admin-product-settings.test.ts client/src/pages/admin/settings/SettingsPage.products.test.ts`
Expected: FAIL.

- [ ] **Step 3: `client/src/lib/admin-product-settings.ts`**

```ts
import type { PurchaseProduct } from "./pricing";
import { supabase } from "./supabase";

export interface AdminProductSetting {
  product: PurchaseProduct;
  contentId: string | null;
  paymentUrl: string;
  active: boolean;
  resumeCredits: number;
  companyCredits: number;
}

export interface ProductSettingPatch {
  contentId?: string | null;
  paymentUrl?: string;
  active?: boolean;
}

type JsonRecord = Record<string, unknown>;

function isProductSetting(value: unknown): value is AdminProductSetting {
  if (typeof value !== "object" || value === null) return false;
  const row = value as JsonRecord;
  return (
    typeof row.product === "string" &&
    (row.contentId === null || typeof row.contentId === "string") &&
    typeof row.paymentUrl === "string" &&
    typeof row.active === "boolean" &&
    typeof row.resumeCredits === "number" &&
    typeof row.companyCredits === "number"
  );
}

async function requestProductSettings(init: RequestInit, fallback: string): Promise<AdminProductSetting[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  const response = await fetch("/api/admin/product-settings", {
    ...init,
    headers: { ...init.headers, "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? ((await response.json()) as JsonRecord) : null;

  if (!response.ok) {
    throw new Error(payload && typeof payload.error === "string" ? payload.error : fallback);
  }
  if (!payload || !Array.isArray(payload.products) || !payload.products.every(isProductSetting)) {
    throw new Error(fallback);
  }
  return payload.products;
}

export function fetchProductSettings(): Promise<AdminProductSetting[]> {
  return requestProductSettings({}, "결제 상품 설정을 불러오지 못했습니다.");
}

export function updateProductSetting(product: PurchaseProduct, patch: ProductSettingPatch): Promise<AdminProductSetting[]> {
  return requestProductSettings(
    { method: "PATCH", body: JSON.stringify({ product, ...patch }) },
    "결제 상품 설정을 저장하지 못했습니다.",
  );
}
```

- [ ] **Step 4: `SettingsPage.tsx` — "결제 상품 설정" 카드**

import 추가: `import { fetchProductSettings, updateProductSetting, type AdminProductSetting } from "@/lib/admin-product-settings";`, `import { productLabel } from "@/lib/pricing";`.

상태·핸들러(기업 분석 스위치 핸들러 아래):

```tsx
  // 결제 상품 설정 — 상품별 Groble contentId·결제 URL·판매 여부. 행 단위로 저장한다.
  const [productRows, setProductRows] = useState<AdminProductSetting[] | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, { contentId: string; paymentUrl: string }>>({});
  const [productBusy, setProductBusy] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);

  const applyProductRows = (rows: AdminProductSetting[]) => {
    setProductRows(rows);
    setProductDrafts(Object.fromEntries(rows.map((row) => [row.product, { contentId: row.contentId ?? "", paymentUrl: row.paymentUrl }])));
  };

  useEffect(() => {
    fetchProductSettings()
      .then(applyProductRows)
      .catch((error: unknown) => setProductError(error instanceof Error ? error.message : "결제 상품 설정을 불러오지 못했습니다."));
  }, []);

  const handleProductSave = async (row: AdminProductSetting, active = row.active) => {
    const draft = productDrafts[row.product] ?? { contentId: row.contentId ?? "", paymentUrl: row.paymentUrl };
    setProductBusy(row.product);
    setProductError(null);
    try {
      const rows = await updateProductSetting(row.product, {
        contentId: draft.contentId.trim() === "" ? null : draft.contentId.trim(),
        paymentUrl: draft.paymentUrl.trim(),
        active,
      });
      applyProductRows(rows);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "결제 상품 설정을 저장하지 못했습니다.";
      setProductError(message === "DUPLICATE_CONTENT_ID" ? "이미 다른 상품이 쓰는 contentId 입니다." : message);
    } finally {
      setProductBusy(null);
    }
  };
```

카드(기업 분석 리포트 `Card` 바로 아래, `<fieldset disabled>` 앞):

```tsx
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">결제 상품 설정</CardTitle>
          <CardDescription className="text-xs">
            상품별 Groble contentId(웹훅이 결제 상품을 알아보는 값)와 결제 URL, 판매 여부. contentId 가 비어 있으면
            1회권·3회권(구)은 환경 변수 값을 씁니다. 저장 즉시 서버에 반영됩니다. 3회권(구)은 판매하지 않습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {productError ? <p className="text-xs text-destructive">{productError}</p> : null}
          {productRows === null ? (
            <p className="text-sm text-muted-foreground">상품 설정 불러오는 중...</p>
          ) : (
            productRows.map((row) => {
              const draft = productDrafts[row.product] ?? { contentId: row.contentId ?? "", paymentUrl: row.paymentUrl };
              const busy = productBusy === row.product;
              return (
                <div key={row.product} className="grid gap-2 rounded-lg border p-3.5 md:grid-cols-[160px_1fr_1fr_auto_auto] md:items-center">
                  <div>
                    <p className="text-sm font-semibold">{productLabel(row.product)}</p>
                    <p className="text-[11px] text-muted-foreground">자소서 {row.resumeCredits} · 기업 {row.companyCredits} · {row.product}</p>
                  </div>
                  <Input
                    aria-label={`${productLabel(row.product)} Groble contentId`}
                    placeholder="Groble contentId"
                    value={draft.contentId}
                    disabled={busy}
                    onChange={(event) => setProductDrafts((prev) => ({ ...prev, [row.product]: { ...draft, contentId: event.target.value } }))}
                  />
                  <Input
                    aria-label={`${productLabel(row.product)} 결제 URL`}
                    placeholder="결제 URL (https://…)"
                    value={draft.paymentUrl}
                    disabled={busy}
                    onChange={(event) => setProductDrafts((prev) => ({ ...prev, [row.product]: { ...draft, paymentUrl: event.target.value } }))}
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={row.active} disabled={busy} onCheckedChange={(checked) => void handleProductSave(row, checked)} />
                    판매
                  </label>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleProductSave(row)}>
                    <Save className="mr-1 h-3.5 w-3.5" />저장
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
```

- [ ] **Step 5: 대시보드 타입·추정 매출**

`client/src/hooks/admin/useDashboardData.ts` 6행:

```ts
import type { PurchaseProduct } from "@/lib/pricing";
export interface PaymentSummary { total: number; today: number; byProduct: Record<PurchaseProduct | "UNKNOWN", number>; }
```

`client/src/components/admin/dashboard/KpiGrid.tsx`: import를 `import { estimatedAmountFor, formatKrw, type PurchaseProduct } from "@/lib/pricing";`로, `estimatedRevenue`를:

```ts
  // 결제 금액은 저장되지 않으므로(진실은 Groble) 현재 판매가로 되짚은 추정치다. 상품을 모르는 결제(UNKNOWN)는 뺀다.
  const estimatedRevenue =
    paymentSummary != null
      ? Object.entries(paymentSummary.byProduct).reduce((sum, [product, count]) => {
          if (product === "UNKNOWN") return sum;
          return sum + count * (estimatedAmountFor(product as PurchaseProduct) ?? 0);
        }, 0)
      : null;
```

`PRICING` import가 이 파일에서 더 이상 안 쓰이면 지운다. `KpiGrid`·대시보드 관련 기존 테스트(`grep -rln "byProduct" client/src`)가 `{ SINGLE, TRIPLE, UNKNOWN }` 리터럴을 쓰면 5키로 넓힌다.

- [ ] **Step 6: 통과 확인**

Run: `pnpm exec vitest run client/src/lib/admin-product-settings.test.ts client/src/pages/admin client/src/components/admin client/src/hooks && pnpm check`
Expected: PASS, `pnpm check` 0 오류.

- [ ] **Step 7: 커밋**

```bash
git add client/src/lib/admin-product-settings.ts client/src/lib/admin-product-settings.test.ts client/src/pages/admin/settings/SettingsPage.tsx client/src/pages/admin/settings/SettingsPage.products.test.ts client/src/hooks/admin/useDashboardData.ts client/src/components/admin/dashboard/KpiGrid.tsx
git commit -m "feat(admin): edit per-product Groble settings and total estimated revenue across the tier products"
```

(대시보드 테스트 파일을 고쳤으면 함께 add.)

---

### Task 8: 전체 검증과 완료 보고

- [ ] **Step 1: 테스트**

Run: `GEMINI_API_KEY="" pnpm exec vitest run client/src lib tests/api scripts/vercel-function-limit.test.js`
Expected: 이 플랜 범위 파일 전부 PASS. 기존에 깨져 있던 `lib/auth.test.js` 4건·`client/src/pages/ReportResult.identity.test.ts` 2건·`client/src/pages/homeOnboardingCopy.test.ts` 1건은 이 플랜 탓이 아니다(원장에 기록).

- [ ] **Step 2: 타입 체크**

Run: `pnpm check` → 0 오류.

- [ ] **Step 3: 브라우저 확인(가능하면)**

`pnpm dev`로 `/entitlements`가 카드 4장(무료·베이직·스탠다드·프리미엄)으로 그려지고 베이직의 선택 버튼이 바뀌는지, `/entitlements#company`로 들어오면 기업 분석이 선택되는지, 관리자 `/admin/settings`에 "결제 상품 설정" 카드 5행이 보이는지. 못 했으면 못 했다고 적는다.

- [ ] **Step 4: 완료 보고**

```text
가정: 서버·화면(①②) 그대로. 랜딩·GNB·업셀 CTA·샘플은 ④. 가격은 스펙 §7-3.
변경: 생성 N / 수정 N(목록). 마이그레이션 2개(미적용 — 사용자가 배포 전 `pnpm exec prisma migrate deploy`).
검증: vitest·pnpm check 출력, 브라우저 확인 여부.
남은 위험: 컷오버 순서(스펙 §7-3) — 배포 직후 스탠다드가 자소서 3회로 초과 지급되다가 관리자가 STANDARD 행에 contentId 를 넣으면 2+1 로 전환; 기업 스위치가 꺼져 있으면 스탠다드·프리미엄·기업 단품이 팔리지 않음; 그로블 상품 2개 등록·3회권 설명 수정은 사람이 한다.
```

---

## Self-Review

- **Spec coverage(§7-3):** enum·테이블·백필 → Task 1. 카탈로그·env fallback 규칙·컷오버 대응 → Task 2. `checkoutUrls`·기업 스위치 게이트·기본 상품 STANDARD → Task 3. 관리자 상품 설정 API → Task 4. 가격 티어·`checkoutUrls` 파싱·체크아웃 5키 → Task 5. 티어 카드·베이직 선택·`#company` → Task 6. 관리자 화면·대시보드 → Task 7. 컷오버 절차는 스펙에 있고 완료 보고가 되짚는다. 랜딩·GNB·업셀·샘플은 ④로 명시 제외.
- **Placeholder scan:** Task 2 Step 5(f)의 `alteredSignatureRequest()`·`EXPECTED_STATUS_OF_ALTERED_SIGNATURE`, Task 4 Step 1의 `FORBIDDEN_ERROR_FROM_ENTITLEMENTS_TEST`, Task 7 Step 1의 클라이언트 테스트 골격은 **기존 테스트 파일의 같은 케이스를 복사**하라는 지시가 붙어 있다(실제 헬퍼 이름이 파일마다 달라 여기서 고정할 수 없음). 그 외 TBD/TODO 없음.
- **Type consistency:** `PURCHASE_PRODUCT_KEYS`(서버, 대문자 5개)와 `PURCHASE_PRODUCT_KEYS`(클라이언트, 소문자 5개)는 이름이 같지만 파일이 다르다(`lib/entitlement-products.js` vs `client/src/lib/pricing.ts`) — 서로 import 하지 않는다. `PRODUCT_QUERY_KEYS`(서버)와 `PRODUCT_KEY_BY_PRODUCT`(클라이언트)의 값이 일치한다(single/company/standard/premium/triple). `checkoutUrls` 키 = 쿼리 키. `AdminProductSetting` 필드 = Task 4 응답 필드. `EntitlementSummary.checkoutUrls: Record<PurchaseProductKey, string|null>`을 Task 6이 `summary.checkoutUrls[product]`로 읽는다. `PaymentSummary.byProduct`의 키 = 서버 `byProduct` 키(대문자 5 + UNKNOWN).
