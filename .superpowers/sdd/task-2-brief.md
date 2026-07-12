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

