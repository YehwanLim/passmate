# 이용권 2단 가격제 (1회권 / 3회권) — 설계

**작성일:** 2026-09-03
**상태:** 구현 완료 (가격 수치는 `client/src/lib/pricing.ts` 기준으로 갱신)
**관련 문서:** `docs/superpowers/specs/2026-07-27-groble-signed-premium-credit-design.md`, `docs/superpowers/specs/2026-08-02-admin-premium-sales-control-design.md`

---

## 1. 배경

현재 유료 이용권은 **상품 1개**(3회 9,900원)를 전제로 만들어져 있고, 결제 라우트가 아직 열려 있지 않다.

코드가 단일 상품을 어떻게 가정하는지:

| 위치 | 현재 |
| --- | --- |
| `lib/groble-webhook-handler.js:110` | `GROBLE_PREMIUM_CONTENT_ID` 환경변수 **하나**와 대조. 다르면 `UNEXPECTED_GROBLE_PRODUCT` 422 |
| `lib/analysis-entitlements.js:146` | 지급 크레딧 = `EntitlementSetting.premiumCreditsPerPurchase` **단일 값** |
| `prisma/schema.prisma:206` | `PurchaseIntent`에 상품 구분 컬럼 **없음** |
| `api/entitlements.js` | `groblePaymentUrl` **하나**만 반환 |
| `client/src/pages/Entitlements.tsx:224` | 가격·회당 단가가 JSX에 **하드코딩** |

즉 상품이 1개 → 2개가 되는 것이 구조 변경의 전부다. 2개 → 3개는 데이터 한 줄 추가로 끝나도록 설계한다.

## 2. 가격 정책 (확정)

| 상품 | 정가 | 판매가 | 할인율(표시) | 회당(표시) |
| --- | --- | --- | --- | --- |
| 무료 체험 | — | 0원 / 1회 | — | — |
| 1회권 | 9,900원 | **5,900원** | 40% | 5,900원 |
| 3회권 ⭐ | 29,700원 | **14,900원** | 약 50% | 4,967원 |

**정가에 묶음 할인을 넣지 않는다** (29,700 = 9,900 × 3). 할인율을 40% vs 약 50%로 벌려 3회권으로 유도하는 것이 의도다.
할인가끼리 비교해도 3회권이 회당 약 16% 저렴하므로, 프로모션이 끝나도 묶음의 우위는 유지된다.

**프로모션:** "하반기 채용 시즌 할인 · 11월 30일까지" — 종료 시각 `2026-11-30T23:59:59+09:00` (= `2026-11-30T14:59:59Z`).

### 표시 반올림 규칙

표시 값이 실제 산술과 어긋나지 않도록 규칙을 고정한다. `client/src/lib/pricing.test.ts`가 이 산술 일치를 강제한다.

- **할인율은 원 단위 반올림.** 9,900 → 5,900 = 40.4% → `40%`. 29,700 → 14,900 = 49.83% → `50%`.
  단, 3회권은 반올림으로 값이 **올라가므로** 배지에 `약 50% 할인`이라고 '약'을 명시한다.
- **회당 단가는 원 단위 반올림.** 14,900 / 3 = 4,966.7원 → `4,967원`.

## 3. 법적 요건 (표시광고법)

취소선 정가 표기는 **종전거래가격**에 해당한다. 공정위 기준상 실제 판매 이력이 없는 가격을 정가로 표시하면 부당 표시·광고가 된다.

따라서 다음 세 가지가 구현이 아니라 **운영 조건**으로 강제된다.

1. **정가 선판매.** 결제 오픈 후 2~3주간 정가(9,900 / 29,700)로 실제 판매한 뒤 프로모션을 시작한다. 시드 데이터를 `list_price_krw = sale_price_krw`로 넣고 시작하는 것이 이 절차에 해당한다.
2. **종료일 준수.** `11월 30일까지`를 명시하고 그날 실제로 종료한다. 종료일 없는 상시 할인은 판매가가 곧 정가로 간주된다.
3. **할인율 과장 금지.** 49.83%를 단정적인 "50% 할인"으로 쓰지 않고 `약 50% 할인`으로 표기한다 (§2 반올림 규칙).

화면은 이 조건을 **데이터에서 파생**시킨다. `listPriceKrw > salePriceKrw`일 때만 취소선·할인율·배너를 렌더하므로, 11/30에 DB 한 줄을 바꾸면 배포 없이 정가 화면으로 돌아간다.

## 4. 범위

**포함**

- 상품 카탈로그 테이블 (`premium_products`)
- `PurchaseIntent`에 상품·크레딧 스냅샷
- 웹훅이 결제된 상품을 구매 의도의 상품과 대조하고, 스냅샷 크레딧을 지급
- `GET /api/entitlements`가 상품 목록과 프로모션 종료 시각을 반환
- `POST /api/entitlements/purchase-intents`가 `productId`를 받음
- 이용권 페이지 3카드 UI (무료 / 1회권 / 3회권)

**비포함 (YAGNI)**

- 상품 CRUD 관리자 UI — 상품 2개는 SQL로 관리한다. 현재 `groblePaymentUrl`도 같은 방식이다
- 쿠폰·기간별 자동 가격 전환 스케줄러 — 11/30 전환은 SQL 한 줄
- 10회권 — 카탈로그에 행 하나 추가하면 되도록만 열어둔다

## 5. 데이터 모델

```prisma
/// 유료 이용권 상품 카탈로그. 상품 추가는 이 테이블에 행을 넣는 것으로 끝난다.
model PremiumProduct {
  id              String  @id @db.VarChar(32)                  // "credits_1" | "credits_3"
  grobleContentId String  @unique @map("groble_content_id") @db.VarChar(255)
  checkoutUrl     String  @map("checkout_url") @db.Text
  credits         Int
  /// 정가. 표시광고법상 종전거래가격이므로 실제 판매 이력이 있어야 한다.
  listPriceKrw    Int     @map("list_price_krw")
  /// 실제 결제 금액. Groble 상품 설정과 반드시 일치해야 한다.
  salePriceKrw    Int     @map("sale_price_krw")
  name            String  @db.VarChar(64)
  badge           String? @db.VarChar(32)
  sortOrder       Int     @map("sort_order")
  active          Boolean @default(true)
  ...
}
```

`PurchaseIntent`에 추가:

```prisma
productId String @map("product_id") @db.VarChar(32)   // 스냅샷 (FK 아님)
credits   Int                                          // 결제 시점 지급 수량 스냅샷
```

`EntitlementSetting`에 추가:

```prisma
promotionEndsAt DateTime? @map("promotion_ends_at") @db.Timestamptz
```

### 설계 판단

**`product_id`에 외래키를 걸지 않는다.** 구매 의도는 과거 사실의 기록이다. 나중에 상품을 비활성화하거나 삭제할 때 이력이 깨지면 안 된다. 대신 스냅샷 문자열로 남긴다.

**`credits`를 구매 의도에 복사한다.** 의도 생성과 결제 완료 사이에 상품의 크레딧 수가 바뀌어도, 사용자가 본 조건대로 지급된다. 웹훅은 `intent.credits`를 지급하고 상품 대조는 검증에만 쓴다.

**`EntitlementSetting.premiumCreditsPerPurchase`는 읽지 않게 된다.** 컬럼은 남겨두되 스키마에 `@deprecated` 주석을 단다. 컬럼 삭제는 별도 결정으로 분리한다.

**가격은 카탈로그가 아니라 Groble이 실제로 청구한다.** 우리 DB의 `salePriceKrw`는 **표시용**이다. 두 값이 어긋나면 표시광고법 위반이자 신뢰 문제이므로, 가격 변경은 항상 **Groble 먼저 → DB 나중** 순서로 하고 운영 문서에 절차를 남긴다.

## 6. API 계약

### `GET /api/entitlements`

```jsonc
{
  "premiumEnabled": true,
  "freeRemaining": 0,
  "bonusRemaining": 0,
  "premiumRemaining": 2,
  "remaining": 2,
  "promotionEndsAt": "2026-11-30T14:59:59.000Z",  // 프로모션 없으면 null
  "products": [                                    // premiumEnabled=false 이면 []
    { "id": "credits_1", "name": "1회권", "credits": 1,
      "listPriceKrw": 9900, "salePriceKrw": 5900, "badge": null },
    { "id": "credits_3", "name": "3회권", "credits": 3,
      "listPriceKrw": 29700, "salePriceKrw": 14900, "badge": "가장 많이 선택" }
  ],
  "feedbackRewardClaimed": false
}
```

`groblePaymentUrl` 필드는 **제거**한다. 클라이언트와 서버가 한 배포에 함께 나가므로 버전 스큐가 없고, 판매 게이트는 `products.length > 0`으로 대체된다. `checkoutUrl`은 응답에 넣지 않는다 — 구매 의도 생성 시점에만 서버가 발급한다.

### `POST /api/entitlements/purchase-intents?productId=credits_3`

`api/entitlements.js`는 웹훅 HMAC 검증 때문에 `bodyParser: false`다. 따라서 상품 지정은 **쿼리 파라미터**로 받는다. 개인정보가 아니므로 URL에 실려도 무방하다.

| 상황 | 응답 |
| --- | --- |
| 성공 | `201 { purchaseIntentId, checkoutUrl }` — `checkoutUrl`에 `?ref=<intentId>` 부착 |
| 판매 스위치 꺼짐 | `403 { error: "PREMIUM_SALES_DISABLED" }` |
| 없거나 비활성 상품 | `400 { error: "UNKNOWN_PREMIUM_PRODUCT" }` |
| 상품에 체크아웃 URL 없음 | `503 { error: "PREMIUM_CHECKOUT_NOT_CONFIGURED" }` |

### `POST /api/webhooks/groble`

에러 코드 문자열은 **전부 그대로 유지**한다 (함정 5). 달라지는 것은 대조 대상뿐이다.

기존: `object.content.id` vs `GROBLE_PREMIUM_CONTENT_ID` 환경변수
변경: `object.content.id` vs **구매 의도가 가리키는 상품의 `grobleContentId`**

`GROBLE_PREMIUM_CONTENT_ID` 환경변수는 제거한다.

> Groble 관리 콘솔의 "테스트 발송"은 더미 값이라 여전히 422로 거부된다 — 정상 동작이다.

## 7. 화면

이용권 페이지(`/entitlements`)를 **무료 1회 → 1회권 → 3회권** 3카드로 재구성한다. 게스트와 로그인 사용자가 같은 카드를 보고, 로그인 사용자에게만 잔여 요약 행이 위에 붙는다.

```
하반기 채용 시즌 할인 · 11월 30일까지 · 최대 50%

전문가 첨삭은 회당 3~10만 원. 한 번 값이면 여섯 번 진단합니다.

┌─ 무료 체험 ────┐ ┌─ 1회권 ───────┐ ┌─ 3회권 ⭐ 가장 많이 선택 ─┐
│ 0원 / 1회      │ │ 9̶,̶9̶0̶0̶원̶        │ │ 2̶9̶,̶7̶0̶0̶원̶                │
│ 가입 시 제공    │ │ 5,900원  40%↓ │ │ 14,900원  약 50%↓       │
│                │ │               │ │ 회당 4,967원             │
└────────────────┘ └───────────────┘ └─────────────────────────┘
```

전문가 첨삭 앵커를 가격 **위**에 둔다. 이 문장이 없으면 사용자는 ChatGPT(무료)와 비교하고, 그 프레임에서는 5,900원도 비싸 보인다.

## 8. 검증 기준

- **웹훅:** 상품 A의 구매 의도에 상품 B 결제가 도착하면 `UNEXPECTED_GROBLE_PRODUCT` 422이고 크레딧이 지급되지 않는다. 정상 결제는 `intent.credits`만큼(설정값이 아니라) 지급한다. 재전송은 여전히 멱등이다.
- **구매 의도:** 판매 스위치가 꺼져 있으면 어떤 상품도 403. 없는 `productId`는 400. 성공 시 `PurchaseIntent`에 `productId`·`credits` 스냅샷이 남는다.
- **권한:** 두 경로 모두 `requireActiveApplicationUser`를 그대로 통과해야 한다. 삭제 유예 계정은 구매할 수 없다.
- **표시:** `listPriceKrw === salePriceKrw`면 취소선·할인율·프로모션 배너가 **렌더되지 않는다**. 할인율과 회당 단가는 모두 원 단위 반올림.
- **회귀 없음:** 무료 1회·보너스 크레딧 지급 경로, 분석 예약(선예약 → 확정/취소)은 변경되지 않는다.

## 9. 남은 위험

| 위험 | 대응 |
| --- | --- |
| DB 표시가와 Groble 실제 청구가 불일치 | 가격 변경은 Groble 먼저 → DB 나중. 운영 문서에 절차 고정. 실결제 1건 후 웹훅 진단 로그의 `paymentKeys`에서 금액 필드를 확인해 서버 검증을 추가하는 것을 후속 과제로 둔다 |
| Vercel rewrite가 `productId` 쿼리를 전달하지 못할 가능성 | 핸들러가 `req.query`와 `req.url` 양쪽에서 읽는다. 프리뷰 배포에서 실제 확인하는 단계를 플랜에 넣는다 |
| 응답에서 `groblePaymentUrl` 제거 | 오래된 탭의 구형 번들은 파싱 실패 → "다시 시도" 안내. 베타 규모에서 수용 |
| 11/30 전환을 잊음 | 종료일이 지나도 자동 전환되지 않는다. 배너에 날짜를 하드코딩하지 않고 `promotionEndsAt`에서 파생시켜, 값을 지우면 전체가 함께 사라지도록 한다 |
