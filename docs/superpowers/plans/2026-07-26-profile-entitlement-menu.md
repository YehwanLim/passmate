# Profile Entitlement Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated users open a single 이용권 screen from the profile dropdown, see server-authoritative remaining credits, and start a configured payment flow.

**Architecture:** Keep HTTP parsing and purchase-intent requests in a small client API module so it can be tested without rendering React. Keep `Entitlements` responsible only for auth-gated presentation, loading/retry state, and redirecting after a successful purchase intent. Extend the existing shared `AuthButton` so every header using it exposes the same destinations.

**Tech Stack:** React 19, TypeScript, Wouter, Framer Motion, Lucide React, Tailwind CSS, Vitest.

## Global Constraints

- Add `/entitlements` as the authenticated user route; unauthenticated access redirects to `/login?redirect=%2Fentitlements` via `useRequireAuth`.
- The profile dropdown lists `내 지원서`, `이용권`, then a separated `로그아웃`; selecting a destination closes the dropdown first.
- Treat `GET /api/entitlements` as the only authority for `freeRemaining`, `premiumRemaining`, and `remaining`; do not derive credits from browser storage.
- Show `결제하기` only when `premiumEnabled` is `true` and `groblePaymentUrl` is a non-empty string.
- Start checkout only after `POST /api/entitlements/purchase-intents` succeeds, then navigate the current tab to its `checkoutUrl`.
- Do not change payment products, entitlement rules, webhooks, admin pages, `/my`, or the landing-page navigation.
- Do not stage unrelated existing worktree changes.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `client/src/lib/entitlements.ts` | Validates entitlement and purchase-intent API payloads, sends same-origin requests, and exposes typed client functions. |
| `client/src/lib/entitlements.test.ts` | Tests parsing, request method/path, purchase eligibility, and error propagation with a local fake fetch boundary. |
| `client/src/components/AuthButton.tsx` | Adds the two authenticated navigation items and keeps the existing logout behaviour. |
| `client/src/components/AuthButton.test.ts` | Locks down profile-menu destinations and existing login/profile affordances. |
| `client/src/pages/Entitlements.tsx` | Renders auth-gated loading, error, entitlement, and purchase states. |
| `client/src/pages/Entitlements.test.ts` | Verifies the page is wired to the typed API client, auth redirect, retry, checkout redirect, and all required credit states. |
| `client/src/App.tsx` | Registers the new `/entitlements` page route. |

### Task 1: Typed entitlement API client

**Files:**

- Create: `client/src/lib/entitlements.ts`
- Create: `client/src/lib/entitlements.test.ts`

**Interfaces:**

- Produces: `EntitlementSummary`, `EntitlementApiError`, `fetchEntitlementSummary(fetcher?)`, `createPurchaseIntent(fetcher?)`, and `canPurchaseEntitlement(summary)`.
- Consumes: The existing `GET /api/entitlements` response `{ premiumEnabled, freeRemaining, premiumRemaining, remaining, groblePaymentUrl }` and `POST /api/entitlements/purchase-intents` response `{ purchaseIntentId, checkoutUrl }`.

- [ ] **Step 1: Write the failing API client tests**

Create `client/src/lib/entitlements.test.ts` with these behavioural tests. `fetcher` is an injected external boundary, not a mocked production module.

```ts
import { describe, expect, it } from "vitest";
import {
  EntitlementApiError,
  canPurchaseEntitlement,
  createPurchaseIntent,
  fetchEntitlementSummary,
} from "./entitlements";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("entitlements client", () => {
  it("returns the server-provided credit counts without recalculating them", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return jsonResponse({
        premiumEnabled: true,
        freeRemaining: 1,
        premiumRemaining: 2,
        remaining: 3,
        groblePaymentUrl: "https://www.groble.im/payment/example",
      });
    };

    await expect(fetchEntitlementSummary(fetcher)).resolves.toEqual({
      premiumEnabled: true,
      freeRemaining: 1,
      premiumRemaining: 2,
      remaining: 3,
      groblePaymentUrl: "https://www.groble.im/payment/example",
    });
    expect(calls).toEqual([["/api/entitlements", undefined]]);
  });

  it("makes checkout available only for an enabled and configured product", () => {
    expect(canPurchaseEntitlement({
      premiumEnabled: true,
      freeRemaining: 0,
      premiumRemaining: 0,
      remaining: 0,
      groblePaymentUrl: "https://www.groble.im/payment/example",
    })).toBe(true);
    expect(canPurchaseEntitlement({
      premiumEnabled: false,
      freeRemaining: 0,
      premiumRemaining: 0,
      remaining: 0,
      groblePaymentUrl: "https://www.groble.im/payment/example",
    })).toBe(false);
  });

  it("creates a purchase intent before returning the checkout URL", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return jsonResponse({
        purchaseIntentId: "purchase-intent-1",
        checkoutUrl: "https://www.groble.im/payment/example",
      }, 201);
    };

    await expect(createPurchaseIntent(fetcher)).resolves.toEqual({
      purchaseIntentId: "purchase-intent-1",
      checkoutUrl: "https://www.groble.im/payment/example",
    });
    expect(calls).toEqual([["/api/entitlements/purchase-intents", { method: "POST" }]]);
  });

  it("reports a failed entitlement request as an actionable API error", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({ error: "PREMIUM_SALES_DISABLED" }, 403);

    await expect(createPurchaseIntent(fetcher)).rejects.toEqual(
      new EntitlementApiError("PREMIUM_SALES_DISABLED"),
    );
  });
});
```

- [ ] **Step 2: Run the API client tests and verify they fail because the module is absent**

Run: `pnpm vitest run client/src/lib/entitlements.test.ts`

Expected: FAIL with a module-resolution error for `./entitlements`.

- [ ] **Step 3: Implement the minimal typed API client**

Create `client/src/lib/entitlements.ts` with the following public contract and strict payload validation. Preserve `remaining` from the server rather than adding the free and premium values in the client.

```ts
export type EntitlementSummary = {
  premiumEnabled: boolean;
  freeRemaining: number;
  premiumRemaining: number;
  remaining: number;
  groblePaymentUrl: string | null;
};

export type PurchaseIntent = {
  purchaseIntentId: string;
  checkoutUrl: string;
};

export class EntitlementApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntitlementApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new EntitlementApiError(`Invalid ${field} response`);
  }
  return value;
}

function readError(payload: unknown, fallback: string): string {
  return isRecord(payload) && typeof payload.error === "string" && payload.error
    ? payload.error
    : fallback;
}

export function canPurchaseEntitlement(summary: EntitlementSummary): boolean {
  return summary.premiumEnabled && Boolean(summary.groblePaymentUrl?.trim());
}
```

Finish the module with `fetchEntitlementSummary` and `createPurchaseIntent`. Both functions must `await response.json()`, throw `EntitlementApiError(readError(...))` for non-OK responses, and reject missing or malformed success fields. `createPurchaseIntent` must call `fetcher("/api/entitlements/purchase-intents", { method: "POST" })` and require an absolute `http:` or `https:` `checkoutUrl` via `new URL(checkoutUrl)`.

- [ ] **Step 4: Run the API client tests and verify they pass**

Run: `pnpm vitest run client/src/lib/entitlements.test.ts`

Expected: PASS with four passing tests.

- [ ] **Step 5: Commit the client API unit**

Run:

```bash
git add client/src/lib/entitlements.ts client/src/lib/entitlements.test.ts
git commit -m "feat: add entitlement client"
```

Expected: one commit containing only the entitlement client and its tests.

### Task 2: Profile dropdown destinations

**Files:**

- Modify: `client/src/components/AuthButton.tsx`
- Modify: `client/src/components/AuthButton.test.ts`

**Interfaces:**

- Consumes: Wouter `navigate`, existing authenticated user details, and the `/my` and `/entitlements` routes.
- Produces: Buttons `header-my-projects-btn` and `header-entitlements-btn`, both of which close the open menu before navigating.

- [ ] **Step 1: Write the failing navigation-menu test**

Extend `client/src/components/AuthButton.test.ts` as follows.

```ts
it("offers application and entitlement destinations before logout for authenticated users", () => {
  const projectsIndex = source.indexOf('id="header-my-projects-btn"');
  const entitlementsIndex = source.indexOf('id="header-entitlements-btn"');
  const logoutIndex = source.indexOf('id="header-logout-btn"');

  expect(projectsIndex).toBeGreaterThan(-1);
  expect(entitlementsIndex).toBeGreaterThan(projectsIndex);
  expect(logoutIndex).toBeGreaterThan(entitlementsIndex);
  expect(source).toContain('navigate("/my")');
  expect(source).toContain('navigate("/entitlements")');
  expect(source).toContain("setDropdownOpen(false)");
});
```

- [ ] **Step 2: Run the AuthButton test and verify it fails for the absent destination buttons**

Run: `pnpm vitest run client/src/components/AuthButton.test.ts`

Expected: FAIL because `header-my-projects-btn` and `header-entitlements-btn` do not exist.

- [ ] **Step 3: Add the smallest shared navigation handler and menu items**

In `AuthButton.tsx`, import `FileText` and `Ticket`, then add this handler next to `handleSignOut`:

```ts
const handleNavigate = (path: "/my" | "/entitlements") => {
  setDropdownOpen(false);
  navigate(path);
};
```

Insert this block between the user-information block and the existing logout block. Keep the existing logout block below it, separated by its current wrapper spacing.

```tsx
<div className="p-1.5 border-b border-white/[0.06]">
  <button
    id="header-my-projects-btn"
    onClick={() => handleNavigate("/my")}
    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-300 hover:text-white hover:bg-white/10 transition-colors duration-150"
  >
    <FileText className="w-4 h-4 text-gray-500" />
    내 지원서
  </button>
  <button
    id="header-entitlements-btn"
    onClick={() => handleNavigate("/entitlements")}
    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-300 hover:text-white hover:bg-white/10 transition-colors duration-150"
  >
    <Ticket className="w-4 h-4 text-gray-500" />
    이용권
  </button>
</div>
```

- [ ] **Step 4: Run the AuthButton test and verify it passes**

Run: `pnpm vitest run client/src/components/AuthButton.test.ts`

Expected: PASS, including the existing login and header-style assertion.

- [ ] **Step 5: Commit the dropdown feature**

Run:

```bash
git add client/src/components/AuthButton.tsx client/src/components/AuthButton.test.ts
git commit -m "feat: add profile menu destinations"
```

Expected: one commit containing the profile destination buttons and regression test.

### Task 3: Entitlement page and route

**Files:**

- Create: `client/src/pages/Entitlements.tsx`
- Create: `client/src/pages/Entitlements.test.ts`
- Modify: `client/src/App.tsx`

**Interfaces:**

- Consumes: `useRequireAuth({ redirectPath: "/entitlements" })`, `fetchEntitlementSummary`, `createPurchaseIntent`, and `canPurchaseEntitlement` from Task 1.
- Produces: An auth-gated `/entitlements` page with loading, retryable error, current credit, and checkout-start states.

- [ ] **Step 1: Write the failing page and route wiring test**

Create `client/src/pages/Entitlements.test.ts` with the project’s established source-wiring test style.

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./Entitlements.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("Entitlements page", () => {
  it("protects the entitlement route and obtains the displayed balance from the API client", () => {
    expect(pageSource).toContain('useRequireAuth({ redirectPath: "/entitlements" })');
    expect(pageSource).toContain("fetchEntitlementSummary");
    expect(pageSource).toContain("freeRemaining");
    expect(pageSource).toContain("premiumRemaining");
    expect(pageSource).toContain("remaining");
    expect(appSource).toContain('path={"/entitlements"} component={Entitlements}');
  });

  it("provides retryable errors and only starts checkout after a purchase intent", () => {
    expect(pageSource).toContain("다시 시도");
    expect(pageSource).toContain("canPurchaseEntitlement");
    expect(pageSource).toContain("createPurchaseIntent");
    expect(pageSource).toContain("window.location.assign");
    expect(pageSource).toContain("결제하기");
  });
});
```

- [ ] **Step 2: Run the page test and verify it fails because the page and route do not exist**

Run: `pnpm vitest run client/src/pages/Entitlements.test.ts`

Expected: FAIL with a file-read error for `Entitlements.tsx`.

- [ ] **Step 3: Implement the auth-gated entitlement page**

Create `client/src/pages/Entitlements.tsx`. Use the existing dark header pattern from `MyProjects.tsx`: `Logo`, `AuthButton`, a back-to-home button, `motion.nav`, and `SubtleBackground`. Use `Ticket`, `Sparkles`, `CreditCard`, `ArrowLeft`, `Loader2`, and `RefreshCw` for visual affordances.

Use this state and loading behaviour exactly:

```tsx
const { isLoading: authLoading, isAuthenticated } = useRequireAuth({
  redirectPath: "/entitlements",
});
const [summary, setSummary] = useState<EntitlementSummary | null>(null);
const [error, setError] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [isPurchasing, setIsPurchasing] = useState(false);

const loadEntitlements = useCallback(async () => {
  setIsLoading(true);
  setError(null);
  try {
    setSummary(await fetchEntitlementSummary());
  } catch {
    setError("이용권 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  } finally {
    setIsLoading(false);
  }
}, []);

useEffect(() => {
  if (!authLoading && isAuthenticated) void loadEntitlements();
}, [authLoading, isAuthenticated, loadEntitlements]);
```

Render a skeleton while `authLoading || isLoading`, and do not request data before authentication finishes. Render a bordered error panel with a `다시 시도` button that invokes `loadEntitlements` when `error` is present. Once `summary` is available, show one prominent `남은 분석 {summary.remaining}회` card and two smaller cards labeled `무료 이용권` and `프리미엄 이용권` with their server-provided remaining values.

Add this purchase handler and only render its button when `canPurchaseEntitlement(summary)` is true:

```tsx
const handlePurchase = async () => {
  if (isPurchasing) return;
  setIsPurchasing(true);
  setError(null);
  try {
    const { checkoutUrl } = await createPurchaseIntent();
    window.location.assign(checkoutUrl);
  } catch {
    setError("결제를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    setIsPurchasing(false);
  }
};
```

Use `disabled={isPurchasing}` and replace the button label with `결제 페이지로 이동 중...` while the purchase request is pending. When premium sales are unavailable, omit the button and show `현재 추가 이용권 판매를 준비하고 있어요.` below the credit cards. Do not update local credit balances after checkout begins.

- [ ] **Step 4: Register the exact route**

In `client/src/App.tsx`, import and add the page directly before the existing `/my` route so it is a top-level user-facing route.

```tsx
import Entitlements from "./pages/Entitlements";

<Route path={"/entitlements"} component={Entitlements} />
<Route path={"/my"} component={MyProjects} />
```

- [ ] **Step 5: Run the entitlement page test and verify it passes**

Run: `pnpm vitest run client/src/pages/Entitlements.test.ts`

Expected: PASS with the auth, API, retry, checkout, and route wiring assertions.

- [ ] **Step 6: Commit the screen and route**

Run:

```bash
git add client/src/pages/Entitlements.tsx client/src/pages/Entitlements.test.ts client/src/App.tsx
git commit -m "feat: add entitlement management page"
```

Expected: one commit containing only the new screen, its regression test, and its route.

### Task 4: Full feature verification

**Files:**

- Verify only: files changed in Tasks 1–3

**Interfaces:**

- Consumes: All completed tests and the TypeScript compiler.
- Produces: Evidence that the new menu, API client, screen, and router compile together without modifying unrelated worktree files.

- [ ] **Step 1: Run all focused regression tests**

Run:

```bash
pnpm vitest run client/src/lib/entitlements.test.ts client/src/components/AuthButton.test.ts client/src/pages/Entitlements.test.ts
```

Expected: every focused test passes.

- [ ] **Step 2: Run the TypeScript check**

Run: `pnpm check`

Expected: exit code `0` and no TypeScript diagnostics.

- [ ] **Step 3: Inspect the changed-file boundary**

Run:

```bash
git diff --check HEAD~3..HEAD
git status --short
```

Expected: no whitespace errors; only the user’s pre-existing unrelated changes remain unstaged after the feature commits.

- [ ] **Step 4: Manually verify the authenticated flow in the browser**

Run: `pnpm dev`

Expected: with a signed-in session, the landing-page profile dropdown opens; `내 지원서` reaches `/my`; `이용권` reaches `/entitlements`; the page shows loading then server-issued remaining counts; a configured premium account can start checkout; unavailable sales omit the purchase button; and logout still returns to `/`.
