# 지원 직무 아코디언 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지원 직무 카테고리를 모두 접힌 다중 확장 아코디언으로 표시한다.

**Architecture:** `JobRoleSelector`는 기존 `JOB_ROLE_CATEGORIES` 데이터를 그대로 사용하고, 각 카테고리를 Radix 기반 아코디언 항목으로 렌더링한다. 직무 선택값과 직접 입력은 기존 문자열 상태를 유지해 이전 지원서 복원과 분석 요청의 인터페이스를 바꾸지 않는다.

**Tech Stack:** React 19, TypeScript, Radix Accordion, Vitest, Tailwind CSS

## Global Constraints

- 9개 카테고리는 처음에 모두 접혀 있어야 한다.
- 여러 카테고리를 동시에 펼칠 수 있어야 한다.
- 직무 선택·해제 후에도 펼친 카테고리 상태를 유지한다.
- `+ 직접 입력`은 아코디언 밖, 전체 목록 아래에 한 번만 표시한다.
- 직무 선택값, 직접 입력, 이전 지원서 복원, 분석 API 요청은 변경하지 않는다.
- 모달·검색·필터는 추가하지 않는다.

---

### Task 1: 접힌 다중 확장 아코디언 렌더링과 회귀 테스트

**Files:**
- Modify: `client/src/pages/Analyze.tsx:1-25, 330-405`
- Modify: `client/src/pages/Analyze.jobRoles.test.ts:1-45`

**Interfaces:**
- Consumes: `JOB_ROLE_CATEGORIES: readonly { name: string; roles: readonly string[] }[]`
- Consumes: `Accordion`, `AccordionContent`, `AccordionItem`, `AccordionTrigger` from `@/components/ui/accordion`
- Produces: `JobRoleSelector` with a multi-open, initially collapsed category list

- [ ] **Step 1: 아코디언 구조를 요구하는 실패 테스트를 작성한다.**

```ts
it("keeps all categories collapsed initially while allowing multiple categories to expand", () => {
  const source = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");

  expect(source).toContain('from "@/components/ui/accordion"');
  expect(source).toContain('<Accordion type="multiple"');
  expect(source).toContain("<AccordionItem");
  expect(source).toContain("value={category.name}");
  expect(source).toContain("<AccordionTrigger");
  expect(source).toContain("<AccordionContent>");
  expect(source.indexOf("{/* 직접 입력 태그 */}")).toBeGreaterThan(
    source.indexOf("<Accordion type=\"multiple\"")
  );
});
```

- [ ] **Step 2: 테스트가 기대한 이유로 실패하는지 확인한다.**

Run: `pnpm exec vitest run client/src/pages/Analyze.jobRoles.test.ts`

Expected: FAIL because `JobRoleSelector` still renders category `<div>` elements rather than an `Accordion`.

- [ ] **Step 3: 아코디언 컴포넌트를 가져온다.**

```ts
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
```

Add the import alongside the existing component imports in `client/src/pages/Analyze.tsx`.

- [ ] **Step 4: 카테고리 목록을 다중 확장 아코디언으로 바꾼다.**

Replace the category mapping inside `JobRoleSelector` with the following JSX. Do not pass `defaultValue`, so all categories are collapsed on first render.

```tsx
<Accordion type="multiple" className="space-y-2">
  {JOB_ROLE_CATEGORIES.map((category) => (
    <AccordionItem key={category.name} value={category.name} className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4">
      <AccordionTrigger className="py-3 text-zinc-300 hover:no-underline">
        {category.name}
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {category.roles.map((role) => {
            const isActive = selected === role;
            return (
              <button key={role} type="button" onClick={() => onSelect(isActive ? null : role)}>
                {role}
              </button>
            );
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

Keep the existing role-button class string and the existing `+ 직접 입력` block after this `Accordion`.

- [ ] **Step 5: 직무·이전 지원서 테스트가 통과하는지 확인한다.**

Run: `pnpm exec vitest run client/src/pages/Analyze.jobRoles.test.ts client/src/pages/Analyze.previousResume.test.ts`

Expected: PASS with both test files passing.

- [ ] **Step 6: 프로덕션 빌드를 검증한다.**

Run: `pnpm build`

Expected: command exits with status 0.

- [ ] **Step 7: 현재 작업 폴더의 변경 범위를 확인한다.**

Run: `git diff --check -- client/src/pages/Analyze.tsx client/src/pages/Analyze.jobRoles.test.ts && git status --short -- client/src/pages/Analyze.tsx client/src/pages/Analyze.jobRoles.test.ts`

Expected: whitespace errors are absent, and only the user-owned current working tree contains the uncommitted implementation changes. Do not stage or commit because this working tree already has unrelated user changes.
