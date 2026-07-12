# Task 2 Report: Prompt repository with draft, activate, and rollback operations

## Scope

- Task brief read from `.superpowers/sdd/task-2-brief.md`
- Kept implementation scoped to:
  - `client/src/lib/admin-prompts.ts`
  - `client/src/lib/admin-prompts.test.ts`
  - `client/src/hooks/admin/usePrompts.ts`
- Did not edit unrelated UI, schema, route, or server files.

## RED

### Command

```bash
pnpm exec vitest run client/src/lib/admin-prompts.test.ts
```

### Result summary

- `vitest` ran successfully in the `client` workspace.
- The suite failed in the new Task 2 cases because the requested builders were not exported yet.
- Failure matched the brief's expected red state:
  - `buildDraftRecord is not a function`
  - `buildActivationUpdates is not a function`
- Existing Task 1 tests still passed during the red cycle.

## GREEN

### Commands

```bash
pnpm exec vitest run client/src/lib/admin-prompts.test.ts
pnpm exec tsc --noEmit --pretty false
```

### Result summary

- Focused prompt-helper suite passed.
  - `1` test file passed
  - `6` tests passed
- Non-blocking note: Vitest emitted a Node deprecation warning for `module.register()` before the run; tests still passed.
- Project-wide TypeScript check still fails, but only in pre-existing unrelated files:
  - `client/src/components/FeedbackSection.tsx`
  - `client/src/components/ProcessSection.tsx`
  - `client/src/pages/Analyze.tsx`
  - `client/src/pages/ReportResult.tsx`
- The TypeScript output did not report errors in:
  - `client/src/lib/admin-prompts.ts`
  - `client/src/lib/admin-prompts.test.ts`
  - `client/src/hooks/admin/usePrompts.ts`

## Files changed

### Created

- `client/src/hooks/admin/usePrompts.ts`

### Modified

- `client/src/lib/admin-prompts.ts`
- `client/src/lib/admin-prompts.test.ts`

## Implementation summary

- Added `buildDraftRecord` and `buildActivationUpdates` to `client/src/lib/admin-prompts.ts`.
- Added Task 2 Vitest coverage for the new pure payload builders in `client/src/lib/admin-prompts.test.ts`.
- Created `usePrompts()` in `client/src/hooks/admin/usePrompts.ts` with:
  - `loadPrompts`
  - `saveDraft`
  - `activateVersion`
  - `createRollbackDraft`
- Kept prompt reads and writes on the existing authenticated client-side Supabase singleton.
- Mapped `prompt_templates` snake_case rows into the existing `PromptTemplateRecord` camelCase shape from Task 1.
- Made `saveDraft` always insert a new inactive record with the next version for the selected prompt type.
- Made `activateVersion` deactivate only rows with the selected `prompt_type` before activating the selected `id`.
- Made `createRollbackDraft` reuse the same `saveDraft` insertion path rather than mutating a historical record.
- Added a guard so rollback fails loudly if a selected historical record is missing `promptType`, instead of silently drafting under the wrong type.

## Self-review

- Confirmed the pure builder behavior matches the brief:
  - next version derived from `nextPromptVersion`
  - draft records are always inactive
  - activation payload scopes the deactivate step by prompt type
- Confirmed the hook leaves the schema untouched and uses direct Supabase client patterns already established in admin hooks/pages.
- Confirmed `loadPrompts` orders results by `created_at` descending and can optionally scope to a single prompt type.
- Confirmed `saveDraft` reads the signed-in Supabase user and writes `updated_by`.
- Confirmed first-draft saves fail clearly when `modelName` and `modelProvider` are unavailable, instead of attempting an invalid insert into required DB columns.

## Test results

- Passed: `pnpm exec vitest run client/src/lib/admin-prompts.test.ts`
- Attempted but blocked by unrelated existing errors: `pnpm exec tsc --noEmit --pretty false`
- Not run:
  - live Supabase integration test
  - broader UI/manual admin prompt flow verification

## Concerns

- `activateVersion` follows the requested direct two-step Supabase update pattern. Because this runs client-side without a transaction or RPC, activation is not fully atomic. If the deactivate call succeeds and the activate call fails, restoring the prior active version would require a server-side transactional path that is outside Task 2 scope.
- The repo does not expose generated Supabase database types for `prompt_templates`, so `usePrompts.ts` uses local row interfaces plus explicit mapping. That keeps this task unblocked, but future schema drift would not be caught automatically at compile time in this hook.

## NEEDS_CONTEXT

- None blocking Task 2 implementation in the owned files.
- For awareness only:
  - project-wide TypeScript currently fails in unrelated files listed above
  - `prompt_templates` does not appear to have generated client DB typings in this repo, so the hook relies on local row typing instead

## Commit handling

- No commit was created in this pass.
