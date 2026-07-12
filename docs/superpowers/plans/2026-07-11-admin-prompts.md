# Admin Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin Prompts area where operators create draft prompt versions, activate one version per prompt type, roll back safely, and run a no-cost mock playground.

**Architecture:** Extend the existing `prompt_templates` data model with a prompt type and operator metadata, then access it from small client-side repositories built on the existing authenticated Supabase client. Keep version arithmetic and mock-run creation in a pure utility module so it can be tested independently. The two admin pages render the list and editor/playground UI and use Wouter routes.

**Tech Stack:** React 19, TypeScript, Wouter, Supabase JS, shadcn/ui, Tailwind CSS, Vitest.

## Global Constraints

- Support exactly: `resume-analysis`, `cover-letter`, `summary`, `feedback`, `interview-questions`.
- Saving always creates a new `Draft`; it never overwrites a version.
- Only an explicit Activate action changes the production-active version.
- A rollback copies historical content to a new Draft; historical records are not changed or deleted.
- Mock playground must never call OpenAI, Gemini, Claude, or any network API.
- Follow the existing admin layout and shadcn/ui components.

---

### Task 1: Prompt data model and version helpers

**Files:**
- Create: `client/src/lib/admin-prompts.ts`
- Create: `client/src/lib/admin-prompts.test.ts`
- Create: `prisma/migrations/20260711_add_admin_prompt_metadata/migration.sql`
- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.sql`

**Interfaces:**
- Produces `PromptType`, `PromptTemplateRecord`, `nextPromptVersion(versions: string[]): string`, `createMockPromptRun(resume: string, promptName: string): MockPromptRun`.
- Produces the columns `prompt_type`, `notes`, `updated_by`, and `updated_at` on `prompt_templates`.

- [ ] **Step 1: Write the failing version and mock-run tests**

```ts
import { describe, expect, it } from "vitest";
import { createMockPromptRun, nextPromptVersion } from "./admin-prompts";

describe("nextPromptVersion", () => {
  it("starts a prompt type at v1.0", () => {
    expect(nextPromptVersion([])).toBe("v1.0");
  });

  it("increments the largest minor version", () => {
    expect(nextPromptVersion(["v1.0", "v1.2", "v2.0"])).toBe("v2.1");
  });
});

describe("createMockPromptRun", () => {
  it("does not require a provider request and returns usage metadata", () => {
    const result = createMockPromptRun("지원자 이력서", "Resume Analysis");
    expect(result.response).toContain("Resume Analysis");
    expect(result.responseTimeMs).toBeGreaterThan(0);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.estimatedCost).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run client/src/lib/admin-prompts.test.ts`

Expected: FAIL because `admin-prompts.ts` does not exist.

- [ ] **Step 3: Implement pure types and helpers**

```ts
export const PROMPT_TYPES = [
  "resume-analysis", "cover-letter", "summary", "feedback", "interview-questions",
] as const;

export type PromptType = (typeof PROMPT_TYPES)[number];

export function nextPromptVersion(versions: string[]) {
  const parsed = versions
    .map((version) => /^v(\d+)\.(\d+)$/.exec(version))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => [Number(match[1]), Number(match[2])] as const)
    .sort(([majorA, minorA], [majorB, minorB]) => majorB - majorA || minorB - minorA);
  if (!parsed[0]) return "v1.0";
  return `v${parsed[0][0]}.${parsed[0][1] + 1}`;
}

export function createMockPromptRun(resume: string, promptName: string) {
  const totalTokens = Math.max(180, Math.ceil(resume.trim().length / 2.8));
  return {
    response: `${promptName} mock response\n\n입력된 이력서를 바탕으로 핵심 강점과 다음 개선 우선순위를 제안합니다.`,
    responseTimeMs: 420 + (totalTokens % 280),
    totalTokens,
    estimatedCost: Number(((totalTokens / 1_000_000) * 0.4).toFixed(6)),
  };
}
```

- [ ] **Step 4: Add the database fields and uniqueness constraint**

```sql
ALTER TABLE prompt_templates
  ADD COLUMN IF NOT EXISTS prompt_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_prompt_templates_type_version
  ON prompt_templates (prompt_type, version)
  WHERE prompt_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prompt_templates_prompt_type
  ON prompt_templates (prompt_type);
```

Mirror those fields in `PromptTemplate` in `prisma/schema.prisma` and in `prisma/schema.sql`; do not remove the legacy `version, variant` constraint because existing analysis rows may rely on it.

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `pnpm exec vitest run client/src/lib/admin-prompts.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 6: Commit the isolated data and utility change**

```bash
git add client/src/lib/admin-prompts.ts client/src/lib/admin-prompts.test.ts prisma/schema.prisma prisma/schema.sql prisma/migrations/20260711_add_admin_prompt_metadata/migration.sql
git commit -m "feat: add prompt version data helpers"
```

### Task 2: Prompt repository with draft, activate, and rollback operations

**Files:**
- Create: `client/src/hooks/admin/usePrompts.ts`
- Modify: `client/src/lib/admin-prompts.ts`
- Test: `client/src/lib/admin-prompts.test.ts`

**Interfaces:**
- Consumes `PromptType`, `PromptTemplateRecord`, and `nextPromptVersion` from `admin-prompts.ts`.
- Produces `usePrompts()` with `loadPrompts`, `saveDraft`, `activateVersion`, and `createRollbackDraft`.

- [ ] **Step 1: Add failing tests for data payload builders**

```ts
import { buildActivationUpdates, buildDraftRecord } from "./admin-prompts";

it("creates a draft with the next version and inactive status", () => {
  const draft = buildDraftRecord({
    type: "summary",
    versions: ["v1.0"],
    name: "Summary",
    systemPrompt: "system",
    userTemplate: "{{resume}}",
    temperature: 0.4,
    maxTokens: 800,
    notes: "Shorter output",
    updatedBy: "admin@passmate.ai",
  });
  expect(draft.version).toBe("v1.1");
  expect(draft.is_active).toBe(false);
  expect(draft.prompt_type).toBe("summary");
});

it("targets only matching prompt type records when activating", () => {
  expect(buildActivationUpdates("feedback", "selected-id")).toEqual({
    deactivate: { prompt_type: "feedback", is_active: false },
    activateId: "selected-id",
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run client/src/lib/admin-prompts.test.ts`

Expected: FAIL because `buildDraftRecord` and `buildActivationUpdates` are not exported.

- [ ] **Step 3: Implement the payload builders and repository hook**

```ts
export function buildActivationUpdates(promptType: PromptType, activateId: string) {
  return { deactivate: { prompt_type: promptType, is_active: false }, activateId };
}

// In usePrompts.ts: saveDraft inserts buildDraftRecord(...); activateVersion first
// updates all prompt_templates matching prompt_type to inactive, then updates the
// selected id to active. Every Supabase response error is thrown to the page.
```

The hook must read the signed-in Supabase user to populate `updated_by`, select all fields needed by the pages, and order history by `created_at` descending. `createRollbackDraft` passes the selected historical record to the same `saveDraft` path so rollback creates a new inactive version.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm exec vitest run client/src/lib/admin-prompts.test.ts`

Expected: PASS with 5 tests.

- [ ] **Step 5: Commit the repository layer**

```bash
git add client/src/lib/admin-prompts.ts client/src/lib/admin-prompts.test.ts client/src/hooks/admin/usePrompts.ts
git commit -m "feat: add admin prompt version workflows"
```

### Task 3: Prompts list page and admin navigation

**Files:**
- Create: `client/src/pages/admin/prompts/PromptsPage.tsx`
- Modify: `client/src/components/admin/layout/AdminSidebar.tsx`
- Modify: `client/src/pages/admin/AdminRoot.tsx`

**Interfaces:**
- Consumes `PROMPT_TYPES` and `usePrompts()`.
- Produces route `/admin/prompts` and links each card to `/admin/prompts/:type`.

- [ ] **Step 1: Add the route before writing the page**

```tsx
import PromptsPage from "./prompts/PromptsPage";

<Route path="/admin/prompts" component={PromptsPage} />
```

Add a `Prompts` Management menu item using `MessageSquareCode` from Lucide, immediately after `AI Models`.

- [ ] **Step 2: Implement the responsive list page**

```tsx
<AdminPageHeader
  title="Prompts"
  description="AI 프롬프트를 버전별로 검토하고 운영 버전을 관리합니다."
/>
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
  {promptTypes.map((type) => (
    <Card key={type.key} className="transition-shadow hover:shadow-md">
      {/* type, prompt name, version, updated time/by, and Active or Draft badge */}
    </Card>
  ))}
</div>
```

Use local default metadata only for empty types; do not insert seed records while viewing the page. Show an error alert when the repository fails to load.

- [ ] **Step 3: Verify routing and type-checking**

Run: `pnpm check`

Expected: no new errors from `PromptsPage`, `AdminSidebar`, or `AdminRoot`. Record any pre-existing failures separately.

- [ ] **Step 4: Commit the list page and navigation**

```bash
git add client/src/pages/admin/prompts/PromptsPage.tsx client/src/components/admin/layout/AdminSidebar.tsx client/src/pages/admin/AdminRoot.tsx
git commit -m "feat: add admin prompts list"
```

### Task 4: Prompt editor, history, and activation controls

**Files:**
- Create: `client/src/pages/admin/prompts/PromptDetailPage.tsx`
- Modify: `client/src/pages/admin/AdminRoot.tsx`

**Interfaces:**
- Consumes `usePrompts()`, `PromptType`, `PromptTemplateRecord`.
- Produces route `/admin/prompts/:type` and editor actions `Save Draft`, `Activate`, and `Rollback`.

- [ ] **Step 1: Add the detail route before the collection route**

```tsx
<Route path="/admin/prompts/:type" component={PromptDetailPage} />
<Route path="/admin/prompts" component={PromptsPage} />
```

- [ ] **Step 2: Implement the editor and version history**

```tsx
<div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.85fr)]">
  <Card>{/* Name, System Prompt textarea, User Prompt textarea, Temperature, Max Tokens, Notes */}</Card>
  <Card>{/* Version History with Active badge, Activate and Rollback buttons */}</Card>
</div>
```

Use the existing `Textarea`, `Input`, `Label`, `Button`, `Badge`, `Card`, and `Alert` components. The prompt textareas need monospaced text, a minimum 240px height, and labels that describe available interpolation such as `{{resume}}`.

Save Draft disables itself during the insert. Activate only appears on inactive historical versions. Rollback pre-fills the editor with the historical contents and shows a notice that saving creates a new Draft; it must not automatically activate the copied version.

- [ ] **Step 3: Verify the draft and activation behavior locally**

Run: `pnpm check`

Expected: no new TypeScript errors from the detail page.

Manual checks: save a Draft, verify a new version appears as Draft; activate it, verify the earlier same-type active badge clears; select Rollback, save the populated contents, and verify it creates another Draft.

- [ ] **Step 4: Commit the editor and history**

```bash
git add client/src/pages/admin/prompts/PromptDetailPage.tsx client/src/pages/admin/AdminRoot.tsx
git commit -m "feat: add prompt editor and version history"
```

### Task 5: No-cost mock playground and final verification

**Files:**
- Modify: `client/src/pages/admin/prompts/PromptDetailPage.tsx`
- Modify: `client/src/lib/admin-prompts.test.ts`

**Interfaces:**
- Consumes `createMockPromptRun(resume, promptName)`.
- Produces a playground showing resume input, mock response, response time, token usage, and estimated cost.

- [ ] **Step 1: Add a deterministic mock-run test for blank input**

```ts
it("creates a usable mock run even for blank playground input", () => {
  const result = createMockPromptRun("", "Feedback");
  expect(result.response).toContain("Feedback");
  expect(result.totalTokens).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run it to verify the new test fails if required**

Run: `pnpm exec vitest run client/src/lib/admin-prompts.test.ts`

Expected: FAIL only if blank input is not handled; otherwise retain the existing implementation and record that behavior was already covered.

- [ ] **Step 3: Render the playground with no fetch call**

```tsx
<Card className="h-fit xl:sticky xl:top-6">
  <CardHeader><CardTitle>Playground</CardTitle></CardHeader>
  <CardContent>{/* resume textarea, Run Test button, response, usage metrics */}</CardContent>
</Card>
```

`Run Test` calls only `createMockPromptRun`. Show `Mock response - no provider API call` adjacent to the button and an empty state before the first run.

- [ ] **Step 4: Run final focused verification**

Run: `pnpm exec vitest run client/src/lib/admin-prompts.test.ts && pnpm check`

Expected: prompt helper tests pass; report existing unrelated TypeScript failures precisely if they remain.

- [ ] **Step 5: Manually verify the admin screens**

Run: `pnpm exec vite --host 127.0.0.1`

Open `/admin/prompts`, then open each detail route. Confirm the layout is responsive, the five types appear, the prompt editor uses textareas, the history actions render, and Run Test displays only mock values with no network request to a model provider.

- [ ] **Step 6: Commit the playground and verification work**

```bash
git add client/src/pages/admin/prompts/PromptDetailPage.tsx client/src/lib/admin-prompts.test.ts
git commit -m "feat: add prompt playground"
```
