# 이용권 2단 가격제 (1회권 / 3회권) 구현 플랜

> **에이전트 작업자에게:** 필수 하위 스킬 — `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`로 태스크 단위 실행. 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** 단일 상품 전제로 만들어진 유료 이용권 경로를 상품 카탈로그 구조로 바꾸고, 1회권(5,900원)·3회권(14,900원)을 정가 취소선과 함께 판매한다.

**아키텍처:** 상품을 `premium_products` 테이블로 옮기고, `PurchaseIntent`가 결제 시점의 상품·크레딧을 스냅샷한다. 웹훅은 환경변수 대신 **구매 의도가 가리키는 상품**과 결제된 Groble 콘텐츠를 대조하고, 스냅샷 크레딧을 지급한다. 가격 표시는 전부 DB 값에서 파생되므로 11/30 프로모션 종료는 배포 없이 SQL로 처리한다.

**기술 스택:** Prisma 7 + Supabase Postgres · Vercel Serverless (ESM JS) · React 19 + Vite + Tailwind4 · Vitest · pnpm

**스펙:** `docs/superpowers/specs/2026-09-03-premium-two-tier-pricing.md`

> **구현 결과와의 차이(2026-09-04 추가):** 이 문서는 계획 시점 산출물이다. 실제 구현은
> `premium_products` 테이블·`discountPercent`/`pricePerCredit` 헬퍼 대신
> `PurchaseProduct` enum(SINGLE/TRIPLE) + `lib/entitlement-products.js` +
> `client/src/lib/pricing.ts` 상수로 착지했다. 표시 반올림도 여기 적힌 내림/10원 올림이 아니라
> **원 단위 반올림**이어서 3회권은 `약 50% 할인 · 회당 4,967원`으로 표시된다.
> 가격·표기의 진실은 스펙 문서와 `client/src/lib/pricing.ts`다.

## 전역 제약

- **패키지 매니저는 `pnpm`만.** 락파일을 바꾸지 않는다.
- **새 API 파일을 만들지 않는다.** Vercel Hobby 12함수 한도(`scripts/vercel-function-limit.test.js`). 모든 서버 변경은 기존 `api/entitlements.js`에 얹는다.
- **에러 코드 문자열은 계약이다.** `PREMIUM_SALES_DISABLED`, `PREMIUM_CHECKOUT_NOT_CONFIGURED`, `UNEXPECTED_GROBLE_PRODUCT`, `UNLINKED_PURCHASE_INTENT`, `PURCHASE_INTENT_ALREADY_PAID`, `INVALID_PURCHASE_INTENT_STATUS` — 문자열을 바꾸지 않는다.
- **로그·감사 이벤트에 자소서 본문·AI 응답·이메일·토큰·결제 식별자 원문을 남기지 않는다.** 웹훅 진단은 기존 `hashIdentifier` 방식을 유지한다.
- **프리티어를 저장소 전체에 돌리지 않는다.** 포맷이 필요하면 파일을 명시한다.
- **가격 표시 반올림:** 할인율은 내림(`Math.floor`), 회당 단가는 10원 단위 올림(`Math.ceil(x/10)*10`). 사용자에게 실제보다 유리해 보이면 안 된다.
- **확정 수치:** 1회권 `credits=1, list=9900, sale=5900`, 3회권 `credits=3, list=29700, sale=14900`, 프로모션 종료 `2026-11-30T14:59:59Z`.
- **파괴적 DB 명령(`prisma db push`, `migrate reset|deploy`)은 실행하지 않는다.** 마이그레이션 SQL은 파일로 작성만 하고, 프로덕션 적용은 사용자가 한다.

---

## 파일 구조

| 파일 | 역할 | 태스크 |
| --- | --- | --- |
| `prisma/schema.prisma` | `PremiumProduct` 모델, `PurchaseIntent` 스냅샷 컬럼, `EntitlementSetting.promotionEndsAt` | 1 |
| `prisma/migrations/20260903_add_premium_products/migration.sql` | 위 스키마의 SQL + RLS 정렬 | 1 |
| `lib/premium-products.js` | 카탈로그 조회 3함수. 상품 ID를 코드에 하드코딩하지 않는 유일한 경계 | 2 |
| `lib/premium-products.test.js` | 위 함수 단위 테스트 | 2 |
| `lib/groble-webhook-handler.js` | 상품 대조를 환경변수 → 구매 의도 기준으로 교체 | 3 |
| `lib/analysis-entitlements.js` | `grantGroblePurchase`가 스냅샷 크레딧을 받음 | 3 |
| `api/entitlements.js` | 구매 의도가 `productId`를 받음 / 요약이 `products`를 반환 | 4, 5 |
| `client/src/lib/pricing.ts` | 가격 표시 계산(할인율·회당·마감일). 표현 로직만 | 6 |
| `client/src/lib/entitlements.ts` | 응답 파서에 `products`·`promotionEndsAt` 추가 | 6 |
| `client/src/pages/Entitlements.tsx` | 3카드 UI | 7 |
| `docs/operations/premium-pricing.md` | 시드 SQL·가격 변경 절차·11/30 전환 절차 | 8 |

---

### Task 1: 상품 카탈로그 스키마

**Files:**
- Modify: `prisma/schema.prisma:119-130` (`EntitlementSetting`), `prisma/schema.prisma:206-219` (`PurchaseIntent`)
- Create: `prisma/migrations/20260903_add_premium_products/migration.sql`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: Prisma 클라이언트에 `prisma.premiumProduct` 델리게이트. 필드명 `id, grobleContentId, checkoutUrl, credits, listPriceKrw, salePriceKrw, name, badge, sortOrder, active`. `PurchaseIntent`에 `productId: string`, `credits: number`. `EntitlementSetting`에 `promotionEndsAt: Date | null`.

- [ ] **Step 1: `PremiumProduct` 모델 추가**

`prisma/schema.prisma`의 `EntitlementSetting` 블록 바로 뒤에 넣는다.

```prisma
/// 유료 이용권 상품 카탈로그. 상품을 늘리는 것은 이 테이블에 행을 넣는 일이다.
/// 코드에 상품 ID를 하드코딩하지 않는다.
model PremiumProduct {
  id              String  @id @db.VarChar(32)
  grobleContentId String  @unique @map("groble_content_id") @db.VarChar(255)
  checkoutUrl     String  @map("checkout_url") @db.Text
  credits         Int
  /// 정가. 표시광고법상 종전거래가격이라 실제 판매 이력이 있어야 한다.
  listPriceKrw    Int     @map("list_price_krw")
  /// 실제 결제 금액. Groble 상품 설정과 반드시 일치해야 한다(표시용 사본).
  salePriceKrw    Int     @map("sale_price_krw")
  name            String  @db.VarChar(64)
  badge           String? @db.VarChar(32)
  sortOrder       Int     @map("sort_order")
  active          Boolean @default(true)

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@map("premium_products")
}
```

- [ ] **Step 2: `EntitlementSetting`에 프로모션 종료 시각 추가, 기존 컬럼 폐기 표시**

```prisma
model EntitlementSetting {
  id                        String  @id @default("singleton") @db.VarChar(32)
  analysisEnabled           Boolean @default(true) @map("analysis_enabled")
  premiumEnabled            Boolean @default(false) @map("premium_enabled")
  /// @deprecated 상품별 크레딧은 PremiumProduct.credits 가 정본이다.
  /// 컬럼 삭제는 별도 결정으로 분리한다.
  premiumCreditsPerPurchase Int     @default(3) @map("premium_credits_per_purchase")
  /// @deprecated 상품별 체크아웃 URL은 PremiumProduct.checkoutUrl 이 정본이다.
  groblePaymentUrl          String  @map("groble_payment_url") @db.Text
  /// 프로모션 종료 시각. null 이면 화면에서 할인 표기가 사라진다.
  promotionEndsAt           DateTime? @map("promotion_ends_at") @db.Timestamptz

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@map("entitlement_settings")
}
```

- [ ] **Step 3: `PurchaseIntent`에 스냅샷 컬럼 추가**

```prisma
model PurchaseIntent {
  id     String               @id @default(uuid()) @db.Uuid
  userId String               @map("user_id") @db.Uuid
  status PurchaseIntentStatus @default(PENDING)
  /// 구매한 상품 ID의 스냅샷. 상품이 은퇴해도 이력이 깨지지 않도록 FK 를 걸지 않는다.
  productId String            @map("product_id") @db.VarChar(32)
  /// 결제 완료 시 지급할 크레딧 수. 의도 생성과 결제 사이에 상품이 바뀌어도
  /// 사용자가 본 조건대로 지급되도록 여기서 고정한다.
  credits   Int

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@index([productId])
  @@map("purchase_intents")
}
```

- [ ] **Step 4: 마이그레이션 SQL 작성**

`prisma/migrations/20260903_add_premium_products/migration.sql`:

```sql
-- 유료 이용권 상품 카탈로그. 단일 상품(환경변수 GROBLE_PREMIUM_CONTENT_ID +
-- entitlement_settings.premium_credits_per_purchase) 전제를 대체한다.
CREATE TABLE IF NOT EXISTS premium_products (
  id VARCHAR(32) PRIMARY KEY,
  groble_content_id VARCHAR(255) NOT NULL UNIQUE,
  checkout_url TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits BETWEEN 1 AND 10000),
  -- 정가는 판매가보다 작을 수 없다. 음수 할인율이 화면에 뜨는 것을 DB 에서 막는다.
  list_price_krw INTEGER NOT NULL CHECK (list_price_krw >= 0),
  sale_price_krw INTEGER NOT NULL CHECK (sale_price_krw >= 0),
  name VARCHAR(64) NOT NULL,
  badge VARCHAR(32),
  sort_order INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT premium_products_sale_not_above_list CHECK (sale_price_krw <= list_price_krw)
);

-- 구매 의도에 상품·크레딧 스냅샷을 남긴다. product_id 에 FK 를 걸지 않는 이유:
-- 구매 의도는 과거 사실의 기록이라, 상품을 은퇴시켜도 이력이 남아야 한다.
ALTER TABLE purchase_intents
  ADD COLUMN IF NOT EXISTS product_id VARCHAR(32),
  ADD COLUMN IF NOT EXISTS credits INTEGER;

-- 결제 오픈 전이라 기존 행은 없거나 소수의 테스트 데이터다. 종전 단일 상품으로 채운다.
UPDATE purchase_intents
SET product_id = 'credits_3', credits = 3
WHERE product_id IS NULL;

ALTER TABLE purchase_intents
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN credits SET NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_intents_product_id ON purchase_intents (product_id);

-- 프로모션 종료 시각. null 이면 화면에서 할인 표기가 사라진다.
ALTER TABLE entitlement_settings
  ADD COLUMN IF NOT EXISTS promotion_ends_at TIMESTAMPTZ;

-- 20260723_add_security_primitives 의 기본 거부 목록은 하드코딩이라 이후 생긴
-- 테이블을 포함하지 못한다. 나머지 애플리케이션 테이블과 같은 상태로 맞춘다.
DO $$
DECLARE
  policy_name TEXT;
BEGIN
  IF to_regclass('public.premium_products') IS NULL THEN
    RETURN;
  END IF;

  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'premium_products'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.premium_products', policy_name);
  END LOOP;

  ALTER TABLE public.premium_products ENABLE ROW LEVEL SECURITY;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.premium_products FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.premium_products FROM authenticated;
  END IF;
END
$$;
```

- [ ] **Step 5: 스키마 검증과 클라이언트 재생성**

```bash
pnpm exec prisma validate && pnpm exec prisma generate
```

기대: `The schema at prisma/schema.prisma is valid` 후 `Generated Prisma Client`.

- [ ] **Step 6: 타입 체크**

```bash
pnpm check
```

기대: 통과. (이 태스크는 TS 소비자를 아직 만들지 않으므로 회귀만 확인한다.)

- [ ] **Step 7: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations/20260903_add_premium_products/migration.sql
git commit -m "$(cat <<'EOF'
feat: add a premium product catalog schema

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 카탈로그 조회 함수

**Files:**
- Create: `lib/premium-products.js`
- Test: `lib/premium-products.test.js`

**Interfaces:**
- Consumes: Task 1의 `prisma.premiumProduct` 델리게이트
- Produces:
  - `listActivePremiumProducts(tx) -> Promise<Array<{id, name, credits, listPriceKrw, salePriceKrw, badge}>>`
  - `findPurchasableProduct(tx, productId) -> Promise<{id, credits, checkoutUrl} | null>`
  - `findProductContentId(tx, productId) -> Promise<string | null>`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/premium-products.test.js`:

```js
import { describe, expect, it, vi } from "vitest";

import {
  findProductContentId,
  findPurchasableProduct,
  listActivePremiumProducts,
} from "./premium-products.js";

function createTx({ findFirst, findMany, findUnique } = {}) {
  return {
    premiumProduct: {
      findFirst: findFirst ?? vi.fn(),
      findMany: findMany ?? vi.fn(),
      findUnique: findUnique ?? vi.fn(),
    },
  };
}

describe("listActivePremiumProducts", () => {
  it("returns active products in display order without leaking the checkout URL", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "credits_1", name: "1회권", credits: 1, listPriceKrw: 9900, salePriceKrw: 5900, badge: null },
    ]);

    const products = await listActivePremiumProducts(createTx({ findMany }));

    expect(products).toEqual([
      { id: "credits_1", name: "1회권", credits: 1, listPriceKrw: 9900, salePriceKrw: 5900, badge: null },
    ]);
    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ active: true });
    expect(args.orderBy).toEqual({ sortOrder: "asc" });
    // 체크아웃 URL 은 구매 의도 생성 시점에만 서버가 발급한다.
    expect(args.select.checkoutUrl).toBeUndefined();
  });
});

describe("findPurchasableProduct", () => {
  it("looks up an active product by id", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "credits_3",
      credits: 3,
      checkoutUrl: "https://www.groble.im/payment/AAA",
    });

    const product = await findPurchasableProduct(createTx({ findFirst }), "credits_3");

    expect(product).toEqual({
      id: "credits_3",
      credits: 3,
      checkoutUrl: "https://www.groble.im/payment/AAA",
    });
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "credits_3", active: true });
  });

  it("rejects a blank id without querying", async () => {
    const findFirst = vi.fn();

    await expect(findPurchasableProduct(createTx({ findFirst }), "")).resolves.toBeNull();
    await expect(findPurchasableProduct(createTx({ findFirst }), undefined)).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("findProductContentId", () => {
  it("returns the Groble content id of a product even when it is no longer sold", async () => {
    // 비활성 상품이어도 이미 결제된 웹훅은 검증되어야 한다.
    const findUnique = vi.fn().mockResolvedValue({ grobleContentId: "content-3" });

    await expect(findProductContentId(createTx({ findUnique }), "credits_3")).resolves.toBe(
      "content-3",
    );
    expect(findUnique.mock.calls[0][0].where).toEqual({ id: "credits_3" });
  });

  it("returns null for an unknown product", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    await expect(findProductContentId(createTx({ findUnique }), "credits_9")).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
pnpm exec vitest run lib/premium-products.test.js
```

기대: FAIL — `Failed to load .../lib/premium-products.js`

- [ ] **Step 3: 최소 구현**

`lib/premium-products.js`:

```js
// 유료 이용권 상품 카탈로그 조회. 상품을 늘리는 일이 코드 변경이 되지 않도록,
// 상품 ID 를 하드코딩하는 곳은 이 파일에도 두지 않는다.

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/** 판매 중인 상품을 화면 표시 순서대로. 체크아웃 URL 은 의도적으로 뺀다. */
export async function listActivePremiumProducts(tx) {
  return tx.premiumProduct.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      credits: true,
      listPriceKrw: true,
      salePriceKrw: true,
      badge: true,
    },
  });
}

/** 구매 의도를 만들 때 쓰는 조회. 판매 중인 상품만 통과한다. */
export async function findPurchasableProduct(tx, productId) {
  if (!isNonEmptyString(productId)) {
    return null;
  }

  return tx.premiumProduct.findFirst({
    where: { id: productId, active: true },
    select: { id: true, credits: true, checkoutUrl: true },
  });
}

/**
 * 웹훅 검증용. 구매 의도가 가리키는 상품의 Groble 콘텐츠 ID.
 * 이미 결제된 건은 상품이 은퇴한 뒤에도 검증돼야 하므로 active 를 걸지 않는다.
 */
export async function findProductContentId(tx, productId) {
  if (!isNonEmptyString(productId)) {
    return null;
  }

  const product = await tx.premiumProduct.findUnique({
    where: { id: productId },
    select: { grobleContentId: true },
  });

  return product?.grobleContentId ?? null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm exec vitest run lib/premium-products.test.js
```

기대: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/premium-products.js lib/premium-products.test.js
git commit -m "$(cat <<'EOF'
feat: add premium product catalog lookups

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 웹훅이 구매 의도의 상품과 대조하고 스냅샷 크레딧을 지급

**Files:**
- Modify: `lib/groble-webhook-handler.js` (`parseGroblePaidEvent`, `createGrobleWebhookHandler`)
- Modify: `lib/analysis-entitlements.js:143-176` (`grantGroblePurchase`)
- Test: `tests/api/groble-webhook-handler.test.js`, `lib/analysis-entitlements.test.js`

**Interfaces:**
- Consumes: Task 2의 `findProductContentId(tx, productId)`
- Produces:
  - `parseGroblePaidEvent(body) -> { contentId, providerPaymentId, purchaseIntentId, rawEvent }` — **`premiumContentId` 두 번째 인자를 제거**
  - `grantGroblePurchase(tx, { credits, providerPaymentId, rawEvent, userId }) -> { granted, credits }` — **`credits`를 호출자가 넘긴다**
  - `createGrobleWebhookHandler({ logger, now, prismaClient, readRawBody, webhookSecret })` — **`premiumContentId` 옵션 제거**

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/api/groble-webhook-handler.test.js`에 아래를 추가하고, 기존 테스트에서 `premiumContentId` 옵션과 `CONTENT_ID` 불일치 케이스를 새 형태로 옮긴다. 목 객체에 `premiumProduct.findUnique`를 추가해야 한다.

```js
// mocks.prisma 에 추가:
//   premiumProduct: { findUnique: vi.fn() },

it("grants the credits snapshotted on the purchase intent, not a global setting", async () => {
  mocks.prisma.purchaseIntent.findUnique.mockResolvedValue({
    id: INTENT_ID,
    status: "PENDING",
    userId: USER_ID,
    productId: "credits_1",
    credits: 1,
  });
  mocks.prisma.premiumProduct.findUnique.mockResolvedValue({ grobleContentId: CONTENT_ID });
  mocks.prisma.paymentEntitlement.findUnique.mockResolvedValue(null);
  mocks.prisma.purchaseIntent.updateMany.mockResolvedValue({ count: 1 });
  mocks.grantGroblePurchase.mockResolvedValue({ granted: true, credits: 1 });

  const response = await invokeWebhook();

  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({ ok: true, grantedCredits: 1 });
  expect(mocks.grantGroblePurchase).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ credits: 1, userId: USER_ID }),
  );
});

it("rejects a payment for a product the purchase intent did not name", async () => {
  mocks.prisma.purchaseIntent.findUnique.mockResolvedValue({
    id: INTENT_ID,
    status: "PENDING",
    userId: USER_ID,
    productId: "credits_1",
    credits: 1,
  });
  // 결제된 콘텐츠와 구매 의도의 상품이 다르다.
  mocks.prisma.premiumProduct.findUnique.mockResolvedValue({
    grobleContentId: "some-other-content",
  });

  const response = await invokeWebhook();

  expect(response.statusCode).toBe(422);
  expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
});

it("rejects a payment whose purchase intent points at a missing product", async () => {
  mocks.prisma.purchaseIntent.findUnique.mockResolvedValue({
    id: INTENT_ID,
    status: "PENDING",
    userId: USER_ID,
    productId: "credits_gone",
    credits: 3,
  });
  mocks.prisma.premiumProduct.findUnique.mockResolvedValue(null);

  const response = await invokeWebhook();

  expect(response.statusCode).toBe(422);
  expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
});
```

`lib/analysis-entitlements.test.js`에 추가:

```js
it("grants the credits the caller passes instead of reading entitlement settings", async () => {
  // 설정값(3)이 아니라 호출자가 준 1이 지급돼야 한다.
  const tx = createEntitlementTx({ premiumCreditsPerPurchase: 3 });

  const result = await grantGroblePurchase(tx, {
    credits: 1,
    providerPaymentId: "payment-1",
    rawEvent: { type: "payment.completed" },
    userId: USER_ID,
  });

  expect(result).toEqual({ granted: true, credits: 1 });
  expect(tx.entitlementSetting.findUnique).not.toHaveBeenCalled();
  expect(tx.analysisEntitlement.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: { premiumCreditsGranted: { increment: 1 } } }),
  );
});

it("refuses a credit amount outside the allowed range", async () => {
  const tx = createEntitlementTx({});

  await expect(
    grantGroblePurchase(tx, {
      credits: 0,
      providerPaymentId: "payment-2",
      rawEvent: {},
      userId: USER_ID,
    }),
  ).rejects.toMatchObject({ code: "INVALID_CREDIT_AMOUNT" });
});
```

> `createEntitlementTx`는 해당 파일의 기존 헬퍼를 따른다. 없으면 파일 상단의 기존 목 구성 방식을 그대로 복제해 만든다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
pnpm exec vitest run tests/api/groble-webhook-handler.test.js lib/analysis-entitlements.test.js
```

기대: FAIL — 새 케이스에서 `grantGroblePurchase`가 설정값 3을 지급하거나, 상품 대조가 없어 200이 나온다.

- [ ] **Step 3: `grantGroblePurchase`가 스냅샷 크레딧을 받도록 변경**

`lib/analysis-entitlements.js`의 함수 앞부분만 바꾼다.

```js
export async function grantGroblePurchase(tx, input) {
  // 지급 수량은 구매 의도가 결제 시점에 고정한 값이다. 전역 설정을 읽지 않는다 —
  // 의도 생성 이후 상품이 바뀌어도 사용자가 본 조건대로 지급돼야 한다.
  const credits = input.credits;
  assertCreditAmount(credits);

  const entitlement = await getLockedEntitlement(tx, input.userId);

  const insertedPayment = await tx.$queryRaw`
    INSERT INTO payment_entitlements (
```

이후 본문(`INSERT` ~ `return`)은 그대로 둔다. `const settings = await tx.entitlementSetting.findUnique(...)` 줄과 `const credits = settings?.premiumCreditsPerPurchase ?? 3;` 줄을 삭제한다.

> `assertCreditAmount`는 같은 파일 아래(`:178`)에 이미 있다. 호출부가 정의보다 위에 오지만 함수 선언은 호이스팅되므로 문제없다.

- [ ] **Step 4: `parseGroblePaidEvent`에서 환경변수 대조를 제거**

`lib/groble-webhook-handler.js`:

```js
export function parseGroblePaidEvent(body) {
  if (!isRecord(body)) {
    throw new GrobleWebhookError("MALFORMED_GROBLE_PAYLOAD", 400);
  }

  if (body.type !== "payment.completed") {
    throw new GrobleWebhookError("UNSUPPORTED_GROBLE_EVENT", 400);
  }

  const object = body.data?.object;
  if (
    !isRecord(object) ||
    !isNonEmptyString(object.content?.id) ||
    !isNonEmptyString(object.merchantUid) ||
    !isNonEmptyString(object.sellerReference)
  ) {
    throw new GrobleWebhookError("MALFORMED_GROBLE_PAID_EVENT", 400);
  }

  if (!isPurchaseIntentId(object.sellerReference)) {
    throw new GrobleWebhookError("UNLINKED_PURCHASE_INTENT", 422);
  }

  // 어떤 상품인지는 구매 의도를 조회해야 알 수 있으므로 검증은 트랜잭션으로 넘긴다.
  return {
    contentId: object.content.id,
    providerPaymentId: object.merchantUid,
    purchaseIntentId: object.sellerReference,
    rawEvent: {
      contentId: object.content.id,
      eventId: isNonEmptyString(body.id) ? body.id : undefined,
      merchantUid: object.merchantUid,
      purchasedAt: parsePurchasedAt(object.payment?.purchasedAt),
      type: body.type,
    },
  };
}
```

- [ ] **Step 5: 핸들러가 구매 의도의 상품과 대조하도록 변경**

같은 파일. `import { findProductContentId } from "./premium-products.js";`를 추가하고, 팩토리 옵션에서 `premiumContentId`를 지운 뒤 트랜잭션을 고친다.

```js
export function createGrobleWebhookHandler({
  logger = console.warn,
  now = Date.now,
  prismaClient = prisma,
  readRawBody = readGrobleRawBody,
  webhookSecret = process.env.GROBLE_WEBHOOK_SECRET,
} = {}) {
```

`event = parseGroblePaidEvent(body, premiumContentId);` → `event = parseGroblePaidEvent(body);`

트랜잭션 안, `purchaseIntent` 조회에 스냅샷 컬럼을 더하고 그 아래에 상품 대조를 넣는다.

```js
        const purchaseIntent = await tx.purchaseIntent.findUnique({
          where: { id: event.purchaseIntentId },
          select: {
            id: true,
            status: true,
            userId: true,
            productId: true,
            credits: true,
          },
        });

        if (!purchaseIntent) {
          throw new GrobleWebhookError("UNLINKED_PURCHASE_INTENT", 422);
        }

        // 결제된 Groble 콘텐츠가 이 구매 의도의 상품과 같아야 한다.
        // 다른 상품 결제로 비싼 이용권을 받는 경로를 막는다.
        const expectedContentId = await findProductContentId(tx, purchaseIntent.productId);
        if (expectedContentId === null || expectedContentId !== event.contentId) {
          throw new GrobleWebhookError("UNEXPECTED_GROBLE_PRODUCT", 422);
        }
```

마지막 지급 호출에 스냅샷 크레딧을 넘긴다.

```js
        return grantGroblePurchase(tx, {
          credits: purchaseIntent.credits,
          providerPaymentId: event.providerPaymentId,
          rawEvent: event.rawEvent,
          userId: purchaseIntent.userId,
        });
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
pnpm exec vitest run tests/api/groble-webhook-handler.test.js lib/analysis-entitlements.test.js lib/premium-products.test.js
```

기대: PASS. `GROBLE_PREMIUM_PRODUCT_NOT_CONFIGURED`를 기대하던 기존 테스트가 있으면 그 코드는 더 이상 도달 불가이므로 케이스를 삭제한다.

- [ ] **Step 7: 사용하지 않게 된 환경변수 정리**

`GROBLE_PREMIUM_CONTENT_ID`를 참조하는 곳이 남아 있는지 확인하고, `.env.example`에 항목이 있으면 지운다.

```bash
grep -rn "GROBLE_PREMIUM_CONTENT_ID" --include="*.js" --include="*.ts" --include="*.md" --include="*.example" . | grep -v node_modules
```

기대: 결과 없음. (배포 환경의 Vercel 환경변수 삭제는 Task 8의 운영 절차에 남긴다.)

- [ ] **Step 8: 커밋**

```bash
git add lib/groble-webhook-handler.js lib/analysis-entitlements.js tests/api/groble-webhook-handler.test.js lib/analysis-entitlements.test.js
git commit -m "$(cat <<'EOF'
feat: verify Groble payments against the purchase intent's product

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 구매 의도가 상품을 받는다

**Files:**
- Modify: `api/entitlements.js` (`createPurchaseIntent`, `handler`)
- Test: `tests/api/entitlements.test.js`

**Interfaces:**
- Consumes: Task 2의 `findPurchasableProduct(tx, productId)`
- Produces: `POST /api/entitlements/purchase-intents?productId=<id>` → `201 { purchaseIntentId, checkoutUrl }`. 생성된 `PurchaseIntent`에 `productId`·`credits` 스냅샷.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/api/entitlements.test.js`. `mocks.prisma`에 `premiumProduct: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() }`를 추가한다.

```js
describe("POST /api/entitlements/purchase-intents", () => {
  it("creates an intent for the requested product and snapshots its credits", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true });
    mocks.prisma.premiumProduct.findFirst.mockResolvedValue({
      id: "credits_3",
      credits: 3,
      checkoutUrl: CHECKOUT_URL,
    });
    mocks.prisma.purchaseIntent.create.mockResolvedValue({ id: INTENT_ID });

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?productId=credits_3",
      query: { purchaseIntent: "1", productId: "credits_3" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      purchaseIntentId: INTENT_ID,
      checkoutUrl: `${CHECKOUT_URL}?ref=${INTENT_ID}`,
    });
    expect(mocks.prisma.purchaseIntent.create).toHaveBeenCalledWith({
      data: { status: "PENDING", userId: mocks.authenticatedUser.id, productId: "credits_3", credits: 3 },
    });
  });

  it("reads the product from the raw url when the rewrite drops the parsed query", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true });
    mocks.prisma.premiumProduct.findFirst.mockResolvedValue({
      id: "credits_1",
      credits: 1,
      checkoutUrl: CHECKOUT_URL,
    });
    mocks.prisma.purchaseIntent.create.mockResolvedValue({ id: INTENT_ID });

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?productId=credits_1",
      query: { purchaseIntent: "1" },
    });

    expect(response.statusCode).toBe(201);
    expect(mocks.prisma.premiumProduct.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "credits_1", active: true } }),
    );
  });

  it("rejects an unknown product before creating an intent", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true });
    mocks.prisma.premiumProduct.findFirst.mockResolvedValue(null);

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?productId=credits_99",
      query: { purchaseIntent: "1", productId: "credits_99" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "UNKNOWN_PREMIUM_PRODUCT" });
    expect(mocks.prisma.purchaseIntent.create).not.toHaveBeenCalled();
  });

  it("refuses every product while premium sales are switched off", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: false });

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?productId=credits_3",
      query: { purchaseIntent: "1", productId: "credits_3" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: "PREMIUM_SALES_DISABLED" });
    expect(mocks.prisma.premiumProduct.findFirst).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
pnpm exec vitest run tests/api/entitlements.test.js
```

기대: FAIL — `purchaseIntent.create`가 `productId`/`credits` 없이 호출된다.

- [ ] **Step 3: 구현**

`api/entitlements.js` 상단 import에 추가:

```js
import { findPurchasableProduct, listActivePremiumProducts } from "../lib/premium-products.js";
```

`createPurchaseIntent`를 교체한다. 기존의 `TODO(유료 오픈)` 주석 블록은 그대로 위에 남긴다.

```js
/**
 * 상품 지정을 쿼리로 받는 이유: 이 함수는 웹훅 HMAC 검증 때문에 bodyParser 가 꺼져
 * 있어(config.api.bodyParser=false) 요청 본문을 읽을 수 없다. 상품 ID 는 개인정보가
 * 아니므로 URL 에 실려도 무방하다.
 */
function readProductId(req) {
  const fromQuery = req.query?.productId;
  if (typeof fromQuery === "string" && fromQuery.length > 0) {
    return fromQuery;
  }

  // Vercel rewrite 가 쿼리를 합쳐 주지 못하는 경우를 대비한 이중 경로.
  return new URL(req.url ?? "/", "http://localhost").searchParams.get("productId") ?? "";
}

async function createPurchaseIntent(req, res, user) {
  const settings = await prisma.entitlementSetting.findUnique({
    where: { id: SETTINGS_ID },
    select: { premiumEnabled: true },
  });

  if (!settings?.premiumEnabled) {
    return res.status(403).json({ error: "PREMIUM_SALES_DISABLED" });
  }

  const product = await findPurchasableProduct(prisma, readProductId(req));
  if (!product) {
    return res.status(400).json({ error: "UNKNOWN_PREMIUM_PRODUCT" });
  }

  if (!product.checkoutUrl) {
    return res.status(503).json({ error: "PREMIUM_CHECKOUT_NOT_CONFIGURED" });
  }

  const purchaseIntent = await prisma.purchaseIntent.create({
    data: {
      status: "PENDING",
      userId: user.id,
      productId: product.id,
      credits: product.credits,
    },
  });
  const checkoutUrl = new URL(product.checkoutUrl);
  checkoutUrl.searchParams.set("ref", purchaseIntent.id);

  return res.status(201).json({
    purchaseIntentId: purchaseIntent.id,
    checkoutUrl: checkoutUrl.toString(),
  });
}
```

`handler`의 디스패치를 고친다.

```js
    if (req.method === "POST" && isPurchaseIntentPath(req)) {
      return createPurchaseIntent(req, res, user);
    }
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm exec vitest run tests/api/entitlements.test.js
```

기대: PASS

- [ ] **Step 5: 커밋**

```bash
git add api/entitlements.js tests/api/entitlements.test.js
git commit -m "$(cat <<'EOF'
feat: take a product id when starting a premium purchase

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 요약 응답이 상품 목록과 프로모션 종료 시각을 반환

**Files:**
- Modify: `api/entitlements.js` (`getEntitlements`)
- Test: `tests/api/entitlements.test.js`

**Interfaces:**
- Consumes: Task 2의 `listActivePremiumProducts(tx)`
- Produces: `GET /api/entitlements` 응답에 `products: Array<{id,name,credits,listPriceKrw,salePriceKrw,badge}>`와 `promotionEndsAt: string | null`. **`groblePaymentUrl` 필드 제거.**

- [ ] **Step 1: 실패하는 테스트 작성**

```js
describe("GET /api/entitlements", () => {
  it("returns the active product catalog and the promotion deadline", async () => {
    mocks.getEntitlementSummary.mockResolvedValue({
      premiumEnabled: true,
      freeRemaining: 0,
      bonusRemaining: 0,
      premiumRemaining: 2,
      remaining: 2,
    });
    mocks.prisma.$transaction.mockImplementation((fn) => fn(mocks.transaction));
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      premiumEnabled: true,
      promotionEndsAt: new Date("2026-11-30T14:59:59.000Z"),
    });
    mocks.prisma.premiumProduct.findMany.mockResolvedValue([
      { id: "credits_1", name: "1회권", credits: 1, listPriceKrw: 9900, salePriceKrw: 5900, badge: null },
      { id: "credits_3", name: "3회권", credits: 3, listPriceKrw: 29700, salePriceKrw: 14900, badge: "가장 많이 선택" },
    ]);
    mocks.hasClaimedFeedbackReward.mockResolvedValue(false);

    const response = await invokeEntitlements();

    expect(response.statusCode).toBe(200);
    expect(response.body.promotionEndsAt).toBe("2026-11-30T14:59:59.000Z");
    expect(response.body.products).toHaveLength(2);
    expect(response.body.products[1]).toEqual({
      id: "credits_3", name: "3회권", credits: 3,
      listPriceKrw: 29700, salePriceKrw: 14900, badge: "가장 많이 선택",
    });
    // 체크아웃 URL 은 구매 의도 생성 시점에만 발급한다.
    expect(response.body).not.toHaveProperty("groblePaymentUrl");
    expect(response.body.products[0]).not.toHaveProperty("checkoutUrl");
  });

  it("hides the catalog while premium sales are switched off", async () => {
    mocks.getEntitlementSummary.mockResolvedValue({
      premiumEnabled: false,
      freeRemaining: 1,
      bonusRemaining: 0,
      premiumRemaining: 0,
      remaining: 1,
    });
    mocks.prisma.$transaction.mockImplementation((fn) => fn(mocks.transaction));
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      premiumEnabled: false,
      promotionEndsAt: null,
    });
    mocks.hasClaimedFeedbackReward.mockResolvedValue(false);

    const response = await invokeEntitlements();

    expect(response.statusCode).toBe(200);
    expect(response.body.products).toEqual([]);
    expect(response.body.promotionEndsAt).toBeNull();
    expect(mocks.prisma.premiumProduct.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
pnpm exec vitest run tests/api/entitlements.test.js
```

기대: FAIL — 응답에 `products`가 없고 `groblePaymentUrl`이 남아 있다.

- [ ] **Step 3: 구현**

```js
async function getEntitlements(res, user) {
  const [summary, settings, feedbackRewardClaimed] = await Promise.all([
    prisma.$transaction((tx) => getEntitlementSummary(tx, user.id)),
    prisma.entitlementSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { premiumEnabled: true, promotionEndsAt: true },
    }),
    hasClaimedFeedbackReward(prisma, user.id),
  ]);

  // 판매 스위치가 꺼져 있으면 카탈로그를 조회조차 하지 않는다.
  const products = settings?.premiumEnabled ? await listActivePremiumProducts(prisma) : [];

  return res.status(200).json({
    ...summary,
    products,
    promotionEndsAt: settings?.promotionEndsAt?.toISOString() ?? null,
    feedbackRewardClaimed,
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm exec vitest run tests/api/entitlements.test.js
```

기대: PASS. `groblePaymentUrl`을 기대하던 기존 케이스는 위 두 케이스로 대체하고 삭제한다.

- [ ] **Step 5: 커밋**

```bash
git add api/entitlements.js tests/api/entitlements.test.js
git commit -m "$(cat <<'EOF'
feat: return the premium product catalog from the entitlements summary

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 클라이언트 파서와 가격 표시 유틸

**Files:**
- Create: `client/src/lib/pricing.ts`
- Test: `client/src/lib/pricing.test.ts`
- Modify: `client/src/lib/entitlements.ts`
- Test: `client/src/lib/entitlements.test.ts`

**Interfaces:**
- Consumes: Task 5의 응답 형태
- Produces:
  - `type PremiumProduct = { id: string; name: string; credits: number; listPriceKrw: number; salePriceKrw: number; badge: string | null }`
  - `EntitlementSummary`에 `products: PremiumProduct[]`, `promotionEndsAt: string | null` 추가, `groblePaymentUrl` 제거
  - `createPurchaseIntent(accessToken, productId, fetcher?)` — **`productId` 인자 추가**
  - `formatKrw(n) -> string`, `discountPercent(p) -> number`, `pricePerCredit(p) -> number`, `formatPromotionDeadline(iso) -> string`, `hasDiscount(p) -> boolean`

- [ ] **Step 1: 표시 유틸의 실패하는 테스트 작성**

`client/src/lib/pricing.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  discountPercent,
  formatKrw,
  formatPromotionDeadline,
  hasDiscount,
  pricePerCredit,
  type PremiumProduct,
} from "./pricing";

const SINGLE: PremiumProduct = {
  id: "credits_1", name: "1회권", credits: 1,
  listPriceKrw: 9900, salePriceKrw: 5900, badge: null,
};

const TRIPLE: PremiumProduct = {
  id: "credits_3", name: "3회권", credits: 3,
  listPriceKrw: 29700, salePriceKrw: 14900, badge: "가장 많이 선택",
};

describe("formatKrw", () => {
  it("groups thousands", () => {
    expect(formatKrw(14900)).toBe("14,900원");
    expect(formatKrw(0)).toBe("0원");
  });
});

describe("discountPercent", () => {
  it("rounds down so the advertised discount never overstates the real one", () => {
    // 14,900 / 29,700 = 49.83% -> 49%. 표시광고법상 할인율 과장이 되면 안 된다.
    expect(discountPercent(TRIPLE)).toBe(49);
    expect(discountPercent(SINGLE)).toBe(40);
  });

  it("is zero when the product is not discounted", () => {
    expect(discountPercent({ ...TRIPLE, listPriceKrw: 14900 })).toBe(0);
  });
});

describe("pricePerCredit", () => {
  it("rounds up to ten won so the unit price never looks cheaper than it is", () => {
    // 14,900 / 3 = 4,966.7 -> 4,970
    expect(pricePerCredit(TRIPLE)).toBe(4970);
    expect(pricePerCredit(SINGLE)).toBe(5900);
  });
});

describe("hasDiscount", () => {
  it("is false once the list price matches the sale price", () => {
    // 11/30 프로모션 종료는 이 값 하나로 화면 전체에서 할인 표기를 지운다.
    expect(hasDiscount(TRIPLE)).toBe(true);
    expect(hasDiscount({ ...TRIPLE, listPriceKrw: 14900 })).toBe(false);
  });
});

describe("formatPromotionDeadline", () => {
  it("renders the deadline in Seoul time", () => {
    // 2026-11-30T23:59:59+09:00
    expect(formatPromotionDeadline("2026-11-30T14:59:59.000Z")).toBe("11월 30일");
  });

  it("returns an empty string for an unparseable value", () => {
    expect(formatPromotionDeadline("nope")).toBe("");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
pnpm exec vitest run client/src/lib/pricing.test.ts
```

기대: FAIL — `Failed to resolve import "./pricing"`

- [ ] **Step 3: `client/src/lib/pricing.ts` 구현**

```ts
export type PremiumProduct = {
  id: string;
  name: string;
  credits: number;
  /** 정가. 표시광고법상 종전거래가격이라 실제 판매 이력이 있어야 한다. */
  listPriceKrw: number;
  /** 실제 결제 금액. */
  salePriceKrw: number;
  badge: string | null;
};

export function formatKrw(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function hasDiscount(product: PremiumProduct): boolean {
  return product.listPriceKrw > product.salePriceKrw;
}

/**
 * 표시용 할인율. 실제보다 크게 보이지 않도록 내림한다
 * (14,900 / 29,700 = 49.83% -> 49%).
 */
export function discountPercent(product: PremiumProduct): number {
  if (!hasDiscount(product)) return 0;

  return Math.floor(
    ((product.listPriceKrw - product.salePriceKrw) / product.listPriceKrw) * 100
  );
}

/**
 * 표시용 회당 단가. 실제보다 싸 보이지 않도록 10원 단위로 올린다
 * (14,900 / 3 = 4,966.7 -> 4,970).
 */
export function pricePerCredit(product: PremiumProduct): number {
  if (product.credits <= 0) return product.salePriceKrw;

  return Math.ceil(product.salePriceKrw / product.credits / 10) * 10;
}

/** "2026-11-30T14:59:59.000Z" -> "11월 30일" (서울 기준) */
export function formatPromotionDeadline(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).format(date);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm exec vitest run client/src/lib/pricing.test.ts
```

기대: PASS (8 tests)

- [ ] **Step 5: 응답 파서의 실패하는 테스트 작성**

`client/src/lib/entitlements.test.ts`에 추가:

```ts
it("parses the product catalog and the promotion deadline", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        premiumEnabled: true,
        freeRemaining: 0,
        premiumRemaining: 2,
        remaining: 2,
        promotionEndsAt: "2026-11-30T14:59:59.000Z",
        products: [
          { id: "credits_1", name: "1회권", credits: 1, listPriceKrw: 9900, salePriceKrw: 5900, badge: null },
        ],
        feedbackRewardClaimed: false,
      }),
      { status: 200 }
    )
  );

  const summary = await fetchEntitlementSummary("token", fetcher);

  expect(summary.promotionEndsAt).toBe("2026-11-30T14:59:59.000Z");
  expect(summary.products).toEqual([
    { id: "credits_1", name: "1회권", credits: 1, listPriceKrw: 9900, salePriceKrw: 5900, badge: null },
  ]);
});

it("rejects a malformed product entry instead of rendering a wrong price", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        premiumEnabled: true,
        freeRemaining: 0,
        premiumRemaining: 0,
        remaining: 0,
        promotionEndsAt: null,
        products: [{ id: "credits_1", name: "1회권", credits: 1, listPriceKrw: "9900", salePriceKrw: 5900, badge: null }],
        feedbackRewardClaimed: false,
      }),
      { status: 200 }
    )
  );

  await expect(fetchEntitlementSummary("token", fetcher)).rejects.toThrow(EntitlementApiError);
});

it("sends the chosen product when starting a purchase", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ purchaseIntentId: "intent-1", checkoutUrl: "https://example.test/pay" }),
      { status: 201 }
    )
  );

  await createPurchaseIntent("token", "credits_3", fetcher);

  expect(fetcher).toHaveBeenCalledWith(
    "/api/entitlements/purchase-intents?productId=credits_3",
    expect.objectContaining({ method: "POST" })
  );
});
```

- [ ] **Step 6: 테스트가 실패하는지 확인**

```bash
pnpm exec vitest run client/src/lib/entitlements.test.ts
```

기대: FAIL — `summary.products`가 `undefined`이고 `createPurchaseIntent`가 두 번째 인자를 무시한다.

- [ ] **Step 7: 파서 구현**

`client/src/lib/entitlements.ts`. `PremiumProduct` 타입은 `pricing.ts`에서 재수출한다.

```ts
import type { PremiumProduct } from "./pricing";

export type { PremiumProduct };

export type EntitlementSummary = {
  premiumEnabled: boolean;
  freeRemaining: number;
  premiumRemaining: number;
  remaining: number;
  products: PremiumProduct[];
  promotionEndsAt: string | null;
  feedbackRewardClaimed: boolean;
};
```

`parseEntitlementSummary` 안의 `groblePaymentUrl` 검증 블록을 지우고 아래 헬퍼와 필드를 넣는다.

```ts
function readPremiumProduct(value: unknown): PremiumProduct {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    (value.badge !== null && typeof value.badge !== "string")
  ) {
    throw new EntitlementApiError("Invalid product response");
  }

  return {
    id: value.id,
    name: value.name,
    credits: readNonNegativeInteger(value.credits, "product credits"),
    listPriceKrw: readNonNegativeInteger(value.listPriceKrw, "product listPriceKrw"),
    salePriceKrw: readNonNegativeInteger(value.salePriceKrw, "product salePriceKrw"),
    badge: value.badge,
  };
}

function readPremiumProducts(value: unknown): PremiumProduct[] {
  // 구버전 응답에도 화면이 깨지지 않도록 없으면 "판매 상품 없음"으로 본다.
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new EntitlementApiError("Invalid products response");
  }

  return value.map(readPremiumProduct);
}
```

`return { ... }`에 다음 두 필드를 넣고 `groblePaymentUrl`을 뺀다.

```ts
    products: readPremiumProducts(payload.products),
    promotionEndsAt:
      typeof payload.promotionEndsAt === "string" ? payload.promotionEndsAt : null,
```

`createPurchaseIntent` 시그니처를 바꾼다.

```ts
export async function createPurchaseIntent(
  accessToken: string,
  productId: string,
  fetcher: typeof fetch = fetch
): Promise<PurchaseIntent> {
  const response = await fetcher(
    `/api/entitlements/purchase-intents?productId=${encodeURIComponent(productId)}`,
    {
      method: "POST",
      headers: getAuthorizationHeaders(accessToken),
    }
  );
```

이후 본문은 그대로 둔다.

- [ ] **Step 8: 테스트와 타입 확인**

```bash
pnpm exec vitest run client/src/lib/entitlements.test.ts client/src/lib/pricing.test.ts && pnpm check
```

기대: 테스트 PASS. `pnpm check`는 `Entitlements.tsx`가 아직 옛 시그니처를 쓰므로 **실패한다** — Task 7에서 해소된다. 실패가 `client/src/pages/Entitlements.tsx`에만 국한되는지 확인한다.

- [ ] **Step 9: 커밋**

```bash
git add client/src/lib/pricing.ts client/src/lib/pricing.test.ts client/src/lib/entitlements.ts client/src/lib/entitlements.test.ts
git commit -m "$(cat <<'EOF'
feat: parse the premium product catalog on the client

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 이용권 페이지 3카드 UI

**Files:**
- Modify: `client/src/pages/Entitlements.tsx`
- Test: `client/src/pages/Entitlements.test.ts`

**Interfaces:**
- Consumes: Task 6의 `EntitlementSummary.products`·`promotionEndsAt`, `pricing.ts` 4함수, `createPurchaseIntent(accessToken, productId)`
- Produces: 없음 (최종 소비자)

- [ ] **Step 1: 실패하는 테스트 작성**

`client/src/pages/Entitlements.test.ts`. 기존 `9,900원`·`회당 3,300원` 단언을 지우고 아래로 대체한다.

```ts
it("renders prices from the server catalog instead of hardcoding them", () => {
  // 11/30 프로모션 종료를 배포 없이 SQL 로 처리하려면 가격이 코드에 있으면 안 된다.
  expect(pageSource).not.toContain("9,900원");
  expect(pageSource).not.toContain("14,900원");
  expect(pageSource).not.toContain("5,900원");
  expect(pageSource).toContain("formatKrw");
  expect(pageSource).toContain("discountPercent");
  expect(pageSource).toContain("pricePerCredit");
  expect(pageSource).toContain("summary.products");
});

it("shows the strikethrough list price only while the product is discounted", () => {
  expect(pageSource).toContain("hasDiscount");
  expect(pageSource).toContain("line-through");
  // 프로모션 마감일도 서버 값에서 파생한다
  expect(pageSource).toContain("formatPromotionDeadline");
  expect(pageSource).toContain("하반기 채용 시즌 할인");
});

it("anchors the price against expert review before showing any number", () => {
  expect(pageSource).toContain("전문가 첨삭");
});

it("orders the plans free -> single -> bundle", () => {
  expect(pageSource).toContain("무료 체험");
  expect(pageSource.indexOf("무료 체험")).toBeLessThan(pageSource.indexOf("summary.products"));
});

it("passes the chosen product to the purchase call", () => {
  expect(pageSource).toContain("createPurchaseIntent(accessToken, productId)");
});
```

기존 케이스 중 `summary.premiumEnabled && summary.groblePaymentUrl` 단언은 `summary.products.length > 0`으로 바꾼다. `현재 추가 이용권 판매를 준비하고 있어요.` · `결제 창이 열리지 않았다면` · `mailto:hansitoring@gmail.com` · `이메일로 문의하기` 단언은 **그대로 유지**한다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
pnpm exec vitest run client/src/pages/Entitlements.test.ts
```

기대: FAIL — 페이지에 `9,900원`이 하드코딩돼 있다.

- [ ] **Step 3: 카드 컴포넌트 추가**

`client/src/pages/Entitlements.tsx`의 import에 추가한다.

```tsx
import {
  createPurchaseIntent,
  fetchEntitlementSummary,
  type EntitlementSummary,
  type PremiumProduct,
} from "@/lib/entitlements";
import {
  discountPercent,
  formatKrw,
  formatPromotionDeadline,
  hasDiscount,
  pricePerCredit,
} from "@/lib/pricing";
```

`CreditSummaryRow` 아래에 모듈 스코프 컴포넌트 두 개를 넣는다.

```tsx
const PLAN_CARD =
  "flex h-full flex-col rounded-2xl border p-7 md:p-8";

function FreePlanCard({ onStart }: { onStart: () => void }) {
  return (
    <div className={`${PLAN_CARD} border-white/[0.06] bg-white/[0.02]`}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        무료 체험
      </p>
      <p className="mt-5 text-[1.75rem] font-bold tracking-tight text-white">
        0원
        <span className="ml-1 text-[15px] font-medium text-zinc-500">/ 1회</span>
      </p>
      <p className="mt-1.5 text-xs font-light text-zinc-500">가입하면 바로 제공돼요</p>
      <p className="mb-7 mt-6 flex-1 text-[13px] font-light leading-[1.8] text-zinc-500">
        지금 쓴 자소서가 어떻게 읽히는지 먼저 확인해 보세요. 리포트는 유료와 똑같이
        전체를 드립니다. 카드 등록도 필요 없어요.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.05] text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1]"
      >
        무료로 분석하기
      </button>
    </div>
  );
}

function ProductCard({
  product,
  onPurchase,
  disabled,
  ctaLabel,
}: {
  product: PremiumProduct;
  onPurchase: (productId: string) => void;
  disabled: boolean;
  ctaLabel: string;
}) {
  const discounted = hasDiscount(product);
  const featured = product.badge !== null;

  return (
    <div
      className={`${PLAN_CARD} ${
        featured ? "border-blue-500/[0.25] bg-white/[0.02]" : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${
            featured ? "text-blue-400" : "text-zinc-400"
          }`}
        >
          {product.name}
        </p>
        {product.badge && (
          <span className="rounded-full bg-blue-500/[0.15] px-2.5 py-1 text-[11px] font-medium text-blue-300">
            {product.badge}
          </span>
        )}
      </div>

      {/* 정가는 실제 판매 이력이 있을 때만 내려온다(list > sale). 없으면 렌더하지 않는다. */}
      {discounted && (
        <p className="mt-5 text-[13px] font-light text-zinc-600 line-through">
          {formatKrw(product.listPriceKrw)}
        </p>
      )}
      <p className={`${discounted ? "mt-0.5" : "mt-5"} text-[1.75rem] font-bold tracking-tight text-white`}>
        {formatKrw(product.salePriceKrw)}
        <span className="ml-1 text-[15px] font-medium text-zinc-500">
          / 분석 {product.credits}회
        </span>
      </p>
      <p className="mt-1.5 text-xs font-light text-zinc-500">
        {discounted && (
          <span className="mr-1.5 font-medium text-blue-300">
            {discountPercent(product)}% 할인
          </span>
        )}
        회당 {formatKrw(pricePerCredit(product))}
      </p>

      <p className="mb-7 mt-6 flex-1 text-[13px] font-light leading-[1.8] text-zinc-500">
        지원하는 회사가 바뀌면 리포트의 기준도 바뀝니다. 고쳐 쓴 자소서가 정말
        나아졌는지도 다시 확인해 보세요.
      </p>
      <button
        type="button"
        onClick={() => onPurchase(product.id)}
        disabled={disabled}
        className={`h-11 w-full rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
          featured
            ? "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20 hover:from-blue-400 hover:to-cyan-300"
            : "border border-white/[0.12] bg-white/[0.05] text-zinc-200 hover:bg-white/[0.1]"
        }`}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

function PromotionBanner({ promotionEndsAt }: { promotionEndsAt: string | null }) {
  const deadline = promotionEndsAt ? formatPromotionDeadline(promotionEndsAt) : "";
  if (!deadline) return null;

  return (
    <p className="mb-3 text-[12px] font-medium tracking-[0.02em] text-blue-300">
      하반기 채용 시즌 할인 · {deadline}까지 · 최대 50%
    </p>
  );
}
```

- [ ] **Step 4: 구매 핸들러가 상품을 받도록 변경**

`handlePurchase`의 시그니처만 바꾼다. 나머지 본문은 그대로다.

```tsx
  const handlePurchase = useCallback(
    async (productId: string) => {
      setIsPurchasing(true);
      setPurchaseError(null);

      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;

        const intent = await createPurchaseIntent(accessToken, productId);
        // 결제는 Groble 체크아웃 새 탭에서 진행된다. ref 파라미터가 구매 의도를 연결한다.
        // 클릭 이후 await 를 거치면 브라우저가 사용자 제스처로 보지 않아 팝업을 차단할 수 있어,
        // open 실패 시 사용자가 직접 여는 링크를 함께 제공한다.
        window.open(intent.checkoutUrl, "_blank", "noopener,noreferrer");
        setCheckoutUrl(intent.checkoutUrl);
        setPurchaseStarted(true);
      } catch {
        setPurchaseError("구매를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
      } finally {
        setIsPurchasing(false);
      }
    },
    [getAccessToken]
  );
```

- [ ] **Step 5: 게스트 뷰를 3카드로 교체**

게스트 분기(`!isAuthenticated`)의 `<div className="grid gap-6 md:grid-cols-2">` 블록 전체를 아래로 바꾼다. 게스트는 카탈로그를 아직 못 받았으므로 로그인으로 보낸다.

```tsx
            <div className="space-y-6">
              <PriceAnchor />
              <PromotionBanner promotionEndsAt={summary?.promotionEndsAt ?? null} />
              <div className="grid gap-5 md:grid-cols-3">
                <FreePlanCard onStart={() => navigate("/analyze")} />
                <div className="md:col-span-2 flex items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                  <div>
                    <p className="text-[14.5px] font-medium text-zinc-200">
                      이용권 가격은 로그인 후 확인할 수 있어요.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(getLoginRedirectPath("/entitlements"))}
                      className="mt-5 h-11 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-400 hover:to-cyan-300"
                    >
                      로그인하고 이용권 보기
                    </button>
                  </div>
                </div>
              </div>
            </div>
```

`PriceAnchor`를 모듈 스코프에 추가한다. 가격 숫자보다 **위**에 와야 한다.

```tsx
// 가격 인식은 무엇과 비교시키느냐가 결정한다. 이 문장이 없으면 사용자는
// 자동으로 ChatGPT(무료)와 비교하고, 그 프레임에서는 어떤 가격도 비싸 보인다.
function PriceAnchor() {
  return (
    <p className="text-[13.5px] font-light leading-relaxed text-zinc-400">
      전문가 첨삭은 회당 3~10만 원. <span className="font-medium text-zinc-200">한 번 값이면 여섯 번 진단합니다.</span>
    </p>
  );
}
```

- [ ] **Step 6: 로그인 뷰에 카드 그리드 추가**

로그인 분기에서 잔여 요약 행은 남기고, `summary.premiumEnabled && summary.groblePaymentUrl` 조건의 우측 구매 블록을 지운다. 잔여 요약 `</div>` 뒤에 아래를 넣는다.

```tsx
              {summary.products.length > 0 ? (
                <div className="space-y-4 pt-2">
                  <PriceAnchor />
                  <PromotionBanner promotionEndsAt={summary.promotionEndsAt} />
                  <div className="grid gap-5 md:grid-cols-3">
                    <FreePlanCard onStart={() => navigate("/analyze")} />
                    {summary.products.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onPurchase={handlePurchase}
                        disabled={isPurchasing}
                        ctaLabel={isPurchasing ? "여는 중..." : "이용권 구매하기"}
                      />
                    ))}
                  </div>
                  {purchaseError && (
                    <p className="text-xs text-red-200">{purchaseError}</p>
                  )}
                </div>
              ) : (
                <p className="pt-2 text-xs text-zinc-600">
                  현재 추가 이용권 판매를 준비하고 있어요.
                </p>
              )}
```

> 카드가 3개일 때 `md:grid-cols-3`가 정확히 맞는다. 상품이 늘면 컬럼 수를 함께 조정해야 하므로, `grid-cols-3`를 `products.length`에서 파생시키지 않고 그대로 둔다 — 10회권 추가 시 이 줄을 손대는 것이 의도다.

- [ ] **Step 7: 테스트와 타입 확인**

```bash
pnpm exec vitest run client/src/pages/Entitlements.test.ts client/src/lib && pnpm check
```

기대: 전부 PASS. Task 6에서 남았던 타입 에러가 여기서 해소된다.

- [ ] **Step 8: 브라우저에서 확인**

```bash
pnpm dev
```

`preview_start`로 `/entitlements`를 열고 다음을 눈으로 확인한다. 로컬 DB에 상품 행이 없으면 Task 8의 시드 SQL을 로컬에 먼저 적용한다.

- 카드가 무료 → 1회권 → 3회권 순서로 3개
- 3회권에 `가장 많이 선택` 배지, 취소선 `29,700원`, `14,900원`, `49% 할인 · 회당 4,970원`
- 상단에 `하반기 채용 시즌 할인 · 11월 30일까지 · 최대 50%`와 전문가 첨삭 앵커
- 콘솔·네트워크 에러 없음

- [ ] **Step 9: 커밋**

```bash
git add client/src/pages/Entitlements.tsx client/src/pages/Entitlements.test.ts
git commit -m "$(cat <<'EOF'
feat: show the single and bundle credit plans with season pricing

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 시드 데이터와 운영 절차

**Files:**
- Create: `docs/operations/premium-pricing.md`

**Interfaces:**
- Consumes: Task 1의 테이블, Task 5의 응답
- Produces: 없음 (문서)

- [ ] **Step 1: 운영 문서 작성**

`docs/operations/premium-pricing.md`:

````markdown
# 유료 이용권 가격 운영 절차

가격의 **정본은 Groble 상품 설정**이다. `premium_products` 테이블의 금액은 화면 표시용 사본이므로,
두 값이 어긋나면 표시광고법 위반이자 신뢰 문제다. **가격 변경은 항상 Groble 먼저 → DB 나중.**

## 1. 상품 등록 (최초 1회)

1. Groble에 상품 2개를 만든다. 판매가는 **정가**로 시작한다 — 1회권 9,900원, 3회권 29,700원.
2. 각 상품의 **콘텐츠 ID**와 **결제 페이지 URL**을 받아 아래 SQL의 자리표시자를 채운다.

```sql
INSERT INTO premium_products
  (id, groble_content_id, checkout_url, credits, list_price_krw, sale_price_krw, name, badge, sort_order, active)
VALUES
  ('credits_1', '<1회권 콘텐츠 ID>', '<1회권 결제 URL>', 1,  9900,  9900, '1회권', NULL,           1, TRUE),
  ('credits_3', '<3회권 콘텐츠 ID>', '<3회권 결제 URL>', 3, 29700, 29700, '3회권', '가장 많이 선택', 2, TRUE)
ON CONFLICT (id) DO UPDATE SET
  groble_content_id = EXCLUDED.groble_content_id,
  checkout_url      = EXCLUDED.checkout_url,
  credits           = EXCLUDED.credits,
  list_price_krw    = EXCLUDED.list_price_krw,
  sale_price_krw    = EXCLUDED.sale_price_krw,
  name              = EXCLUDED.name,
  badge             = EXCLUDED.badge,
  sort_order        = EXCLUDED.sort_order,
  active            = EXCLUDED.active,
  updated_at        = NOW();
```

3. 관리자 설정에서 프리미엄 판매 스위치를 켠다.
4. Vercel 환경변수에서 **`GROBLE_PREMIUM_CONTENT_ID`를 삭제**한다. 더 이상 읽지 않는다.

> `list_price_krw = sale_price_krw`로 시작하는 것이 의도다. 이 상태에서는 취소선·할인율·배너가
> 렌더되지 않는다. 정가로 실제 판매한 이력을 만드는 기간이다.

## 2. 시즌 할인 시작 (정가 판매 2~3주 후)

취소선 정가는 표시광고법상 **종전거래가격**이다. 1단계에서 정가로 실제 판매한 이력이 생긴 뒤에만 시작한다.

1. Groble에서 판매가를 1회권 5,900원, 3회권 14,900원으로 내린다.
2. DB를 맞춘다.

```sql
UPDATE premium_products SET sale_price_krw =  5900, updated_at = NOW() WHERE id = 'credits_1';
UPDATE premium_products SET sale_price_krw = 14900, updated_at = NOW() WHERE id = 'credits_3';
UPDATE entitlement_settings
SET promotion_ends_at = '2026-11-30T14:59:59Z', updated_at = NOW()
WHERE id = 'singleton';
```

3. `/entitlements`에서 취소선 `9,900원`/`29,700원`, `40% 할인`/`49% 할인`,
   `하반기 채용 시즌 할인 · 11월 30일까지`가 뜨는지 확인한다.

## 3. 시즌 할인 종료 (2026-11-30)

**날짜가 지나도 자동 전환되지 않는다.** 종료일을 지키지 않으면 판매가가 사실상 정가가 되어
그동안의 할인 표기가 소급해서 부당 표시가 된다.

1. Groble에서 판매가를 정가로 되돌린다.
2. DB를 맞춘다.

```sql
UPDATE premium_products SET sale_price_krw = list_price_krw, updated_at = NOW()
WHERE id IN ('credits_1', 'credits_3');

UPDATE entitlement_settings SET promotion_ends_at = NULL, updated_at = NOW()
WHERE id = 'singleton';
```

3. 취소선·할인율·배너가 전부 사라졌는지 확인한다. 배포는 필요 없다.

## 4. 상품 추가 (예: 10회권)

1. Groble에 상품을 만들고 콘텐츠 ID·결제 URL을 받는다.
2. `premium_products`에 행을 하나 넣는다 (`sort_order = 3`).
3. `client/src/pages/Entitlements.tsx`의 카드 그리드 `md:grid-cols-3`를 `md:grid-cols-4`로 바꾼다.
   **이것이 상품 추가에 필요한 유일한 코드 변경이다.**

## 5. 상품 은퇴

`active = FALSE`로 내린다. **행을 지우지 않는다** — 과거 구매 의도가 `product_id`로 이 상품을
가리키고 있고, 이미 결제된 웹훅이 늦게 도착해도 검증되어야 한다.

```sql
UPDATE premium_products SET active = FALSE, updated_at = NOW() WHERE id = 'credits_1';
```

## 표시 규칙 (코드가 강제하는 것)

- `list_price_krw > sale_price_krw`일 때만 취소선·할인율이 렌더된다
- 할인율은 **내림** — 49.83%는 `49%`로 표시된다. "50% 할인"이라고 쓰지 않는다
- 회당 단가는 10원 단위 **올림** — 4,966.7원은 `4,970원`으로 표시된다
- `promotion_ends_at`이 `NULL`이면 시즌 배너가 사라진다
````

- [ ] **Step 2: 프리뷰 배포에서 쿼리 전달 확인**

Vercel rewrite가 `productId` 쿼리를 목적지로 합쳐 주는지는 프리뷰에서만 확인할 수 있다.
프리뷰 배포 후, 로그인한 브라우저의 콘솔에서 실행한다.

```js
await fetch("/api/entitlements/purchase-intents?productId=credits_1", {
  method: "POST",
  headers: { Authorization: `Bearer ${(await window.supabase.auth.getSession()).data.session.access_token}` },
}).then(r => r.json())
```

기대: `{ purchaseIntentId, checkoutUrl }` — `checkoutUrl`이 **1회권** 결제 URL이어야 한다.
`UNKNOWN_PREMIUM_PRODUCT`가 나오면 rewrite가 쿼리를 떨어뜨린 것이므로, `readProductId`의
`req.url` 폴백이 동작하는지 확인하고, 그래도 안 되면 `vercel.json` rewrite를
`"/api/entitlements/purchase-intents"` → `"/api/entitlements?purchaseIntent=1&productId=$productId"`
형태로 바꾸는 대신 **경로 파라미터**(`/purchase-intents/:productId`)로 전환한다.

- [ ] **Step 3: 전체 테스트와 빌드**

```bash
pnpm exec vitest run && pnpm check
```

기대: 전부 PASS.

```bash
pnpm build
```

`DATABASE_URL`이 로컬에 없으면 prebuild 검증에서 멈춘다. **자격증명을 지어내서 통과시키지 않는다.**
못 돌렸으면 못 돌렸다고 보고에 명시한다.

- [ ] **Step 4: 커밋**

```bash
git add docs/operations/premium-pricing.md
git commit -m "$(cat <<'EOF'
docs: add the premium pricing operations runbook

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## 자체 점검 결과

**스펙 커버리지**

| 스펙 항목 | 태스크 |
| --- | --- |
| §5 데이터 모델 (`PremiumProduct`, 스냅샷, `promotionEndsAt`) | 1 |
| §5 FK 없음 / 크레딧 스냅샷 판단 | 1(스키마), 3(지급), 4(생성) |
| §6 `GET /api/entitlements` | 5 |
| §6 `POST /purchase-intents` | 4 |
| §6 웹훅 대조 대상 변경 · 에러 코드 유지 | 3 |
| §2 반올림 규칙 | 6 |
| §3 법적 요건 1(정가 선판매) · 2(종료일) · 3(할인율) | 8(운영), 6(계산), 7(표시) |
| §7 화면 | 7 |
| §9 위험 — 쿼리 전달 | 8 Step 2 |
| §9 위험 — DB/Groble 가격 동기화 | 8 §1·§2·§3 |

**타입 일관성 확인:** `PremiumProduct`의 필드명이 Prisma 모델(Task 1) → 서버 select(Task 2) →
API 응답(Task 5) → 클라이언트 타입(Task 6) → JSX(Task 7)에서 모두 `id, name, credits,
listPriceKrw, salePriceKrw, badge`로 일치한다. `checkoutUrl`은 Task 2의 `findPurchasableProduct`와
Task 4에만 등장하고 응답·클라이언트에는 없다.

**미해결로 남기는 것:** 실결제 1건이 들어온 뒤 웹훅 진단 로그의 `paymentKeys`에서 결제 금액
필드명을 확인해, `salePriceKrw`와 대조하는 서버 검증을 추가하는 것은 후속 과제다. 지금은
Groble 페이로드의 금액 필드 이름을 모른다.
