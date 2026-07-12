# Task 1 Report: Prompt data model and version helpers

## Scope

- Task brief read from `.superpowers/sdd/task-1-brief.md`
- Kept implementation scoped to:
  - `client/src/lib/admin-prompts.ts`
  - `client/src/lib/admin-prompts.test.ts`
  - `prisma/migrations/20260711_add_admin_prompt_metadata/migration.sql`
  - `prisma/schema.prisma`
  - `prisma/schema.sql`
- Did not modify UI, routes, or repository hook files.

## RED

### Command

```bash
pnpm exec vitest run client/src/lib/admin-prompts.test.ts
```

### Result summary

- `vitest` started successfully in the `client` workspace.
- The suite failed before collecting tests because `client/src/lib/admin-prompts.ts` did not exist.
- Failure matched the brief's expected red state:
  - `Failed to load url ./admin-prompts`
  - `Does the file exist?`

## GREEN

### Command

```bash
pnpm exec vitest run client/src/lib/admin-prompts.test.ts
```

### Result summary

- Focused suite passed.
- `1` test file passed.
- `3` tests passed.
- Runtime was about `136-167ms` across the green verification runs.
- Non-blocking note: Vitest emitted a Node deprecation warning for `module.register()` before the run; tests still passed.
- Latest fresh verification was run at the end of the task before returning status and also passed with `3/3` tests.

## Files changed

### Created

- `client/src/lib/admin-prompts.ts`
- `client/src/lib/admin-prompts.test.ts`
- `prisma/migrations/20260711_add_admin_prompt_metadata/migration.sql`

### Modified

- `prisma/schema.prisma`
- `prisma/schema.sql`

## Implementation summary

- Added `PROMPT_TYPES`, `PromptType`, `PromptTemplateRecord`, `MockPromptRun`, `nextPromptVersion`, and `createMockPromptRun` in `client/src/lib/admin-prompts.ts`.
- Added the requested Vitest coverage in `client/src/lib/admin-prompts.test.ts`.
- Added `prompt_type`, `notes`, `updated_by`, and `updated_at` to prompt template DDL in both schema files.
- Added the new partial unique index on `(prompt_type, version)` and a supporting `prompt_type` index.
- Preserved the existing legacy unique constraint on `(version, variant)` as requested.

## Self-review

- Confirmed the helper follows the exact version-parsing behavior from the brief:
  - empty list returns `v1.0`
  - highest valid `v<major>.<minor>` entry drives the next minor increment
- Confirmed the mock run helper is provider-free and always returns positive `responseTimeMs`, `totalTokens`, and `estimatedCost`.
- Confirmed the schema changes stay limited to `PromptTemplate`.
- Adjusted `prisma/schema.prisma` self-review once to keep `promptType` as `String? @db.VarChar(50)` so it mirrors the SQL column shape instead of introducing a Prisma enum that would diverge from the migration.
- Carefully isolated the staged `prisma/schema.prisma` hunk because the file already contained unrelated local edits before this task.

## Test results

- Passed: `pnpm exec vitest run client/src/lib/admin-prompts.test.ts`
- Not run:
  - broader frontend test suites
  - Prisma validation/migration application against a live database

## Concerns

- `prisma/schema.prisma` had pre-existing unrelated worktree edits outside this task. I isolated the Task 1 hunk for staging, but the working tree still intentionally contains those unrelated changes.
- I did not run a broader Prisma validation command, so compatibility beyond the requested focused test remains unverified in this task.

## Commit handling

- Repository index writes required elevated permissions in this environment.
- After elevation, I staged only the Task 1 hunk for `prisma/schema.prisma` to avoid bundling unrelated changes from that dirty file.
- Commit succeeded: `ca157b4` (`feat: add prompt version data helpers`)

## Fix

### Command

```bash
pnpm exec vitest run client/src/lib/admin-prompts.test.ts
pnpm exec prisma validate --schema prisma/schema.prisma
```

### Result

- `vitest` passed for `client/src/lib/admin-prompts.test.ts`
  - `1` test file passed
  - `4` tests passed
- `prisma validate` passed for `prisma/schema.prisma`

### Self-review

- Enforced the supported prompt types at the Postgres persistence layer with a dedicated `prompt_template_type` enum limited to:
  - `resume-analysis`
  - `cover-letter`
  - `summary`
  - `feedback`
  - `interview-questions`
- Made the migration safe for existing Postgres databases by:
  - creating the enum only if it does not already exist
  - converting `prompt_type` to the enum only when needed
  - failing loudly if unsupported stored values exist instead of silently rewriting data
- Ensured `updated_at` stays current on future `UPDATE`s, including `is_active` flips, by installing a `BEFORE UPDATE` trigger on `prompt_templates`
- Mirrored the same behavior in Prisma by:
  - switching `PromptTemplate.promptType` to a Prisma enum mapped to the Postgres enum values
  - marking `PromptTemplate.updatedAt` with `@updatedAt`
- Kept test changes focused on pure helper behavior only by asserting the exported supported type list, without introducing DB-mocking tests
