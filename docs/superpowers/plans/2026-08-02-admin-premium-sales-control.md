# Admin Premium Sales Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Let administrators control whether new Groble premium checkout sessions start from /admin/payments, without affecting granted credits or valid payment webhooks.

**Architecture:** The existing administrator-only GET/PATCH /api/admin/entitlements handler remains the persistence and authorization boundary. A small browser client validates its response and the payments page holds only the last server-confirmed state. The ON-to-OFF action needs confirmation; failures keep that confirmed state.

**Tech Stack:** React 19, TypeScript, Radix/Tailwind primitives, Supabase browser session, Vercel API route, Vitest, Testing Library.

## Global Constraints

- Reuse GET/PATCH /api/admin/entitlements; do not add database fields, a second flag, dependencies, or browser-visible secrets.
- Sales OFF blocks only future POST /api/entitlements/purchase-intents; it does not revoke credits or change webhook processing.
- The browser never persists payment state to localStorage; the API is the single source of truth.
- Work only in isolated branch codex/admin-premium-sales-control; do not stage the primary checkout's unrelated files.
- Use pnpm. Do not run pnpm build without a real DATABASE_URL.
- Do not push, merge, or deploy this work until the user selects the combined release.

---

## File Structure

| File | Responsibility |
| --- | --- |
| client/src/lib/admin-entitlements.ts | Authenticated read/update boundary for the persisted premium-sales setting. |
| client/src/lib/admin-entitlements.test.ts | Token, request, response-validation, and error contract tests. |
| client/src/pages/admin/payments/PaymentsPage.tsx | Loading, status, confirmation, mutation, retry, and explanatory operator UI. |
| client/src/pages/admin/payments/PaymentsPage.test.tsx | Rendered interaction tests for the new control. |
| client/src/pages/admin/settings/SettingsPage.tsx | Removes the misleading local payment-module setting. |
| client/src/pages/admin/settings/SettingsPage.test.tsx | Verifies the Feature Flag tab no longer offers a payment control. |

### Task 1: Authenticated premium-sales API client

**Files:**
- Create: client/src/lib/admin-entitlements.ts
- Test: client/src/lib/admin-entitlements.test.ts

**Interfaces:**
- Consumes: supabase.auth.getSession() from client/src/lib/supabase.ts, GET/PATCH /api/admin/entitlements.
- Produces: PremiumSalesSettings, fetchPremiumSalesSettings(), updatePremiumSalesEnabled(premiumEnabled).

- [ ] **Step 1: Write the failing client-contract tests**

The named breaks are: missing bearer token, wrong PATCH body, accepting a string instead of a boolean response, and hiding a JSON API error. Mock only Supabase session and fetch because they are external browser boundaries.

~~~ts
const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

it("reads persisted sales state with the active bearer token", async () => {
  mockedFetch().mockResolvedValue(jsonResponse({ premiumEnabled: true }));

  await expect(fetchPremiumSalesSettings()).resolves.toEqual({ premiumEnabled: true });
  expect(mockedFetch()).toHaveBeenCalledWith("/api/admin/entitlements", {
    headers: {
      Authorization: "Bearer session-token",
      "Content-Type": "application/json",
    },
  });
});

it("patches only the requested persisted sales state", async () => {
  mockedFetch().mockResolvedValue(jsonResponse({ premiumEnabled: false }));

  await expect(updatePremiumSalesEnabled(false)).resolves.toEqual({ premiumEnabled: false });
  expect(mockedFetch()).toHaveBeenCalledWith("/api/admin/entitlements", expect.objectContaining({
    method: "PATCH",
    body: JSON.stringify({ premiumEnabled: false }),
    headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
  }));
});

it("rejects a malformed response instead of silently treating it as disabled", async () => {
  mockedFetch().mockResolvedValue(jsonResponse({ premiumEnabled: "false" }));

  await expect(fetchPremiumSalesSettings()).rejects.toThrow(
    "결제 판매 상태를 불러오지 못했습니다.",
  );
});
~~~

- [ ] **Step 2: Run the test to verify RED**

Run: pnpm exec vitest run client/src/lib/admin-entitlements.test.ts

Expected: FAIL because module ./admin-entitlements does not exist. The expected failure must not be from a test typo.

- [ ] **Step 3: Implement the smallest response-validating client**

~~~ts
// client/src/lib/admin-entitlements.ts
import { supabase } from "./supabase";

export interface PremiumSalesSettings {
  premiumEnabled: boolean;
}

type JsonRecord = Record<string, unknown>;

async function requestPremiumSalesSettings(
  init: RequestInit,
  fallback: string,
): Promise<PremiumSalesSettings> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");

  const response = await fetch("/api/admin/entitlements", {
    ...init,
    headers: {
      ...init.headers,
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
  });
  const payload = (response.headers.get("content-type") ?? "").includes("application/json")
    ? await response.json() as JsonRecord
    : null;
  if (!response.ok) {
    throw new Error(payload && typeof payload.error === "string" ? payload.error : fallback);
  }
  if (!payload || typeof payload.premiumEnabled !== "boolean") {
    throw new Error(fallback);
  }
  return { premiumEnabled: payload.premiumEnabled };
}

export function fetchPremiumSalesSettings() {
  return requestPremiumSalesSettings({}, "결제 판매 상태를 불러오지 못했습니다.");
}

export function updatePremiumSalesEnabled(premiumEnabled: boolean) {
  return requestPremiumSalesSettings(
    { method: "PATCH", body: JSON.stringify({ premiumEnabled }) },
    "결제 판매 상태를 변경하지 못했습니다.",
  );
}
~~~

- [ ] **Step 4: Verify GREEN and error boundaries**

Run: pnpm exec vitest run client/src/lib/admin-entitlements.test.ts && pnpm check

Expected: PASS. Add separate tests for session absence and a non-2xx JSON { error: "저장 실패" } response; the client must reject without making a request when the session is absent.

- [ ] **Step 5: Commit this unit**

~~~bash
git add client/src/lib/admin-entitlements.ts client/src/lib/admin-entitlements.test.ts
git commit -m "feat: add admin premium sales client"
~~~

### Task 2: Payments-page persisted control

**Files:**
- Modify: client/src/pages/admin/payments/PaymentsPage.tsx
- Test: client/src/pages/admin/payments/PaymentsPage.test.tsx

**Interfaces:**
- Consumes: PremiumSalesSettings and both functions from client/src/lib/admin-entitlements.ts, AdminPageHeader, Alert, Badge, Button, Card, Switch, Skeleton, AlertDialog.
- Produces: Server-backed status and toggle control on /admin/payments.

- [ ] **Step 1: Write failing page-interaction tests**

The named breaks are: initial loading treated as a known state, disabling without confirmation, retaining an optimistic false state after API rejection, or failing to offer a load retry. Mock the API client as the external boundary, but render PaymentsPage and assert user-visible state.

~~~tsx
// @vitest-environment jsdom
it("requires confirmation before disabling new premium sales", async () => {
  apiMocks.fetchPremiumSalesSettings.mockResolvedValue({ premiumEnabled: true });
  apiMocks.updatePremiumSalesEnabled.mockResolvedValue({ premiumEnabled: false });
  const { container } = render(createElement(PaymentsPage));

  await waitFor(() => expect(screen.getByText("판매 중")).toBeTruthy());
  fireEvent.click(container.querySelector("#premium-sales-toggle")!);
  expect(screen.getByText("결제 판매를 중지할까요?")).toBeTruthy();
  expect(apiMocks.updatePremiumSalesEnabled).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "판매 중지" }));
  await waitFor(() => {
    expect(apiMocks.updatePremiumSalesEnabled).toHaveBeenCalledWith(false);
  });
  expect(screen.getByText("판매 중지")).toBeTruthy();
});

it("keeps the last confirmed setting after a failed enable", async () => {
  apiMocks.fetchPremiumSalesSettings.mockResolvedValue({ premiumEnabled: false });
  apiMocks.updatePremiumSalesEnabled.mockRejectedValue(new Error("저장 실패"));
  const { container } = render(createElement(PaymentsPage));

  await waitFor(() => expect(screen.getByText("판매 중지")).toBeTruthy());
  fireEvent.click(container.querySelector("#premium-sales-toggle")!);
  await waitFor(() => expect(screen.getByText("저장 실패")).toBeTruthy());
  expect(container.querySelector("#premium-sales-toggle")).toHaveProperty("checked", false);
});
~~~

Use narrow Switch and AlertDialog test doubles that preserve checked/onCheckedChange and open/action semantics. This avoids asserting on portal implementation and leaves PaymentsPage state transitions real.

- [ ] **Step 2: Run the page test to verify RED**

Run: pnpm exec vitest run client/src/pages/admin/payments/PaymentsPage.test.tsx

Expected: FAIL because the current page is a placeholder with no sales state, switch, or confirmation flow.

- [ ] **Step 3: Implement only the state and rendered behavior under test**

~~~tsx
const [settings, setSettings] = useState<PremiumSalesSettings | null>(null);
const [error, setError] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);
const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);

const loadSettings = useCallback(async () => {
  setIsLoading(true);
  setError(null);
  try {
    setSettings(await fetchPremiumSalesSettings());
  } catch (cause) {
    setError(errorMessage(cause, "결제 판매 상태를 불러오지 못했습니다."));
  } finally {
    setIsLoading(false);
  }
}, []);

const saveSalesState = async (premiumEnabled: boolean) => {
  setIsSaving(true);
  setError(null);
  try {
    setSettings(await updatePremiumSalesEnabled(premiumEnabled));
  } catch (cause) {
    setError(errorMessage(cause, "결제 판매 상태를 변경하지 못했습니다."));
  } finally {
    setIsSaving(false);
  }
};
~~~

Call loadSettings from an effect. Render a Card containing:
- Badge text exactly 판매 중 when settings.premiumEnabled and 판매 중지 when false.
- Switch id premium-sales-toggle, disabled while loading, saving, or state is unknown.
- Copy stating OFF blocks only new checkout attempts and does not remove already granted credits.
- On enabled-to-disabled, open AlertDialog title 결제 판매를 중지할까요? without updating state. Its destructive 판매 중지 action invokes saveSalesState(false).
- On disabled-to-enabled, call saveSalesState(true) directly.
- A destructive Alert and 다시 시도 Button calling loadSettings if initial fetch fails; a Skeleton while the first fetch is pending.

- [ ] **Step 4: Verify GREEN with all interactions**

Run: pnpm exec vitest run client/src/pages/admin/payments/PaymentsPage.test.tsx client/src/lib/admin-entitlements.test.ts

Expected: PASS. Add checks that the switch is disabled while update is unresolved and that initial-load failure exposes 다시 시도 rather than an editable unknown status.

- [ ] **Step 5: Commit this unit**

~~~bash
git add client/src/pages/admin/payments/PaymentsPage.tsx client/src/pages/admin/payments/PaymentsPage.test.tsx
git commit -m "feat: control premium sales from admin payments"
~~~

### Task 3: Remove the local-only Settings payment switch

**Files:**
- Modify: client/src/pages/admin/settings/SettingsPage.tsx:45-87,450-466
- Create: client/src/pages/admin/settings/SettingsPage.test.tsx

**Interfaces:**
- Consumes: Existing Feature Flag tab.
- Produces: A page with its two unrelated AI switches retained and no browser-local payment switch.

- [ ] **Step 1: Write the failing visible UI test**

The named break is reintroducing the obsolete 결제 모듈 활성화 switch, which misleads operators into thinking it controls checkout. Render the page and inspect the Feature Flag tab rather than searching source text.

~~~tsx
// @vitest-environment jsdom
it("does not offer a local payment-module switch in Feature Flag settings", () => {
  localStorage.clear();
  render(createElement(SettingsPage));

  fireEvent.click(screen.getByRole("tab", { name: /Feature Flag/ }));
  expect(screen.queryByText("결제 모듈 활성화")).toBeNull();
  expect(screen.getByText("AI 상세 피드백 Beta")).toBeTruthy();
  expect(screen.getByText("AI 리라이트(Rewrite) 개선 엔진 v2")).toBeTruthy();
});
~~~

- [ ] **Step 2: Run the Settings test to verify RED**

Run: pnpm exec vitest run client/src/pages/admin/settings/SettingsPage.test.tsx

Expected: FAIL because the Feature Flag tab currently renders 결제 모듈 활성화.

- [ ] **Step 3: Remove only the obsolete model and row**

~~~tsx
interface SystemSettings {
  serviceOn: boolean;
  maintenanceMessage: string;
  popupOn: boolean;
  popupTitle: string;
  popupContent: string;
  betaFeatures: {
    aiDetailedFeedback: boolean;
    rewriteEngineV2: boolean;
  };
}

const DEFAULT_SETTINGS: SystemSettings = {
  // existing non-payment defaults remain unchanged
  betaFeatures: {
    aiDetailedFeedback: true,
    rewriteEngineV2: false,
  },
};
~~~

Delete paymentModule from the interface and default state, then delete only its entire 결제 모듈 활성화 Switch row. Preserve other Settings page local-storage behavior and unrelated copy.

- [ ] **Step 4: Verify GREEN**

Run: pnpm exec vitest run client/src/pages/admin/settings/SettingsPage.test.tsx && pnpm check

Expected: PASS, including visibility of both retained AI flags.

- [ ] **Step 5: Commit this unit**

~~~bash
git add client/src/pages/admin/settings/SettingsPage.tsx client/src/pages/admin/settings/SettingsPage.test.tsx
git commit -m "fix: remove local payment module toggle"
~~~

### Task 4: Complete verification and handoff

**Files:**
- Verify: client/src/lib/admin-entitlements.ts
- Verify: client/src/pages/admin/payments/PaymentsPage.tsx
- Verify: client/src/pages/admin/settings/SettingsPage.tsx
- Verify: tests/api/entitlements.test.js

**Interfaces:**
- Consumes: New UI/client tests plus existing server test that protects admin-only updates and disabled checkout.
- Produces: A verified feature branch ready for later intentional merge.

- [ ] **Step 1: Run focused client and server behavior tests**

~~~bash
SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= \
VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=test-anon-key \
pnpm exec vitest run \
  client/src/lib/admin-entitlements.test.ts \
  client/src/pages/admin/payments/PaymentsPage.test.tsx \
  client/src/pages/admin/settings/SettingsPage.test.tsx \
  tests/api/entitlements.test.js
~~~

Expected: PASS. The existing API test must still prove non-admin PATCH is forbidden and premium-disabled purchase intent returns 403 PREMIUM_SALES_DISABLED before creation.

- [ ] **Step 2: Run type and diff checks**

~~~bash
pnpm check
git diff --check main...HEAD
git status --short
~~~

Expected: type check exits 0, diff check prints nothing, and only the six scoped feature files plus this intentional plan are present.

- [ ] **Step 3: Commit the plan if it is deliberately retained on the branch**

~~~bash
git add docs/superpowers/plans/2026-08-02-admin-premium-sales-control.md
git commit -m "docs: plan admin premium sales control"
~~~

Do not push, merge, or deploy. After other conversations finish, merge this branch deliberately, push the selected main commit once, and then run the real Groble payment and one-time webhook-redelivery acceptance sequence from the approved design.
