# 기업 분석 리포트 ④ 진입점·샘플 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기업 분석 리포트를 아는 사람만 주소를 쳐서 들어오던 상태를 끝내고, 랜딩·GNB·자소서 리포트·자소서 폼·이용권 페이지에서 자연스럽게 발견·구매·생성으로 이어지게 한다. 비로그인 방문자에게 미판매 티어가 활성 버튼으로 보이는 문제도 함께 닫는다.

**Architecture:** 서버는 `api/entitlements.js`에 비로그인용 판매 가용성 조회(`?availability=1`, boolean 만 반환)를 얹는다 — 새 파일·새 라우트 없음. 클라이언트는 (1) 랜딩에 기업 분석 소개 섹션과 GNB 항목, (2) `/company-report?sample=1`로 공개 샘플(프로브 `--out`으로 굳힌 실제 리포트), (3) 자소서 리포트 하단 업셀 CTA, (4) 자소서 폼의 조용한 링크와 소진 모달의 기본 이동, (5) 랜딩 가격 섹션의 3티어 재구성을 더한다. 기존 `CompanyReportContent`·`TIERS`·`PRICING`·`COMPANY_REPORT_INCLUDED_FEATURES`를 재사용하고 새 스타일 어휘를 들이지 않는다.

**Tech Stack:** React 19 + Wouter + Tailwind 4 + framer-motion · Vercel Serverless ESM JS · Vitest(소스 문자열 테스트 + jsdom/RTL 렌더 테스트) · pnpm.

**Spec:** `docs/superpowers/specs/2026-09-06-company-analysis-report-design.md` — §2 "샘플 리포트", §3 "판매 접점" 1·3·4·5, §5-6 클라이언트, §7-3 이월 문단("비로그인 방문자 … 공개 API 가 없어").

## Global Constraints

- `pnpm`만 쓴다. 의존성·락파일을 바꾸지 않는다.
- **새 `api/` 파일 금지**(12/12 한도, `scripts/vercel-function-limit.test.js`). 새 라우트도 만들지 않는다 — 판매 가용성은 기존 `/api/entitlements` 경로의 쿼리 `availability=1`로만 구분한다(개발 미들웨어가 URL 쿼리를 `req.query`로 병합하므로 `vite.config.ts`·`vercel.json` 수정 불필요).
- **사용자의 미커밋 파일을 건드리지 않는다(스테이징도 금지):** `client/src/pages/Login.tsx`, `vercel.json`, `client/src/lib/googleIdentity.ts`, `client/src/lib/googleIdentity.test.ts`, `groble-cover-4x3.png`, `client/src/pages/MyEntitlements.tsx`, `client/src/pages/MyEntitlements.test.ts`. `git add -A`·`git stash`·`git checkout -- <file>`·`git reset`·`git clean` 금지. 파일을 명시해서 `git add`.
- 테스트에서 Gemini·Supabase·Groble을 실제로 호출하지 않는다. 프로브 스크립트만 수동 실제 호출용이다.
- 응답 필드명·에러 코드 문자열은 클라이언트 계약이다. 기존 필드를 바꾸지 말고 **가산만** 한다.
- 비로그인 응답에는 결제 URL·contentId·사용자 정보를 절대 넣지 않는다(boolean 만).
- 화면 문구는 한국어. 점수·퍼센트·"AI" 장식 문구 금지. 기업 분석 리포트 구성 설명은 `COMPANY_REPORT_INCLUDED_FEATURES`(pricing.ts) 외의 과장을 쓰지 않는다.
- 가격 숫자는 `client/src/lib/pricing.ts`에서만 온다. 컴포넌트·테스트에 "5,900원" 같은 리터럴을 새로 쓰지 않는다.
- 커밋 메시지는 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`으로 끝낸다. 푸시는 사용자 승인 후에만.
- `pnpm check`가 0 오류여야 한다. 기존 실패 테스트(`lib/auth.test.js` ×4, `ReportResult.identity.test.ts` ×2, `homeOnboardingCopy.test.ts` ×1)는 main에서 이미 깨져 있으며 이 플랜의 범위가 아니다.
- 기존 파일에 `prettier`를 통째로 돌리지 않는다(저장소가 포맷을 따르지 않아 전체 재포맷됨). 새로 만든 파일에만 `pnpm exec prettier --write <파일>`.

---

## 파일 구조

| 경로 | 역할 | 작업 |
| --- | --- | --- |
| `api/entitlements.js` | 이용권 요약·구매 의도·웹훅. **가산:** `?availability=1` 비로그인 판매 가용성 | Task 1 |
| `tests/api/entitlements.test.js` | 위 핸들러 테스트 | Task 1 |
| `client/src/lib/entitlements.ts` | 클라이언트 파서. **가산:** `SalesAvailability`·`fetchSalesAvailability` | Task 1 |
| `client/src/pages/Entitlements.tsx` | 이용권 페이지. 게스트 버튼이 가용성을 반영, 해시 `#standard`·`#premium` 스크롤 | Task 1·7 |
| `client/src/lib/pricing.ts` | 가격 단일 정의처. `TRIPLE_PER_USE_PRICE` → `STANDARD_PER_USE_PRICE` | Task 2 |
| `client/src/components/PricingSection.tsx` | 랜딩 가격 섹션. 2카드 → `TIERS` 기반 3티어 카드 + 기업 리포트 구성 열 | Task 2 |
| `scripts/manual/company-analysis-probe.mjs` | 수동 프로브. `--out <파일>` 옵션으로 결과 JSON 저장 | Task 3 |
| `client/src/constants/companyReportSample.ts` | 공개 샘플 리포트 상수(프로브 결과를 굳힌 것) | Task 4 |
| `client/src/pages/CompanyReport.tsx` | `?sample=1` 비로그인 렌더, 샘플 리본·CTA 분기 | Task 4 |
| `client/src/components/CompanyReportIntroSection.tsx` | 랜딩 기업 분석 소개 섹션(신규) | Task 5 |
| `client/src/pages/Home.tsx` | 소개 섹션 배치, `HOME_NAV_ITEMS`에 "기업 분석"(섹션 스크롤) | Task 5 |
| `client/src/pages/ReportResult.tsx` | 자소서 리포트 하단 업셀 CTA(회사·직무·분석 id 프리필) | Task 6 |
| `client/src/pages/CompanyAnalyze.tsx` | `resumeAnalysisId` 쿼리 프리필(목록에 없으면 해제) | Task 6 |
| `client/src/pages/Analyze.tsx` | 회사 입력 아래 조용한 기업 분석 링크, 소진 모달 → `/entitlements#standard` | Task 7 |
| `docs/superpowers/specs/2026-09-06-company-analysis-report-design.md` | §7-3 이월 문단 갱신, 4단계 플랜 포인터 | Task 8 |

---

### Task 1: 비로그인 판매 가용성 API와 이용권 페이지 게스트 버튼

**Files:**
- Modify: `api/entitlements.js` (함수 `checkoutUrlsFor` 아래에 헬퍼 추가, `handler` 디스패치 맨 앞 분기)
- Modify: `tests/api/entitlements.test.js`
- Modify: `client/src/lib/entitlements.ts`
- Modify: `client/src/lib/entitlements.test.ts`
- Modify: `client/src/pages/Entitlements.tsx` (`renderPaidPlanButton`의 `!isAuthenticated` 분기, 새 `useEffect`)
- Modify: `client/src/pages/Entitlements.purchase.test.tsx`

**Interfaces:**
- Consumes: `checkoutUrlsFor(productSettings, switches)`, `readPurchaseProductSettings(prisma)`, `SETTINGS_ID`·`SWITCH_SELECT`(이미 `api/entitlements.js`에 있음), `PURCHASE_PRODUCT_KEYS`(client pricing.ts).
- Produces: `GET /api/entitlements?availability=1` → `200 { companyAnalysisEnabled: boolean, purchasable: { single, company, standard, premium, triple }: boolean }` (인증 없음). 클라이언트 `fetchSalesAvailability(): Promise<SalesAvailability>`.

- [ ] **Step 1: 서버 테스트 추가(실패 확인)**

`tests/api/entitlements.test.js`의 기존 `GET /api/entitlements` 테스트가 쓰는 요청·설정 목(mock) 헬퍼를 그대로 재사용해 아래 세 케이스를 추가한다. 기존 테스트에서 `mocks.prisma.entitlementSetting.findUnique`와 `mocks.prisma.purchaseProductSetting.findMany`를 어떻게 채우는지 먼저 읽고 같은 형태로 채운다.

```js
describe("GET /api/entitlements?availability=1 (public sales availability)", () => {
  it("answers without authentication and never calls the user guard", async () => {
    // 기존 GET 테스트와 같은 방식으로 스위치(premiumEnabled·companyAnalysisEnabled 모두 true)와
    // 상품 설정 5행(single·company·standard·premium 은 contentId+URL+active, triple 은 inactive)을 준비한다.
    const res = createResponse();
    await entitlementsHandler(
      { method: "GET", url: "/api/entitlements?availability=1", query: { availability: "1" }, headers: {} },
      res,
    );
    expect(mocks.requireActiveApplicationUser).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      companyAnalysisEnabled: true,
      purchasable: { single: true, company: true, standard: true, premium: true, triple: false },
    });
  });

  it("leaks no checkout url, content id, or user data", async () => {
    // 같은 준비. 응답 직렬화 문자열에 결제 도메인·contentId 가 없어야 한다.
    const res = createResponse();
    await entitlementsHandler(
      { method: "GET", url: "/api/entitlements?availability=1", query: { availability: "1" }, headers: {} },
      res,
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("groble.im");
    expect(serialized).not.toContain("4SGBV5");
    expect(Object.keys(res.body)).toEqual(["companyAnalysisEnabled", "purchasable"]);
  });

  it("closes company products when the company switch is off", async () => {
    // premiumEnabled true, companyAnalysisEnabled false → company·standard·premium 이 false, single 만 true.
    // ...
    expect(res.body.companyAnalysisEnabled).toBe(false);
    expect(res.body.purchasable).toEqual({ single: true, company: false, standard: false, premium: false, triple: false });
  });

  it("still requires authentication for a POST with the availability flag", async () => {
    // requireActiveApplicationUser 가 AuthorizationError("UNAUTHENTICATED", 401) 를 던지도록 하고
    // POST /api/entitlements?availability=1 → 401. availability 는 GET 에만 열린다.
    // ...
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run tests/api/entitlements.test.js`
Expected: 새 4개 FAIL(현재는 인증 없이 401 또는 사용자 가드 호출).

- [ ] **Step 3: 서버 구현**

`api/entitlements.js`의 `checkoutUrlsFor` 바로 아래에 추가:

```js
function isSalesAvailabilityRequest(req) {
  return req.query?.availability === "1";
}

/**
 * 비로그인 방문자용 판매 가용성. 로그인 전 화면(이용권 페이지·랜딩)이 미판매 티어를
 * 활성 버튼으로 보여 주지 않게 하려는 것이므로 상품별 boolean 만 준다.
 * 결제 URL·contentId·사용자 정보는 절대 포함하지 않는다.
 */
async function getSalesAvailability(res) {
  const [switches, productSettings] = await Promise.all([
    prisma.entitlementSetting.findUnique({ where: { id: SETTINGS_ID }, select: SWITCH_SELECT }),
    readPurchaseProductSettings(prisma),
  ]);
  const checkoutUrls = checkoutUrlsFor(productSettings, switches);
  return res.status(200).json({
    companyAnalysisEnabled: switches?.companyAnalysisEnabled === true,
    purchasable: Object.fromEntries(Object.entries(checkoutUrls).map(([key, url]) => [key, Boolean(url)])),
  });
}
```

`handler`에서 웹훅 분기 **다음, `getAuthenticatedUser` 앞**에:

```js
    // 판매 가용성은 로그인 전 화면이 쓰므로 인증 없이 답한다(boolean 만).
    if (req.method === "GET" && isEntitlementsPath(req) && isSalesAvailabilityRequest(req)) {
      return getSalesAvailability(res);
    }
```

- [ ] **Step 4: 서버 테스트 통과 확인**

Run: `pnpm exec vitest run tests/api/entitlements.test.js`
Expected: 전부 PASS.

- [ ] **Step 5: 클라이언트 파서 테스트(실패 확인)**

`client/src/lib/entitlements.test.ts`에 추가(기존 테스트의 `fetch` 스텁 방식을 따른다):

```ts
describe("fetchSalesAvailability", () => {
  it("reads booleans tolerantly and treats unknown keys as closed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      companyAnalysisEnabled: true,
      purchasable: { single: true, standard: "yes", premium: 1 },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const availability = await fetchSalesAvailability();
    expect(fetch).toHaveBeenCalledWith("/api/entitlements?availability=1");
    expect(availability).toEqual({
      companyAnalysisEnabled: true,
      purchasable: { single: true, company: false, standard: false, premium: false, triple: false },
    });
  });

  it("throws on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    await expect(fetchSalesAvailability()).rejects.toThrow();
  });
});
```

- [ ] **Step 6: 클라이언트 파서 구현**

`client/src/lib/entitlements.ts` 끝에 추가(`PURCHASE_PRODUCT_KEYS`는 이미 import 되어 있는지 확인, 없으면 `@/lib/pricing`에서 import):

```ts
/** 비로그인 화면용 판매 가용성. 서버 `GET /api/entitlements?availability=1`. */
export type SalesAvailability = {
  companyAnalysisEnabled: boolean;
  purchasable: Record<PurchaseProductKey, boolean>;
};

export async function fetchSalesAvailability(): Promise<SalesAvailability> {
  const response = await fetch("/api/entitlements?availability=1");
  if (!response.ok) {
    throw new Error(`Sales availability request failed (${response.status})`);
  }
  const payload: unknown = await response.json();
  const source = isRecord(payload) && isRecord(payload.purchasable) ? payload.purchasable : null;
  const purchasable = {} as Record<PurchaseProductKey, boolean>;
  for (const key of PURCHASE_PRODUCT_KEYS) {
    purchasable[key] = source?.[key] === true;
  }
  return {
    companyAnalysisEnabled: isRecord(payload) && payload.companyAnalysisEnabled === true,
    purchasable,
  };
}
```

- [ ] **Step 7: 파서 테스트 통과 확인**

Run: `pnpm exec vitest run client/src/lib/entitlements.test.ts`
Expected: PASS.

- [ ] **Step 8: 이용권 페이지 렌더 테스트(실패 확인)**

`client/src/pages/Entitlements.purchase.test.tsx`의 기존 목(useAuth·fetch·wouter) 방식으로 추가:

```tsx
it("shows the preparing notice instead of a login button for tiers a guest cannot buy", async () => {
  mocks.useAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === "/api/entitlements?availability=1") {
      return jsonResponse({ companyAnalysisEnabled: false, purchasable: { single: true, company: false, standard: false, premium: false, triple: false } });
    }
    throw new Error(`unexpected fetch ${String(input)}`);
  }));
  render(<Entitlements />);
  await waitFor(() => expect(screen.getAllByText("현재 추가 이용권 판매를 준비하고 있어요.").length).toBeGreaterThanOrEqual(2));
  // 베이직(자소서 선택 기본값)은 살 수 있으므로 로그인으로 이어지는 구매 버튼이 남는다.
  expect(screen.getByRole("button", { name: "자소서 진단 1회 구매하기" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "프리미엄 구매하기" })).toBeNull();
});

it("keeps login buttons when the availability request fails", async () => {
  mocks.useAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
  render(<Entitlements />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(screen.getByRole("button", { name: "프리미엄 구매하기" })).toBeInTheDocument();
});
```

(`jsonResponse`·`waitFor`·`screen` 헬퍼가 그 파일에 없으면 `CompanyReport.render.test.tsx`와 같은 형태로 정의한다.)

- [ ] **Step 9: 이용권 페이지 구현**

`client/src/pages/Entitlements.tsx`:

1. import에 `fetchSalesAvailability, type SalesAvailability` 추가.
2. 상태 추가: `const [availability, setAvailability] = useState<SalesAvailability | null>(null);`
3. 기존 `loadEntitlements` 효과 아래에:

```tsx
  // 비로그인 방문자는 이용권 요약을 못 받으므로, 판매 가용성만 따로 물어 미판매 티어를 활성 버튼으로 보여 주지 않는다.
  // 실패하면 모르는 상태로 두고 로그인 버튼을 그대로 보여 준다(로그인 후 서버가 다시 판단).
  useEffect(() => {
    if (authLoading || isAuthenticated) return;
    let cancelled = false;
    fetchSalesAvailability()
      .then((next) => { if (!cancelled) setAvailability(next); })
      .catch(() => { /* 모르면 로그인 버튼 유지 */ });
    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated]);
```

4. `renderPaidPlanButton`의 `if (!isAuthenticated)` 분기 **앞**에:

```tsx
    if (!isAuthenticated && availability && !availability.purchasable[product]) {
      return (
        <p className="flex h-11 items-center justify-center text-xs text-zinc-500">
          현재 추가 이용권 판매를 준비하고 있어요.
        </p>
      );
    }
```

- [ ] **Step 10: 테스트·타입 확인**

Run: `pnpm exec vitest run client/src/pages/Entitlements.purchase.test.tsx client/src/pages/Entitlements.test.ts client/src/lib/entitlements.test.ts tests/api/entitlements.test.js && pnpm check`
Expected: 전부 PASS, 타입 오류 0.

- [ ] **Step 11: 커밋**

```bash
git add api/entitlements.js tests/api/entitlements.test.js client/src/lib/entitlements.ts client/src/lib/entitlements.test.ts client/src/pages/Entitlements.tsx client/src/pages/Entitlements.purchase.test.tsx
git commit -m "feat(entitlements): expose public sales availability so guests do not see unsellable tiers as purchasable

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: 가격 상수 이름 정리와 랜딩 가격 섹션 3티어 재구성

**Files:**
- Modify: `client/src/lib/pricing.ts` (`TRIPLE_PER_USE_PRICE` → `STANDARD_PER_USE_PRICE`)
- Modify: `client/src/lib/pricing.test.ts`
- Modify: `client/src/components/PricingSection.tsx`
- Create: `client/src/components/PricingSection.test.tsx`

**Interfaces:**
- Consumes: `TIERS`, `PRICING`, `formatKrw`, `savingsFor`, `REPORT_INCLUDED_FEATURES`, `COMPANY_REPORT_INCLUDED_FEATURES`, `SEASONAL_DISCOUNT_LABEL`.
- Produces: `STANDARD_PER_USE_PRICE`(값 4,967 유지). 다른 소비자는 `PricingSection.tsx` 뿐이다(`grep -rn TRIPLE_PER_USE_PRICE client/src`로 확인).

- [ ] **Step 1: pricing 테스트 갱신(실패 확인)**

`client/src/lib/pricing.test.ts`: import와 두 단언의 `TRIPLE_PER_USE_PRICE`를 `STANDARD_PER_USE_PRICE`로 바꾼다. 테스트 이름 "keeps the per-use price in sync with the triple plan sale price" → "keeps the per-use price in sync with the standard plan sale price"로, 산술은 `Math.round(PRICING.standard.salePrice / (PRICING.standard.uses + PRICING.standard.companyUses))`와 같아야 한다(3회 기준 4,967).

Run: `pnpm exec vitest run client/src/lib/pricing.test.ts`
Expected: FAIL(export 없음).

- [ ] **Step 2: 상수 이름 변경**

`client/src/lib/pricing.ts`:

```ts
/** 스탠다드 기준 회당 가격(원, 14,900 / 3회). 반올림 값이며 pricing.test.ts가 산술 일치를 검증한다. */
export const STANDARD_PER_USE_PRICE = 4_967;
```

`PricingSection.tsx`의 import·사용처도 같이 바꾼다(Step 4에서 파일을 다시 쓰므로 그때 반영).

- [ ] **Step 3: PricingSection 테스트 작성(실패 확인)**

`client/src/components/PricingSection.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";

import { PRICING, TIERS, formatKrw } from "@/lib/pricing";

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/", mocks.navigate] }));

import PricingSection from "./PricingSection";

const source = readFileSync(new URL("./PricingSection.tsx", import.meta.url), "utf8");

describe("PricingSection", () => {
  beforeEach(() => {
    // framer-motion whileInView 가 IntersectionObserver 를 요구한다.
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.navigate.mockReset(); });

  it("renders one card per tier from the shared TIERS list", () => {
    render(<PricingSection />);
    for (const tier of TIERS) {
      expect(screen.getByRole("heading", { name: tier.label })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: `${tier.label} 구매하기` })).toBeInTheDocument();
    }
  });

  it("shows the basic tier as a choice between the two single products at the same price", () => {
    render(<PricingSection />);
    expect(screen.getByText("자소서 진단 1회 또는 기업 분석 1회")).toBeInTheDocument();
    expect(screen.getAllByText(formatKrw(PRICING.single.salePrice)).length).toBeGreaterThanOrEqual(1);
  });

  it("sends every card to the entitlements page", () => {
    render(<PricingSection />);
    screen.getByRole("button", { name: "프리미엄 구매하기" }).click();
    expect(mocks.navigate).toHaveBeenCalledWith("/entitlements");
  });

  it("lists the company report contents next to the essay report contents", () => {
    render(<PricingSection />);
    expect(screen.getByText("기업 분석 리포트")).toBeInTheDocument();
    expect(screen.getByText("출처 링크가 붙은 부록")).toBeInTheDocument();
  });

  it("takes every price from lib/pricing and iterates TIERS", () => {
    expect(source).toContain("TIERS.map(");
    expect(source).toContain("STANDARD_PER_USE_PRICE");
    expect(source).not.toContain("TRIPLE_PER_USE_PRICE");
    expect(source).not.toMatch(/\d,\d{3}원/);
  });
});
```

Run: `pnpm exec vitest run client/src/components/PricingSection.test.tsx`
Expected: FAIL(티어 카드 없음, 옛 상수명).

- [ ] **Step 4: PricingSection 재구성**

`client/src/components/PricingSection.tsx`에서 `PaidPlanCard`와 두 번의 `<PaidPlanCard …/>` 호출, `COMPARISON_COLUMNS`의 `TRIPLE_PER_USE_PRICE`, "리포트 공통 구성" 블록을 아래로 바꾼다. 헤딩·무료 체험 안내·시세 비교·하단 CTA는 그대로 둔다.

```tsx
import {
  COMPANY_REPORT_INCLUDED_FEATURES,
  PRICING,
  REPORT_INCLUDED_FEATURES,
  SEASONAL_DISCOUNT_LABEL,
  STANDARD_PER_USE_PRICE,
  TIERS,
  formatKrw,
  savingsFor,
} from "@/lib/pricing";

type TierKey = (typeof TIERS)[number]["key"];

// 티어별 설명 문구. 숫자는 전부 PRICING 에서 계산한다.
const TIER_COPY: Record<TierKey, { perUseNote: string; lead: string; body: string }> = {
  basic: {
    perUseNote: "자소서 진단 1회 또는 기업 분석 1회",
    lead: "당장 앞둔 마감 하나에 집중하고 싶다면.",
    body: "지금 쓴 자소서가 채용 담당자에게 어떻게 읽히는지, 또는 지원 기업이 무엇으로 돈을 버는지. 둘 중 하나를 골라 확인해 보세요.",
  },
  standard: {
    perUseNote: "자소서 진단 2회 + 기업 분석 1회",
    lead: "한 회사를 제대로 준비하고, 고쳐 쓴 자소서까지 다시 확인.",
    body: "기업 분석 1회로 지원 기업의 사업과 이슈를 파악하고, 자소서 진단 2회로 초안부터 고쳐 쓴 뒤까지 다시 확인해 보세요.",
  },
  premium: {
    perUseNote: "자소서 진단 3회 + 기업 분석 3회",
    lead: "여러 회사를 같은 시즌에 준비한다면.",
    body: `지원하는 회사마다 기업 분석과 자소서 진단을 한 번씩. 따로 살 때보다 ${formatKrw(savingsFor(PRICING.premium))} 저렴합니다.`,
  },
};

function TierCard({ tier }: { tier: (typeof TIERS)[number] }) {
  const [, navigate] = useLocation();
  // 베이직은 두 상품(자소서 1회·기업 1회)이 같은 가격이라 대표로 자소서 상품을 보여 준다.
  const plan = PRICING[tier.products[0]];
  const copy = TIER_COPY[tier.key];
  const highlighted = tier.key === "standard";
  const totalUses = plan.uses + plan.companyUses;
  // 번들은 "따로 사면", 단일 상품은 "정가"로 취소선 기준을 표기한다. 판매가와 같으면 취소선 없음.
  const listPricePrefix = plan.companyUses > 0 && totalUses > 1 ? "따로 사면" : "정가";
  const showListPrice = plan.listPrice > plan.salePrice;

  return (
    <motion.div
      variants={revealVariants}
      className={`flex h-full flex-col rounded-2xl border bg-white/[0.02] p-7 backdrop-blur-sm transition-all duration-300 ${
        highlighted
          ? "border-blue-500/[0.25] hover:border-blue-400/[0.35]"
          : "border-white/[0.06] hover:border-white/[0.1]"
      }`}
    >
      <h3 className={`text-lg font-bold tracking-tight ${highlighted ? "text-blue-400" : "text-zinc-200"}`}>
        {tier.label}
      </h3>
      <p className="mt-4 text-[2.4rem] md:text-[2.6rem] font-bold leading-none tracking-tight text-white">
        {formatKrw(plan.salePrice)}
        <span className="ml-1.5 text-base font-medium text-zinc-500">/ {totalUses}회</span>
      </p>
      {showListPrice ? (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-3 text-base">
          <span className="font-light text-zinc-400 line-through decoration-zinc-300/60 decoration-[1.5px]">
            {listPricePrefix} {formatKrw(plan.listPrice)}
          </span>
          <span className="text-lg font-extrabold tracking-tight text-sky-300">{plan.discountLabel}</span>
        </p>
      ) : null}
      <p className={`mt-1 text-xs font-light ${highlighted ? "text-zinc-300" : "text-zinc-500"}`}>
        {copy.perUseNote}
      </p>
      <p className="mt-6 text-[14.5px] font-medium leading-relaxed text-zinc-200">{copy.lead}</p>
      <p className="mb-7 mt-2 flex-1 text-[13px] font-light leading-[1.8] text-zinc-500">{copy.body}</p>
      {/* 실제 결제·로그인·베이직 선택은 이용권 페이지에서 이어진다 */}
      <button
        type="button"
        onClick={() => navigate("/entitlements")}
        className={
          highlighted
            ? "h-11 w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-400 hover:to-cyan-300"
            : "h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.05] text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1]"
        }
      >
        {tier.label} 구매하기
      </button>
    </motion.div>
  );
}
```

카드 그리드(기존 `max-w-3xl md:grid-cols-2` 블록)를:

```tsx
        <motion.div
          className="grid gap-5 md:grid-cols-3 max-w-5xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {TIERS.map((tier) => (
            <TierCard key={tier.key} tier={tier} />
          ))}
        </motion.div>
```

"리포트 공통 구성" 블록을 두 열로(이용권 페이지와 같은 문구):

```tsx
        <motion.div
          className="mt-10 max-w-5xl mx-auto grid gap-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-7 py-6 md:grid-cols-2 md:gap-10"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-sky-300">자소서 진단 리포트</p>
            <p className="mt-1.5 text-[14px] font-semibold text-zinc-200">어떤 이용권을 선택하든, 이 모든 게 담깁니다</p>
            <ul className="mt-4 space-y-2.5">
              {REPORT_INCLUDED_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-[13.5px] font-light text-zinc-400">
                  <Check className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-sky-300">기업 분석 리포트</p>
            <p className="mt-1.5 text-[14px] font-semibold text-zinc-200">스탠다드·프리미엄에 포함, 베이직에서 따로 고를 수 있어요</p>
            <ul className="mt-4 space-y-2.5">
              {COMPANY_REPORT_INCLUDED_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-[13.5px] font-light text-zinc-400">
                  <Check className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
```

`COMPARISON_COLUMNS`의 `value: formatKrw(TRIPLE_PER_USE_PRICE)` → `formatKrw(STANDARD_PER_USE_PRICE)`.

- [ ] **Step 5: 테스트·타입 확인**

Run: `pnpm exec vitest run client/src/components/PricingSection.test.tsx client/src/lib/pricing.test.ts client/src/pages/Home.test.ts && pnpm check`
Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add client/src/lib/pricing.ts client/src/lib/pricing.test.ts client/src/components/PricingSection.tsx client/src/components/PricingSection.test.tsx
git commit -m "feat(landing): rebuild the pricing section around the three tiers and name the per-use price after the standard tier

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: 프로브 `--out` 옵션

**Files:**
- Modify: `scripts/manual/company-analysis-probe.mjs`

**Interfaces:**
- Produces: `node scripts/manual/company-analysis-probe.mjs "<회사>" "<직무>" --out <파일>` → 성공 시 `<파일>`에 `{ company, jobKeyword, generatedAt, result }`(result = `analyzeCompany` 반환값 전체) JSON 저장. 콘솔 요약에 `outPath` 추가. Task 4 가 이 파일을 읽는다.

- [ ] **Step 1: 인자 파싱과 저장 추가**

파일 상단 주석에 한 줄 추가: `// --out <파일> 을 주면 리포트 전체(AI 응답 본문 포함)를 그 파일에 저장한다 — 샘플 픽스처 제작용. 이 파일은 로그가 아니므로 저장소·로그에 그대로 넣지 말고, 검수 후 constants/companyReportSample.ts 로 옮긴다.`

`const [company = …] = process.argv.slice(2);` 를:

```js
const args = process.argv.slice(2);
const outFlagIndex = args.indexOf("--out");
const outPath = outFlagIndex >= 0 ? args[outFlagIndex + 1] ?? null : null;
if (outFlagIndex >= 0 && !outPath) {
  console.error("--out 뒤에 저장할 파일 경로가 필요합니다.");
  process.exit(2);
}
const positional = outFlagIndex >= 0 ? [...args.slice(0, outFlagIndex), ...args.slice(outFlagIndex + 2)] : args;
const [company = "현대자동차", jobKeyword = "전략기획"] = positional;
```

성공 경로에서 `const { sourceIdsBySection, sourceIdRange } = collectSourceIds(result);` 앞에:

```js
  if (outPath) {
    writeFileSync(
      outPath,
      JSON.stringify({ company, jobKeyword, generatedAt: new Date().toISOString(), result }, null, 2),
      "utf8",
    );
  }
```

콘솔 JSON 객체에 `outPath,` 필드를 `searchEntryPointHtmlPath` 다음에 추가.

- [ ] **Step 2: 실제 호출 없이 파싱만 검증**

Run: `node -e "import('./scripts/manual/company-analysis-probe.mjs')" 2>&1 | head -3` 는 실제 호출을 하므로 **실행하지 않는다**. 대신 `node --check scripts/manual/company-analysis-probe.mjs` 로 문법만 확인하고, `--out` 만 주고 경로가 없을 때의 종료 코드 2 는 코드 리뷰로 확인한다.

Expected: `node --check` 출력 없음(성공).

- [ ] **Step 3: 커밋**

```bash
git add scripts/manual/company-analysis-probe.mjs
git commit -m "chore(probe): add --out to save the full company report for building the public sample

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

**컨트롤러 메모:** 이 Task 커밋 뒤 컨트롤러가 프로브를 1회 실제 실행해(`node --env-file=.env scripts/manual/company-analysis-probe.mjs "삼성전자" "전략기획" --out <scratch>/company-report-sample.json`) Task 4 의 입력 파일을 만든다. 실행이 불가능하면(키 접근 불가) 사용자에게 같은 명령을 부탁하고 Task 4 를 보류한 채 Task 5~7 을 진행한다(Task 5 의 샘플 링크는 Task 4 의 상수를 import 하므로 Task 4 이후에 디스패치).

---

### Task 4: 공개 샘플 리포트(`/company-report?sample=1`)

**Files:**
- Create: `client/src/constants/companyReportSample.ts`
- Create: `client/src/constants/companyReportSample.test.ts`
- Modify: `client/src/pages/CompanyReport.tsx`
- Modify: `client/src/pages/CompanyReport.render.test.tsx`

**Interfaces:**
- Consumes: 프로브 결과 JSON(디스패치 브리프에 경로 명시), `CompanyReportContent`, `isRenderableCompanyReport`.
- Produces: `COMPANY_REPORT_SAMPLE: { company: string; jobRole: string; report: CompanyReportData }`. `/company-report?sample=1`은 로그인 없이 렌더. Task 5 가 상수의 `company`를 링크 문구에 쓴다.

- [ ] **Step 1: 상수 파일 생성**

프로브 JSON에서 `result`를 읽어 `analysisMeta`(토큰 사용량·모델명 — 화면에 불필요)를 제거하고, 아래 형태로 TS 파일을 생성한다. 손으로 옮기지 말고 노드 한 줄로 만든 뒤 헤더 주석만 붙인다:

```bash
node -e '
const fs = require("node:fs");
const { company, jobKeyword, result } = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const { analysisMeta, ...report } = result;
const header = `import type { CompanyReportData } from "@/types/companyReport";

/**
 * 공개 샘플 리포트(/company-report?sample=1, 랜딩 소개 섹션).
 * scripts/manual/company-analysis-probe.mjs --out 으로 생성한 실제 리포트를 사용자가 검수해 굳힌 것이다.
 * 갱신: node --env-file=.env scripts/manual/company-analysis-probe.mjs "<회사>" "<직무>" --out sample.json
 *       → result 에서 analysisMeta 를 뺀 나머지를 report 에 붙여 넣는다(searchEntryPointHtml 포함 — 검색 그라운딩 약관).
 * 리포트 문장은 손으로 고치지 않는다(실제 생성 결과를 보여 주는 것이 샘플의 목적).
 */
export const COMPANY_REPORT_SAMPLE: { company: string; jobRole: string; report: CompanyReportData } = `;
fs.writeFileSync(process.argv[2], header + JSON.stringify({ company, jobRole: jobKeyword, report }, null, 2) + ";\n");
' "<프로브 JSON 경로>" client/src/constants/companyReportSample.ts
pnpm exec prettier --write client/src/constants/companyReportSample.ts
```

- [ ] **Step 2: 상수 테스트(실패 확인 → 통과)**

`client/src/constants/companyReportSample.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { isRenderableCompanyReport } from "@/types/companyReport";
import { COMPANY_REPORT_SAMPLE } from "./companyReportSample";

describe("COMPANY_REPORT_SAMPLE", () => {
  it("is a renderable company report for a named company and role", () => {
    expect(COMPANY_REPORT_SAMPLE.company.trim().length).toBeGreaterThan(0);
    expect(COMPANY_REPORT_SAMPLE.jobRole.trim().length).toBeGreaterThan(0);
    expect(isRenderableCompanyReport(COMPANY_REPORT_SAMPLE.report)).toBe(true);
  });

  it("carries real sources with http(s) links and a report date", () => {
    const { report } = COMPANY_REPORT_SAMPLE;
    expect(report.sources.length).toBeGreaterThanOrEqual(5);
    for (const source of report.sources) {
      expect(source.url).toMatch(/^https?:\/\//);
    }
    expect(report.reportMeta?.kind).toBe("COMPANY");
    expect(report.reportMeta?.asOf ?? report.brief.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps the search entry point markup script-free", () => {
    const html = COMPANY_REPORT_SAMPLE.report.reportMeta?.searchEntryPointHtml ?? "";
    expect(html.toLowerCase()).not.toContain("<script");
  });

  it("does not link the sample to any user's resume analysis", () => {
    expect(COMPANY_REPORT_SAMPLE.report.reportMeta?.linkedResumeAnalysisId ?? null).toBeNull();
  });
});
```

Run: `pnpm exec vitest run client/src/constants/companyReportSample.test.ts`
Expected: PASS(실패하면 픽스처가 잘못 생성된 것 — Step 1 을 다시 본다).

- [ ] **Step 3: 렌더 테스트 추가(실패 확인)**

`client/src/pages/CompanyReport.render.test.tsx`에 추가:

```tsx
  it("renders the public sample without login and without fetching", async () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });
    window.history.replaceState({}, "", "/company-report?sample=1");
    const fetchSpy = vi.fn(async () => { throw new Error("sample must not fetch"); });
    vi.stubGlobal("fetch", fetchSpy);
    render(<CompanyReport />);
    expect(await screen.findByText(/샘플 리포트/)).toBeInTheDocument();
    expect(screen.queryByText("로그인이 필요해요")).toBeNull();
    expect(screen.getByRole("button", { name: /내 지원 기업으로 기업 분석 받기/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "내 지원서" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still gates a real report id behind login", async () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });
    window.history.replaceState({}, "", "/company-report?analysisId=analysis-1");
    render(<CompanyReport />);
    expect(await screen.findByText("로그인이 필요해요")).toBeInTheDocument();
  });
```

Run: `pnpm exec vitest run client/src/pages/CompanyReport.render.test.tsx`
Expected: 새 첫 테스트 FAIL.

- [ ] **Step 4: CompanyReport 분기 구현**

`client/src/pages/CompanyReport.tsx`:

1. import 추가: `import { COMPANY_REPORT_SAMPLE } from "@/constants/companyReportSample";`
2. `LoadedReport`에 `sample?: boolean;` 추가.
3. `CompanyReportContent({ company, jobRole, report, sample = false }: LoadedReport)`.
4. 상단 스티키 바의 "내 지원서" 버튼을 분기:

```tsx
            {sample ? (
              <button className="text-[13px] text-gray-300 hover:text-white hover:bg-white/10 font-medium h-8 px-3 rounded-md transition-colors duration-200" onClick={() => navigate("/company-analysis")}>
                기업 분석 시작하기
              </button>
            ) : (
              <button className="text-[13px] text-gray-300 hover:text-white hover:bg-white/10 font-medium h-8 px-3 rounded-md transition-colors duration-200" onClick={() => navigate("/my")}>
                내 지원서
              </button>
            )}
```

5. `<article …>` 바로 안, 표지 `<header id={COMPANY_HERO_ID}` 앞에 리본:

```tsx
        {sample ? (
          <div role="note" className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-4 py-3 text-[13px] text-sky-200">
            <span className="font-semibold">샘플 리포트 · {company} · {asOf} 기준</span>
            <span className="text-sky-200/70 text-pretty">실제 리포트는 지원 기업과 직무를 입력하면 같은 구성으로 새로 생성돼요.</span>
          </div>
        ) : null}
```

6. 07 섹션의 CTA 행(`이 각도로 쓴 자소서…` 버튼과 `연결된 자소서 분석 보기` 버튼이 있는 `div.mt-12`)을 분기: `sample`이면 아래로 대체, 아니면 기존 그대로.

```tsx
          {sample ? (
            <div className="mt-12 flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => navigate("/company-analysis")}
                className="w-full sm:w-auto px-6 py-3.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
              >
                <span>내 지원 기업으로 기업 분석 받기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/entitlements#company")}
                className="w-full sm:w-auto px-6 py-3.5 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition-colors"
              >
                이용권 보기
              </button>
            </div>
          ) : (
            /* 기존 CTA 행 그대로 */
          )}
```

7. 기본 export:

```tsx
export default function CompanyReport() {
  const { isLoading, isAuthenticated } = useAuth();
  // 공개 샘플은 로그인·조회 없이 굳힌 상수를 그대로 렌더한다.
  const isSample = new URLSearchParams(window.location.search).get("sample") === "1";
  if (isSample) {
    return (
      <CompanyReportContent
        analysisId="sample"
        company={COMPANY_REPORT_SAMPLE.company}
        jobRole={COMPANY_REPORT_SAMPLE.jobRole}
        report={COMPANY_REPORT_SAMPLE.report}
        sample
      />
    );
  }
  if (isLoading) { /* 기존 */ }
  …
}
```

- [ ] **Step 5: 테스트·타입 확인**

Run: `pnpm exec vitest run client/src/pages/CompanyReport.render.test.tsx client/src/pages/CompanyReport.source.test.ts client/src/constants/companyReportSample.test.ts && pnpm check`
Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add client/src/constants/companyReportSample.ts client/src/constants/companyReportSample.test.ts client/src/pages/CompanyReport.tsx client/src/pages/CompanyReport.render.test.tsx
git commit -m "feat(company-report): publish a real generated sample report at /company-report?sample=1 without login

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 랜딩 기업 분석 소개 섹션과 GNB 항목

**Files:**
- Create: `client/src/components/CompanyReportIntroSection.tsx`
- Create: `client/src/components/CompanyReportIntroSection.test.tsx`
- Modify: `client/src/pages/Home.tsx` (`HOME_NAV_ITEMS`, import, `<ReportShowcase />`와 `<PricingSection />` 사이)
- Modify: `client/src/pages/Home.test.ts`

**Interfaces:**
- Consumes: `COMPANY_REPORT_SAMPLE.company`(Task 4), `COMPANY_REPORT_INCLUDED_FEATURES`, `PRICING.company.salePrice`, `formatKrw`.
- Produces: `COMPANY_REPORT_INTRO_ID = "company-report-intro"`(섹션 `id`, GNB 스크롤 대상).

- [ ] **Step 1: 섹션 렌더 테스트(실패 확인)**

`client/src/components/CompanyReportIntroSection.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { COMPANY_REPORT_SAMPLE } from "@/constants/companyReportSample";
import { COMPANY_REPORT_INCLUDED_FEATURES } from "@/lib/pricing";

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/", mocks.navigate] }));

import CompanyReportIntroSection, { COMPANY_REPORT_INTRO_ID } from "./CompanyReportIntroSection";

describe("CompanyReportIntroSection", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.navigate.mockReset(); });

  it("anchors the section for the top navigation", () => {
    const { container } = render(<CompanyReportIntroSection />);
    expect(container.querySelector(`#${COMPANY_REPORT_INTRO_ID}`)).not.toBeNull();
  });

  it("lists exactly the report contents promised in pricing", () => {
    render(<CompanyReportIntroSection />);
    for (const feature of COMPANY_REPORT_INCLUDED_FEATURES) {
      expect(screen.getByText(feature)).toBeInTheDocument();
    }
  });

  it("opens the public sample and the analysis form", () => {
    render(<CompanyReportIntroSection />);
    screen.getByRole("button", { name: new RegExp(`샘플 리포트 보기.*${COMPANY_REPORT_SAMPLE.company}`) }).click();
    expect(mocks.navigate).toHaveBeenCalledWith("/company-report?sample=1");
    screen.getByRole("button", { name: "기업 분석 시작하기" }).click();
    expect(mocks.navigate).toHaveBeenCalledWith("/company-analysis");
  });
});
```

Run: `pnpm exec vitest run client/src/components/CompanyReportIntroSection.test.tsx`
Expected: FAIL(모듈 없음).

- [ ] **Step 2: 섹션 구현**

`client/src/components/CompanyReportIntroSection.tsx`:

```tsx
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Check } from "lucide-react";
import { useLocation } from "wouter";

import { COMPANY_REPORT_SAMPLE } from "@/constants/companyReportSample";
import { COMPANY_REPORT_INCLUDED_FEATURES, PRICING, formatKrw } from "@/lib/pricing";

/* ─────────────────────────────────────────────────────────
   CompanyReportIntroSection — 랜딩 기업 분석 리포트 소개
   리포트 쇼케이스(자소서) 뒤, 가격 앞에 둔다. 자소서를 쓰기 전 단계의
   상품이므로 "회사부터 읽는다"는 순서를 문장으로 만든다. 샘플은 실제
   생성 결과(constants/companyReportSample)를 그대로 보여 준다.
   ───────────────────────────────────────────────────────── */

export const COMPANY_REPORT_INTRO_ID = "company-report-intro";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

export default function CompanyReportIntroSection() {
  const [, navigate] = useLocation();

  return (
    <section id={COMPANY_REPORT_INTRO_ID} className="py-28 md:py-36 border-t border-white/[0.04]">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <motion.div
          className="grid gap-12 md:grid-cols-[1.1fr_1fr] md:items-center"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-300">Company Brief</p>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight leading-snug text-balance">
              자소서를 쓰기 전에,
              <br />
              <span className="text-sky-300">회사부터</span> 읽습니다
            </h2>
            <p className="mt-5 text-gray-400 font-light text-[15px] leading-[1.8] max-w-lg text-pretty">
              무엇을 팔아 돈을 버는지, 요즘 힘을 싣는 사업이 무엇인지, 그 안에서 지원 직무가 어떤 문제를 푸는지.
              공개 자료를 출처와 함께 정리해 자소서에 쓸 사업 소재까지 이어 드려요.
            </p>
            <p className="mt-5 text-[13.5px] text-zinc-500">
              기업 분석 1회 {formatKrw(PRICING.company.salePrice)} · 스탠다드·프리미엄 이용권에 포함
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => navigate("/company-report?sample=1")}
                className="landing-primary-cta group"
              >
                <BookOpen className="w-4 h-4" />
                샘플 리포트 보기 · {COMPANY_REPORT_SAMPLE.company}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/company-analysis")}
                className="h-11 rounded-xl border border-white/[0.12] bg-white/[0.05] px-5 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1]"
              >
                기업 분석 시작하기
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 backdrop-blur-sm">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-sky-300">리포트에 담기는 것</p>
            <ul className="mt-4 space-y-3">
              {COMPANY_REPORT_INCLUDED_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-[14px] font-light leading-relaxed text-zinc-300">
                  <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-sky-400" />
                  {feature}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[12.5px] font-light text-zinc-500">
              공개 자료를 바탕으로 정리한 브리프예요. 수치는 부록의 출처 원문에서 확인할 수 있어요.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
```

`landing-primary-cta` 클래스는 `client/src/index.css`에 이미 있다(`PricingSection`의 하단 CTA 가 쓴다). 없으면 그 버튼의 인라인 클래스를 복사한다.

- [ ] **Step 3: Home 배치와 GNB(테스트 먼저)**

`client/src/pages/Home.test.ts`의 첫 테스트 라벨 배열을 `["서비스 소개", "자소서 분석", "기업 분석", "이용권 구매", "내 지원서"]`로 바꾸고 아래를 추가:

```ts
  it("scrolls the company analysis nav item to the landing intro section", () => {
    expect(HOME_NAV_ITEMS).toContainEqual({
      label: "기업 분석",
      type: "section",
      target: "company-report-intro",
    });
    expect(homeSource).toContain(
      'import CompanyReportIntroSection, { COMPANY_REPORT_INTRO_ID } from "@/components/CompanyReportIntroSection"'
    );
    expect(homeSource).toContain("<CompanyReportIntroSection />");
    // 쇼케이스(자소서) 다음, 가격 앞.
    expect(homeSource.indexOf("<ReportShowcase />")).toBeLessThan(homeSource.indexOf("<CompanyReportIntroSection />"));
    expect(homeSource.indexOf("<CompanyReportIntroSection />")).toBeLessThan(homeSource.indexOf("<PricingSection />"));
  });
```

Run: `pnpm exec vitest run client/src/pages/Home.test.ts`
Expected: FAIL.

`client/src/pages/Home.tsx`:

```ts
import CompanyReportIntroSection, { COMPANY_REPORT_INTRO_ID } from "@/components/CompanyReportIntroSection";

export const HOME_NAV_ITEMS = [
  { label: "서비스 소개", type: "section", target: "service-intro" },
  { label: "자소서 분석", type: "route", target: "/analyze" },
  // 비로그인 방문자가 먼저 만나는 항목이라 폼(로그인 벽)이 아니라 소개 섹션으로 보낸다.
  { label: "기업 분석", type: "section", target: COMPANY_REPORT_INTRO_ID },
  { label: "이용권 구매", type: "route", target: "/entitlements" },
  { label: "내 지원서", type: "route", target: "/my" },
] as const;
```

`<ReportShowcase />` 아래에:

```tsx
      {/* ── 기업 분석 리포트 소개 — 자소서 쇼케이스 다음, 가격 앞 ── */}
      <CompanyReportIntroSection />
```

`handleNavClick`의 `section` 처리가 `document.getElementById(target)`로 스크롤하는지 확인한다(서비스 소개와 같은 경로). 다르면 그 방식에 맞춘다.

- [ ] **Step 4: 테스트·타입 확인**

Run: `pnpm exec vitest run client/src/components/CompanyReportIntroSection.test.tsx client/src/pages/Home.test.ts client/src/components/ReportShowcase.test.tsx && pnpm check`
Expected: 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add client/src/components/CompanyReportIntroSection.tsx client/src/components/CompanyReportIntroSection.test.tsx client/src/pages/Home.tsx client/src/pages/Home.test.ts
git commit -m "feat(landing): introduce the company report with a sample link and a 기업 분석 nav item

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: 자소서 리포트 하단 업셀 CTA와 자소서 분석 연결 프리필

**Files:**
- Modify: `client/src/pages/ReportResult.tsx` (상태 `targetJobRole`, prop 전달, `{/* NEXT STEP */}` 앞 섹션)
- Create: `client/src/pages/ReportResult.companyUpsell.test.ts`
- Modify: `client/src/pages/CompanyAnalyze.tsx` (`resumeAnalysisId` 초기값·목록 로드 후 검증)
- Modify: `client/src/pages/CompanyAnalyze.source.test.ts`

**Interfaces:**
- Consumes: `/company-analysis?company=&jobKeyword=`(이미 프리필 지원), `readQueryParam`(CompanyAnalyze 내부), `activeAnalysisId`·`navigate`(ReportResult 내부).
- Produces: `/company-analysis?…&resumeAnalysisId=<id>` — 목록(`/api/projects`의 RESUME·`latest_analysis_id`)에 있으면 선택, 없으면 "연결하지 않기".

- [ ] **Step 1: ReportResult 소스 테스트(실패 확인)**

`client/src/pages/ReportResult.companyUpsell.test.ts`(기존 `ReportResult.mobile.test.ts`처럼 소스 문자열 검사):

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ReportResult.tsx", import.meta.url), "utf8");

describe("ReportResult company upsell", () => {
  it("offers the company report for the same company, role, and analysis after the resume report", () => {
    expect(source).toContain("기업 분석 리포트 받기");
    expect(source).toContain("/company-analysis?company=${encodeURIComponent(targetCompany)}");
    expect(source).toContain("jobKeyword=${encodeURIComponent(targetJobRole)}");
    expect(source).toContain("resumeAnalysisId=${encodeURIComponent(activeAnalysisId ?? \"\")}");
  });

  it("reads the role from the analysis payload next to the company", () => {
    expect(source).toContain('setTargetJobRole(payload.job_role ?? "")');
  });

  it("keeps the upsell out of print", () => {
    const start = source.indexOf("기업 분석 리포트 받기");
    const sectionStart = source.lastIndexOf("<section", start);
    expect(source.slice(sectionStart, start)).toContain("print:hidden");
  });
});
```

Run: `pnpm exec vitest run client/src/pages/ReportResult.companyUpsell.test.ts`
Expected: FAIL.

- [ ] **Step 2: ReportResult 구현**

1. `const [targetCompany, setTargetCompany] = useState("")` 옆에 `const [targetJobRole, setTargetJobRole] = useState("")`.
2. `setTargetCompany(payload.company_name ?? "")` 바로 아래에 `setTargetJobRole(payload.job_role ?? "")`.
3. `targetCompany`를 본문 컴포넌트에 prop 으로 넘기는 곳(props 타입·전달·구조분해 세 곳)에 `targetJobRole: string`을 같은 방식으로 추가.
4. `{/* NEXT STEP */}` 섹션 **앞**에(`ArrowRight`가 lucide import 에 없으면 추가):

```tsx
                {/* 기업 분석 업셀 — 같은 회사·직무로 다음 상품. 인쇄에는 넣지 않는다. */}
                <section className="print:hidden mt-10 rounded-xl border border-sky-500/[0.18] bg-sky-500/[0.04] px-6 py-8 md:px-10 md:py-9">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-300">이 회사를 더 깊게 보기</p>
                    <h3 className="mt-3 text-xl font-medium text-white text-balance">{targetCompany ? `${targetCompany} 기업 분석 리포트` : "지원 기업 분석 리포트"}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-zinc-400 text-pretty">무엇을 팔아 돈을 버는지, 요즘 힘을 싣는 사업이 무엇인지, 이 직무가 어떤 문제를 푸는지를 출처와 함께 정리해 자소서에 쓸 사업 소재까지 이어 드려요.</p>
                    <button
                        onClick={() => navigate(`/company-analysis?company=${encodeURIComponent(targetCompany)}&jobKeyword=${encodeURIComponent(targetJobRole)}&resumeAnalysisId=${encodeURIComponent(activeAnalysisId ?? "")}`)}
                        className="mt-6 w-full sm:w-auto px-6 py-3.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <span>기업 분석 리포트 받기</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </section>
```

`activeAnalysisId`의 실제 타입이 `string | null`이 아니면(`string`이면) `?? ""`를 그대로 두되 `pnpm check`가 불평하면 테스트의 문자열과 함께 `activeAnalysisId`로 맞춘다 — **테스트 문자열과 코드가 같아야 한다.**

- [ ] **Step 3: CompanyAnalyze 소스 테스트(실패 확인)**

`client/src/pages/CompanyAnalyze.source.test.ts`에 추가:

```ts
  it("prefills the linked resume analysis from the query and drops it when it is not in the user's list", () => {
    expect(source).toContain('useState(() => readQueryParam("resumeAnalysisId"))');
    expect(source).toContain("nextResumes.some(project => project.latest_analysis_id === current) ? current : \"\"");
  });
```

Run: `pnpm exec vitest run client/src/pages/CompanyAnalyze.source.test.ts`
Expected: FAIL.

- [ ] **Step 4: CompanyAnalyze 구현**

```ts
  const [resumeAnalysisId, setResumeAnalysisId] = useState(() => readQueryParam("resumeAnalysisId"));
```

목록 로드 `try` 블록을:

```ts
      try {
        const response = await fetch("/api/projects", { headers: await getAuthorizationHeader() });
        if (!response.ok) {
          if (!cancelled) setResumeAnalysisId("");
          return;
        }
        const projects: ProjectSummary[] = await response.json();
        if (!cancelled) {
          const nextResumes = projects.filter(project => project.kind !== "COMPANY" && project.latest_analysis_id);
          setPreviousResumes(nextResumes);
          // 쿼리로 들어온 연결 대상은 내 목록에 있을 때만 유지한다 — 남의 id·삭제된 분석은 "연결하지 않기"로.
          setResumeAnalysisId(current => nextResumes.some(project => project.latest_analysis_id === current) ? current : "");
        }
      } catch {
        // 연결 목록은 선택 사항이다. 목록을 모르면 연결도 하지 않는다.
        if (!cancelled) setResumeAnalysisId("");
      }
```

- [ ] **Step 5: 테스트·타입 확인**

Run: `pnpm exec vitest run client/src/pages/ReportResult.companyUpsell.test.ts client/src/pages/ReportResult.mobile.test.ts client/src/pages/CompanyAnalyze.source.test.ts && pnpm check`
Expected: 전부 PASS(`ReportResult.identity.test.ts`는 main 기존 실패 — 돌리지 않는다).

- [ ] **Step 6: 커밋**

```bash
git add client/src/pages/ReportResult.tsx client/src/pages/ReportResult.companyUpsell.test.ts client/src/pages/CompanyAnalyze.tsx client/src/pages/CompanyAnalyze.source.test.ts
git commit -m "feat(report): upsell the company report below the resume report with company, role, and analysis prefilled

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: 자소서 폼의 조용한 링크, 소진 모달 기본 이동, 이용권 해시 스크롤

**Files:**
- Modify: `client/src/pages/Analyze.tsx` (회사 필드 아래, 소진 모달 `actionHref`)
- Create: `client/src/pages/Analyze.companyLink.test.ts`
- Modify: `client/src/pages/Entitlements.tsx` (해시 효과)
- Modify: `client/src/pages/Entitlements.purchase.test.tsx`

**Interfaces:**
- Consumes: `company`·`jobRole` 상태(Analyze), `TIERS`(pricing.ts), `id={tier.key}`(이용권 티어 카드에 이미 있음).
- Produces: `/entitlements#standard`·`#premium` 이 해당 카드로 스크롤(기존 `#company` 는 베이직 카드 + 기업 선택 유지).

- [ ] **Step 1: Analyze 소스 테스트(실패 확인)**

`client/src/pages/Analyze.companyLink.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");

describe("Analyze company report link", () => {
  it("offers the company report quietly once a company is chosen", () => {
    expect(source).toContain("기업 분석 리포트 먼저 받기");
    expect(source).toContain("/company-analysis?company=${encodeURIComponent(company.trim())}&jobKeyword=${encodeURIComponent(jobRole.trim())}");
    expect(source).toContain("company.trim().length > 0 && (");
  });

  it("sends an exhausted user to the standard tier by default", () => {
    expect(source).toContain('actionHref: "/entitlements#standard"');
    expect(source).not.toContain('actionHref: "/entitlements",');
  });
});
```

Run: `pnpm exec vitest run client/src/pages/Analyze.companyLink.test.ts`
Expected: FAIL.

- [ ] **Step 2: Analyze 구현**

회사 필드 블록을:

```tsx
            {/* 지원 회사 */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-2.5 uppercase tracking-wider">
                지원 회사
              </label>
              <CompanyCombobox value={company} onChange={setCompany} />
              {/* 회사를 고른 순간의 조용한 진입점. 크레딧 유무는 기업 분석 폼과 서버가 판단한다. */}
              {company.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate(`/company-analysis?company=${encodeURIComponent(company.trim())}&jobKeyword=${encodeURIComponent(jobRole.trim())}`)}
                  className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] text-zinc-500 transition-colors hover:text-sky-300"
                >
                  {company.trim()} 기업 분석 리포트 먼저 받기
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
```

`ArrowRight`가 lucide import 에 없으면 추가. 소진 모달의 `actionHref: "/entitlements"` → `actionHref: "/entitlements#standard"`(같은 파일에 `"/entitlements",`가 다른 용도로 남아 있으면 테스트의 `not.toContain` 단언을 그 줄에 맞춰 좁힌다 — 예: `'actionHref: "/entitlements"'` 전체 문자열).

- [ ] **Step 3: 이용권 해시 렌더 테스트(실패 확인)**

`client/src/pages/Entitlements.purchase.test.tsx`의 기존 `#company` 딥링크 테스트 옆에:

```tsx
  it("scrolls to the standard card for /entitlements#standard", async () => {
    window.history.replaceState({}, "", "/entitlements#standard");
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    // 기존 #company 테스트와 같은 인증·fetch 준비
    render(<Entitlements />);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(document.getElementById("standard")).not.toBeNull();
    // 베이직 선택은 기본값(자소서)에서 바뀌지 않는다.
    expect(screen.getByRole("radio", { name: /자소서 진단 1회/ })).toHaveAttribute("aria-checked", "true");
  });
```

(라디오의 접근 가능한 이름은 기존 테스트가 쓰는 표현을 따른다.)

Run: `pnpm exec vitest run client/src/pages/Entitlements.purchase.test.tsx`
Expected: 새 테스트 FAIL.

- [ ] **Step 4: 이용권 해시 효과 확장**

```tsx
  // /entitlements#company — 기업 분석 이용권이 없어서 온 사용자는 베이직 카드의 기업 분석을 바로 고른 상태로 만난다.
  // /entitlements#standard·#premium — 소진 모달 등에서 추천 티어로 바로 스크롤한다.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#company") setBasicChoice("company");
    const targetId = hash === "#company" ? "basic" : hash.slice(1);
    if (TIERS.some((tier) => tier.key === targetId)) {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    }
  }, []);
```

- [ ] **Step 5: 테스트·타입 확인**

Run: `pnpm exec vitest run client/src/pages/Analyze.companyLink.test.ts client/src/pages/Analyze.previousResume.test.ts client/src/pages/Analyze.jobRoles.test.ts client/src/pages/Entitlements.purchase.test.tsx client/src/pages/Entitlements.test.ts && pnpm check`
Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add client/src/pages/Analyze.tsx client/src/pages/Analyze.companyLink.test.ts client/src/pages/Entitlements.tsx client/src/pages/Entitlements.purchase.test.tsx
git commit -m "feat(analyze): link to the company report from the form, default the exhausted modal to the standard tier, and scroll tier hashes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: 검증과 스펙 갱신

**Files:**
- Modify: `docs/superpowers/specs/2026-09-06-company-analysis-report-design.md` (§7-3 "이월(④ 진입점 플랜)" 문단, "3단계 플랜" 문단 아래)

- [ ] **Step 1: 전체 검증**

Run:
```bash
pnpm exec vitest run client/src tests/api/entitlements.test.js scripts/vercel-function-limit.test.js
pnpm check
```
Expected: 실패는 main 기존 실패 3파일(`ReportResult.identity.test.ts` ×2, `homeOnboardingCopy.test.ts` ×1)뿐. 함수 수 12 유지. 타입 오류 0.

- [ ] **Step 2: 로컬 화면 확인(가능하면)**

`pnpm dev`로 `/`(GNB "기업 분석" 스크롤, 소개 섹션, 3티어 가격), `/company-report?sample=1`(비로그인 렌더·리본), `/entitlements`(비로그인 시 미판매 티어 "준비 중")를 연다. Google 로그인이 불가하면 로그인 이후 화면(리포트 하단 CTA·폼 링크)은 테스트로만 확인했다고 보고한다.

- [ ] **Step 3: 스펙 갱신**

§7-3의 문단 `이월(④ 진입점 플랜): 비로그인 방문자에게는 …`을 다음으로 교체:

```markdown
④ 진입점 플랜에서 해결(2026-09-07): 비로그인 판매 가용성은 `GET /api/entitlements?availability=1`(인증 없음, 상품별 boolean 만)로 조회하고, 이용권 페이지는 미판매 티어에 로그인 버튼 대신 "준비 중"을 보여 준다. 랜딩 `PricingSection` 은 `TIERS` 기반 3티어 카드로 재구성했다.
```

"3단계 플랜" 문단 아래에 추가:

```markdown
**4단계 플랜**: `docs/superpowers/plans/2026-09-07-company-analysis-entry-points-plan.md`. 포함: 공개 판매 가용성 API·게스트 버튼, 랜딩 3티어 가격 섹션(`STANDARD_PER_USE_PRICE`), 프로브 `--out`, 공개 샘플 `/company-report?sample=1`(`constants/companyReportSample.ts`, 실제 생성 결과), 랜딩 기업 분석 소개 섹션 + GNB "기업 분석"(섹션 스크롤), 자소서 리포트 하단 업셀 CTA(`resumeAnalysisId` 프리필), 자소서 폼 조용한 링크, 소진 모달 → `/entitlements#standard`. 제외: `MyEntitlements` 진입 버튼(사용자가 별도 작업 중), 관리자 대시보드 kind 분리, 스레드 공지.
```

- [ ] **Step 4: 커밋**

```bash
git add docs/superpowers/specs/2026-09-06-company-analysis-report-design.md
git commit -m "docs(spec): record the entry-point plan and the public sales availability decision

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## 자체 점검

- **스펙 커버리지**: §2 샘플 리포트(리본 "샘플 · 회사 · 기준일") → Task 4. §3 접점 1(리포트 하단 CTA, 프리필) → Task 6. 접점 3(폼 링크) → Task 7(크레딧 유무별 배너/링크 구분은 조용한 링크 하나로 축소 — 폼에 요약 조회를 더 얹지 않는다). 접점 4(소진 모달 → 번들 기본) → Task 7. 접점 5(샘플 링크) → Task 5. §5-6 `Home.tsx` GNB·`CompanyReportShowcase`(→ 소개 섹션으로 구현) → Task 5. §7-3 이월(공개 가용성) → Task 1. 랜딩 `PricingSection` 전체 재구성·`TRIPLE_PER_USE_PRICE` 이름 → Task 2.
- **의도적 제외**: `MyEntitlements` 진입 버튼(사용자 미커밋 편집 중), 관리자 대시보드 kind 분리, 스레드 공지, 접점 2(add-on 토글 — 티어형으로 대체되어 폐기).
- **타입 일관성**: `COMPANY_REPORT_SAMPLE`(Task 4) ↔ Task 5 import. `STANDARD_PER_USE_PRICE`(Task 2) ↔ `PricingSection`. `SalesAvailability.purchasable` 키 = `PURCHASE_PRODUCT_KEYS` = 서버 `checkoutUrls` 키. `COMPANY_REPORT_INTRO_ID`(Task 5) ↔ `HOME_NAV_ITEMS.target`. Task 6 의 `targetJobRole`·`activeAnalysisId` 문자열 ↔ 테스트.
- **플레이스홀더**: Task 1 Step 1 의 두 케이스가 `// ...` 로 준비 코드를 생략했으나, 첫 케이스에 준비 방식을 명시했고 같은 파일의 기존 GET 테스트를 그대로 따르면 된다.
