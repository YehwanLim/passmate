# Premium Entitlements Task 1 Report

## Scope

Implemented the entitlement schema and transaction domain layer described in `.superpowers/sdd/premium-entitlements-task-1-brief.md`.

Changed task files:

- `prisma/schema.prisma`
- `prisma/migrations/20260721_add_analysis_entitlements/migration.sql`
- `lib/analysis-entitlements.js`
- `lib/analysis-entitlements.test.js`

Generated (not committed): Prisma Client in `node_modules` via `pnpm exec prisma generate`.

## TDD Record

1. Added `lib/analysis-entitlements.test.js` before the domain module existed.
2. Ran the literal brief command:

   ```text
   pnpm exec vitest run lib/analysis-entitlements.test.js
   exit 1
   No test files found, exiting with code 1
   ```

   The repository's `vite.config.ts` sets `client/` as Vite's root, so this command never discovers a root-level `lib/` test.
3. Ran the same test with the root override required by that existing configuration:

   ```text
   pnpm exec vitest --root . run lib/analysis-entitlements.test.js
   exit 1
   Failed to load url ./analysis-entitlements.js ... Does the file exist?
   ```

   This was the intended red failure: the new entitlement module did not exist.
4. After implementing the module, the first green run surfaced a test-adapter defect:

   ```text
   pnpm exec vitest --root . run lib/analysis-entitlements.test.js
   exit 1
   3 tests | 1 failed
   expected premiumRemaining: 3; received premiumRemaining: 0
   ```

   The in-memory Prisma-shaped adapter did not enforce `AnalysisEntitlement.userId` uniqueness, unlike the schema. The test adapter was corrected to return Prisma error code `P2002` for a duplicate entitlement row.
5. Final focused test run:

   ```text
   pnpm exec vitest --root . run lib/analysis-entitlements.test.js
   exit 0
   Test Files  1 passed (1)
   Tests  3 passed (3)
   ```

## Additional Verification

```text
pnpm exec prisma validate
exit 0
The schema at prisma/schema.prisma is valid
```

```text
pnpm exec prisma generate
exit 0
Generated Prisma Client (v7.8.0)
```

`git diff --check` for the modified schema and new domain module completed without output or errors.

## Decisions

- A new account receives one implicit free credit. `AnalysisEntitlement` stores only purchased credit grants; `AnalysisReservation` records all pending and consumed usage. This avoids redundant usage counters and lets availability include pending reservations directly.
- `reserveAnalysis` takes the free credit before premium credit. It locks the account entitlement row with `SELECT ... FOR UPDATE`, then counts `PENDING` and `CONSUMED` reservations for each source.
- Finalization and cancellation use `updateMany` constrained by reservation ID, user ID, and `PENDING` status. This makes repeated or cross-user calls harmless and keeps the public functions `Promise<void>`.
- Groble idempotency is enforced by the unique `PaymentEntitlement.providerPaymentId` index. A Prisma `P2002` collision returns `{ granted: false, credits: 0 }`; the successful payment insert and `premiumCreditsGranted` increment must be called inside the caller's Prisma transaction.
- The migration seeds the singleton settings record with Premium disabled, three credits per purchase, and `https://www.groble.im/payment/4SGBV5` through `INSERT ... ON CONFLICT DO NOTHING`.

## Concerns

- The brief's literal Vitest command remains non-discovering because of the pre-existing `client/` Vite root. The verified command is `pnpm exec vitest --root . run lib/analysis-entitlements.test.js`. Changing `vite.config.ts` would violate the task's file-scope restriction.
- No live PostgreSQL migration was applied because this task did not provide a database target. Prisma schema validation and client generation succeeded, but migration execution should be verified in the deployment database before release.

## Production Issue Follow-up

### Changes

- Replaced `AnalysisEntitlement.create()` plus `P2002` recovery with `AnalysisEntitlement.upsert()` before the existing `SELECT ... FOR UPDATE`. This preserves the entitlement row lock without issuing a uniqueness error that would abort a PostgreSQL transaction.
- Replaced `PaymentEntitlement.create()` plus `P2002` recovery with `INSERT INTO payment_entitlements ... ON CONFLICT (provider_payment_id) DO NOTHING RETURNING id`. A missing returned row now produces `{ granted: false, credits: 0 }`; a returned row is followed by the existing entitlement-credit increment in the same caller-owned transaction.
- Removed the `P2002`-throwing branches from the in-memory adapter. It now models `analysisEntitlement.upsert()` and the payment insert's returning-row result directly.
- Switched all test user IDs to UUID-shaped values. Added focused coverage for looking up an existing entitlement and for duplicate provider payments through the conflict-safe raw SQL path.

### TDD Record

The updated tests were run before the production code changed. They failed because the adapter intentionally no longer exposes the old throwing `create()` interface:

```text
(node:49512) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

 RUN  v2.1.9 /Users/yehwanlim/Desktop/practice2/Side Project/06. Job Seeker

 ❯ lib/analysis-entitlements.test.js (4 tests | 4 failed) 3ms
   × analysis entitlements > gives a new account one free analysis and then blocks a second reservation 2ms
     → tx.analysisEntitlement.create is not a function
   × analysis entitlements > grants exactly three credits once when Groble retries a paid event 0ms
     → tx.analysisEntitlement.create is not a function
   × analysis entitlements > returns an existing entitlement without a uniqueness exception 0ms
     → tx.analysisEntitlement.create is not a function
   × analysis entitlements > holds a pending credit until cancelling its reservation 0ms
     → tx.analysisEntitlement.create is not a function

 Test Files  1 failed (1)
      Tests  4 failed (4)
   Start at  23:24:16
   Duration  139ms (transform 9ms, setup 0ms, collect 8ms, tests 3ms, environment 0ms, prepare 24ms)
```

The first green attempt found and corrected a test-fixture binding error. Its exact output was:

```text
(node:52065) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

 RUN  v2.1.9 /Users/yehwanlim/Desktop/practice2/Side Project/06. Job Seeker

 ❯ lib/analysis-entitlements.test.js (4 tests | 1 failed) 4ms
   × analysis entitlements > grants exactly three credits once when Groble retries a paid event 2ms
     → state is not defined

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  lib/analysis-entitlements.test.js > analysis entitlements > grants exactly three credits once when Groble retries a paid event
ReferenceError: state is not defined
 ❯ lib/analysis-entitlements.test.js:145:12
    143|       premiumRemaining: 3,
    144|     });
    145|     expect(state.paymentInsertAttempts).toEqual(["pay-1", "pay-1"]);
       |            ^
    146|   });
    147|

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
   Start at  23:24:32
   Duration  140ms (transform 10ms, setup 0ms, collect 8ms, tests 4ms, environment 0ms, prepare 23ms)
```

The final focused test output was:

```text
(node:54628) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

 RUN  v2.1.9 /Users/yehwanlim/Desktop/practice2/Side Project/06. Job Seeker

 ✓ lib/analysis-entitlements.test.js (4 tests) 3ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  23:24:42
   Duration  142ms (transform 10ms, setup 0ms, collect 7ms, tests 3ms, environment 0ms, prepare 25ms)
```

The schema validation output was:

```text
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
The schema at prisma/schema.prisma is valid 🚀
```

Final pre-commit verification repeated the focused suite successfully:

```text
(node:58683) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

 RUN  v2.1.9 /Users/yehwanlim/Desktop/practice2/Side Project/06. Job Seeker

 ✓ lib/analysis-entitlements.test.js (4 tests) 3ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  23:25:48
   Duration  143ms (transform 10ms, setup 0ms, collect 8ms, tests 3ms, environment 0ms, prepare 32ms)
```

### Database Test Limitation

No database-backed test was run. `prisma.config.ts` resolves its datasource from `DIRECT_URL` or `DATABASE_URL`; neither variable is set in the current shell, `.env`, or `.env.local`. The repository also has no separate test-database configuration. Running this transaction regression against an unknown development or production database would not be appropriate. The focused in-memory adapter instead models the exact non-throwing `upsert` and `ON CONFLICT ... DO NOTHING RETURNING` interfaces used by the domain module.
