# Passmate Agent Guide

Passmate is a job-preparation and resume-analysis web application. It has a React/Vite client, Vercel Serverless API routes, Supabase authentication and PostgreSQL accessed through Prisma.

Apply this guide whenever you write, review, debug, refactor, or explain code in this repository.

## Working approach

Be pragmatic and careful: understand first, change surgically, and verify narrowly. Optimize for clear reasoning, small diffs, local style, and observable progress—not cleverness or speculative architecture.

Before editing code:

- State the request as an explicit, testable outcome.
- State assumptions that materially affect the implementation.
- Name a meaningful trade-off when more than one reasonable approach exists.
- Ask one concise question only when guessing would create real risk. For obvious, low-risk work, state the assumption and proceed.

Documentation language:

- Write all new and updated design documents in Korean. Keep code identifiers,
  file paths, commands, and terms whose original spelling is clearer in their
  established form.

Implement only what the current request needs:

- Do not add unrequested features, dependencies, configuration, abstractions, or broad refactors.
- Do not reformat, rename, or reorganize adjacent code as a side effect.
- Preserve established patterns and clean up imports or helpers made unused by your own change.
- Report unrelated issues separately instead of fixing them opportunistically.

## Repository map

| Path | Responsibility |
| --- | --- |
| `client/src/` | React UI: pages, components, hooks, contexts, client utilities, and Wouter routes. |
| `client/src/pages/admin/` | Admin UI and routing. Client-side guards are not an authorization boundary. |
| `api/` | Vercel Serverless handlers written as ESM JavaScript. Nested and bracketed files map to API paths. |
| `lib/` | Shared server-side utilities, including authentication, Prisma access, and entitlement logic. |
| `prisma/` | Prisma schema and database configuration. |
| `tests/api/` | API-focused Vitest tests. Client tests are normally co-located as `*.test.ts` or `*.test.tsx`. |
| `scripts/` | Validation and manual development utilities. Read a script before relying on it. |
| `docs/superpowers/` | Historical and active design/implementation plans; use them as context, but change them only when requested. |

Use the configured aliases when they improve local consistency: `@/` for `client/src`, `@shared/` for `shared`, and `@assets/` for `attached_assets`.

## Tooling and commands

Use `pnpm`. The repository declares a pnpm package manager and has a `pnpm-lock.yaml`; do not use npm or change either lockfile unless the task changes dependencies.

| Purpose | Command | Notes |
| --- | --- | --- |
| Local development | `pnpm dev` | Vite serves the client on `127.0.0.1:5173`. |
| Type check | `pnpm check` | Run after TypeScript production-code changes when practical. |
| Targeted test | `pnpm exec vitest run path/to/test-file` | Prefer the smallest test set covering the change. |
| Full test suite | `pnpm exec vitest run` | Use for cross-cutting or higher-risk changes when local environment requirements are satisfied. |
| Production build | `pnpm build` | Its prebuild step requires `DATABASE_URL`; never invent credentials to make it run. |
| Regenerate Prisma client | `pnpm exec prisma generate` | Run after changing `prisma/schema.prisma`. |

`pnpm format` runs Prettier across the repository and is too broad for ordinary changes. If formatting is needed, run Prettier only on explicitly named files, for example `pnpm exec prettier --write client/src/pages/Home.tsx`.

## Frontend conventions

- Keep page orchestration in `client/src/pages/`; keep reusable presentation in `client/src/components/`; keep reusable state and behavior in hooks, contexts, or small utilities when there is more than one real caller.
- Preserve the established Wouter route structure in `client/src/App.tsx`. Changes to user access, report navigation, or admin navigation should include the relevant route and guard coverage.
- Use the existing Tailwind, Radix UI, and local UI component patterns. Do not introduce a competing styling or component library for a local change.
- Treat browser storage, Supabase session state, and client-side guards as convenience layers only. Enforce authorization and sensitive business rules in the API as well.

## API, AI, and payment conventions

- Keep Vercel handlers in `api/` as small, explicit request-method dispatchers with stable JSON responses and appropriate status codes.
- For a new or moved API route, verify both the deployed Vercel path and whether `vite.config.ts` needs a corresponding development middleware mapping. The local middleware intentionally maps selected routes; it does not discover every file automatically.
- Require authorization in the server handler for protected data or actions. Never rely only on an admin page or client-side role check.
- Do not make live AI-provider, Supabase, payment-provider, or webhook calls in tests. Test the request, validation, authorization, response, and error behavior locally instead.
- Treat entitlements, purchase intents, payment webhooks, prompt activation, AI usage, and analysis access as user-visible business rules. Preserve existing authorization, idempotency, and error semantics unless the task explicitly changes them.

## Data and secrets

- Reuse `lib/prisma.js`; do not create ad-hoc `PrismaClient` instances in API handlers.
- `DATABASE_URL` is used at runtime through the Prisma adapter. `DIRECT_URL` is reserved for migrations and direct schema operations as configured in `prisma.config.ts`.
- After a schema change, regenerate Prisma and run the targeted tests that exercise the affected model or API boundary.
- Do not run `prisma db push`, `prisma migrate deploy`, `prisma migrate reset`, or any destructive data operation unless the user explicitly requests it and identifies the target environment.
- Never put secrets in source, fixtures, screenshots, logs, or `VITE_*` variables. In particular, the Supabase service-role key is server-only; browser-visible values must use the public URL and anonymous key only.
- Keep `.env` files untracked. Update `.env.example` only when the requested configuration contract changes, and include placeholders rather than real values.

## Verification expectations

Define success before claiming completion:

- Bug fix: name the failing case and the expected behavior after the fix.
- Feature: name the user-visible behavior and the relevant authorization or data boundary.
- Refactor: name the behavior that must remain unchanged.
- Review: identify concrete risks, missing tests, and likely regressions.

Use the narrowest meaningful verification:

- UI or client utility changes: run the affected co-located Vitest test, and run `pnpm check` when TypeScript source changed.
- API changes: run the relevant test under `tests/api/` or its co-located API test; include authorization and error-path coverage when behavior changes.
- Prisma schema changes: run `pnpm exec prisma generate`, affected tests, and `pnpm check` when generated TypeScript consumers are in scope.
- Build, Vite configuration, routing, environment-contract, or cross-cutting changes: run `pnpm build` only when `DATABASE_URL` is available in the local environment. State plainly when it was not safe or possible to run.

Do not claim that a test, build, deployment, payment, or external integration succeeded without current command output or an explicit external result.

## Git and change safety

- Confirm the repository and current branch at the beginning of a coding task. Use the current branch unless the user asks otherwise.
- Inspect the working tree before staging. Preserve unrelated existing changes and stage only files tied to the current request.
- For work likely to yield several independently valuable, verified milestones, ask whether the user wants checkpoint commits pushed. Otherwise, do not create commits or pushes without a request or prior approval.
- Before each requested commit, summarize the included changes. Before each requested push, run relevant checks when practical.
- Do not force-push, rewrite history, change remotes or repository settings, alter branch protection, manage collaborators, or delete branches.

Deletion requires the same care as a production data change:

- Do not use mass or recursive deletion commands, wildcard cleanup deletes, or scripted deletion loops.
- Delete only when necessary, using one explicit literal path per command.
- If multiple files must be deleted or recursive cleanup seems necessary, ask first.

## Completion response

For non-trivial coding work, summarize with:

```text
Assumption:
Changed:
Verified:
Remaining risk:
```

Keep this concise, and omit ceremony for an obvious one-line edit.
