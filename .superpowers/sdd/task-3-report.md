# Task 3 Report

## Scope

Implemented Task 3 only within the requested owned files:

- `client/src/pages/admin/prompts/PromptsPage.tsx`
- `client/src/components/admin/layout/AdminSidebar.tsx`
- `client/src/pages/admin/AdminRoot.tsx`

No unrelated files were edited for the feature work itself, and no prompt rows are seeded or inserted from the list page.

## What Changed

### 1. Added admin prompts list route

- Registered `/admin/prompts` in `client/src/pages/admin/AdminRoot.tsx`.
- Kept the existing user changes for `AI Models` intact and layered the new route beside them.

### 2. Added Prompts sidebar navigation item

- Added a `Prompts` menu item with `MessageSquareCode`.
- Placed it immediately after `AI Models` in `client/src/components/admin/layout/AdminSidebar.tsx`, matching the task brief.

### 3. Implemented `PromptsPage`

`client/src/pages/admin/prompts/PromptsPage.tsx` now:

- Uses the Task 2 public hook API via `usePrompts().loadPrompts()`
- Fetches prompt records on mount
- Renders exactly the five canonical prompt types from `PROMPT_TYPES`
- Groups database records by prompt type without mutating data
- Prefers the active record for each type, falling back to the latest record if no active record exists
- Uses local fallback metadata only when a prompt type has no records
- Shows error state with destructive `Alert`
- Shows loading skeletons while fetching
- Links each card to `/admin/prompts/:type`

## Non-Seeding Guarantee

The list page does not call:

- `saveDraft`
- `activateVersion`
- `createRollbackDraft`

It only calls `loadPrompts()`, so visiting `/admin/prompts` does not create or insert rows.

## Verification

### Focused checks that passed

1. Formatting check for owned files:

```bash
pnpm exec prettier --check 'client/src/pages/admin/prompts/PromptsPage.tsx' 'client/src/components/admin/layout/AdminSidebar.tsx' 'client/src/pages/admin/AdminRoot.tsx'
```

Result: pass

2. Diff whitespace check for owned files:

```bash
git diff --check -- 'client/src/pages/admin/prompts/PromptsPage.tsx' 'client/src/components/admin/layout/AdminSidebar.tsx' 'client/src/pages/admin/AdminRoot.tsx'
```

Result: pass

3. Owned-file error scan during TypeScript check:

```bash
pnpm exec tsc --noEmit --pretty false 2>&1 | rg "PromptsPage|AdminSidebar|AdminRoot"
```

Result: no matches

### Project-wide check run per brief

```bash
pnpm check
```

Result: fails, but only from pre-existing unrelated TypeScript errors outside Task 3 ownership:

- `client/src/components/FeedbackSection.tsx(216,46)`
- `client/src/components/ProcessSection.tsx(95,15)`
- `client/src/pages/Analyze.tsx(642,53)`
- `client/src/pages/Analyze.tsx(653,13)`
- `client/src/pages/Analyze.tsx(691,23)`
- `client/src/pages/Analyze.tsx(718,23)`
- `client/src/pages/ReportResult.tsx(128,38)`

No errors were reported for:

- `client/src/pages/admin/prompts/PromptsPage.tsx`
- `client/src/components/admin/layout/AdminSidebar.tsx`
- `client/src/pages/admin/AdminRoot.tsx`

## Concerns / Follow-Up Notes

1. The list page links to `/admin/prompts/:type` as required by the brief, but that detail route/page does not exist in the current owned scope. Until the follow-up task adds that page, card clicks may land on the admin `NotFound` page.
2. Full project type-check remains red because of unrelated existing TypeScript issues elsewhere in the repository.

## Commit Guidance

If committing this task, stage only:

```bash
client/src/pages/admin/prompts/PromptsPage.tsx
client/src/components/admin/layout/AdminSidebar.tsx
client/src/pages/admin/AdminRoot.tsx
```

Recommended commit message:

```bash
feat: add admin prompts list
```
