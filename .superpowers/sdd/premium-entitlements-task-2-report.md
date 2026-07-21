# Premium Entitlements Task 2 Report

## Scope

Implemented the authenticated entitlement and administration APIs defined in
`premium-entitlements-task-2-brief.md`.

- `lib/auth.js` extracts a Bearer token and verifies it server-side with
  Supabase Auth using `auth.getUser(accessToken)`.
- `GET /api/entitlements` uses only the verified Supabase user ID, executes
  Task 1's `getEntitlementSummary` inside a Prisma transaction, and returns
  the configured Groble URL.
- `POST /api/entitlements/purchase-intents` creates a `PENDING` intent for the
  verified user before returning the checkout URL. Prisma's UUID default
  produces the unguessable intent ID; no credit is granted here.
- `GET|PATCH /api/admin/entitlements` requires a verified user whose local
  `users.role` is exactly `admin`. PATCH accepts exactly
  `{ premiumEnabled: boolean }`.
- Vite development middleware now forwards method, headers, parsed body, and
  entitlement subpath to these same handlers. Vitest uses the repository root
  only while `VITEST=true`, preserving the normal `client/` Vite root.

## Required Server Variables

Configure these server-only variables in each deployment environment:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` through a `VITE_` variable or client
bundle. The working environment had neither variable defined at verification
time, so a live successful-token check could not be performed locally.

## TDD Evidence

### Red

Command:

```sh
pnpm exec vitest run api/entitlements.test.js
```

Output before implementation:

```text
FAIL  api/entitlements.test.js [ api/entitlements.test.js ]
Error: Failed to load url ./entitlements.js ... Does the file exist?
Test Files  1 failed (1)
Tests  no tests
```

### Green

Command:

```sh
pnpm exec vitest run api/entitlements.test.js
```

Output after implementation:

```text
RUN  v2.1.9 /Users/yehwanlim/Desktop/practice2/Side Project/06. Job Seeker
✓ api/entitlements.test.js (5 tests) 2ms
Test Files  1 passed (1)
Tests  5 passed (5)
```

The five tests cover verified-token identity over `body.userId`, invalid-token
rejection, verified-user purchase intent ownership, non-admin rejection, and
the constrained admin PATCH update.

## Development Route Check

Started a temporary Vite server:

```sh
pnpm exec vite --host 127.0.0.1 --port 5174
```

Output:

```text
VITE v7.1.9 ready in 104 ms
Local: http://127.0.0.1:5174/
```

Called the development routes without a Bearer token:

```sh
curl -sS -i http://127.0.0.1:5174/api/entitlements
curl -sS -i -X POST http://127.0.0.1:5174/api/entitlements/purchase-intents
curl -sS -i http://127.0.0.1:5174/api/admin/entitlements
```

Each returned:

```text
HTTP/1.1 401 Unauthorized
Content-Type: application/json
{"error":"Unauthorized"}
```

This confirms all three Vite mounts reach the shared handlers and retain their
authentication boundary.

## Additional Verification

```sh
git diff --check
```

Exited successfully with no output.

```sh
pnpm exec tsc --noEmit --project tsconfig.node.json
```

Exited with status 2 due to three existing `TS18046` errors outside Task 2:

```text
server/api/analyze.ts(67,19): error TS18046: 'data' is of type 'unknown'.
server/api/analyze.ts(68,17): error TS18046: 'data' is of type 'unknown'.
vite.config.ts(439,24): error TS18046: 'data' is of type 'unknown'.
```

The Vite error is in the existing `/api/test-gemini` handler, not the Task 2
middleware. These files were intentionally left unchanged.
