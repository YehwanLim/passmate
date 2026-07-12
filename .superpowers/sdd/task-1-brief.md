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

