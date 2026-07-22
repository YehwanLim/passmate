# 지원 직무 카테고리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 분석 화면에서 지원 직무 프리셋을 카테고리별로 폭넓게 제공한다.

**Architecture:** `Analyze.tsx`의 평면 직무 배열을 이름과 역할 배열을 가진 읽기 전용 카테고리 데이터로 교체한다. 선택 상태와 제출 값은 계속 단일 문자열이므로 API·저장소·리포트의 인터페이스는 바꾸지 않는다.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tailwind CSS

## Global Constraints

- 기존 둥근 버튼, 단일 선택/해제, `+ 직접 입력` 동작은 유지한다.
- `서비스 PM` 프리셋은 `서비스 기획`으로 교체한다.
- 모든 카테고리는 접지 않고 기본으로 표시한다.
- `+ 직접 입력`은 직무 목록 전체의 마지막에 한 번만 표시한다.
- API 요청에 전달되는 `jobKeyword`는 선택된 직무 문자열 그대로 유지한다.

---

### Task 1: 카테고리 프리셋 데이터와 회귀 테스트 추가

**Files:**
- Create: `client/src/pages/Analyze.jobRoles.test.ts`
- Modify: `client/src/pages/Analyze.tsx:108-117`

**Interfaces:**
- Produces: `export const JOB_ROLE_CATEGORIES: readonly { readonly name: string; readonly roles: readonly string[] }[]`
- Consumes: `JobRoleSelector`가 순회할 카테고리 데이터

- [ ] **Step 1: 실패하는 프리셋 데이터 테스트를 작성한다.**

```ts
import { describe, expect, it } from "vitest";
import { JOB_ROLE_CATEGORIES } from "./Analyze";

describe("JOB_ROLE_CATEGORIES", () => {
  it("groups the requested default roles and replaces service PM", () => {
    const roles = JOB_ROLE_CATEGORIES.flatMap((category) => category.roles);

    expect(JOB_ROLE_CATEGORIES.map((category) => category.name)).toEqual([
      "기획·PM",
      "마케팅·브랜딩",
      "경영·사업",
      "재무·회계",
      "구매·SCM",
      "인사·총무",
      "영업·고객",
      "데이터·IT",
      "디자인·콘텐츠",
    ]);
    expect(roles).toEqual(expect.arrayContaining([
      "서비스 기획",
      "제품/상품 기획",
      "브랜드 마케팅",
      "경영전략",
      "재무",
      "구매",
    ]));
    expect(roles).not.toContain("서비스 PM");
    expect(new Set(roles).size).toBe(roles.length);
  });
});
```

- [ ] **Step 2: 테스트가 기대한 이유로 실패하는지 확인한다.**

Run: `pnpm exec vitest run client/src/pages/Analyze.jobRoles.test.ts`

Expected: FAIL because `Analyze.tsx` does not export `JOB_ROLE_CATEGORIES`.

- [ ] **Step 3: 카테고리 프리셋 데이터를 최소 구현한다.**

```ts
export const JOB_ROLE_CATEGORIES = [
  { name: "기획·PM", roles: ["서비스 기획", "제품/상품 기획", "사업 기획", "UX 기획", "프로젝트 매니저"] },
  { name: "마케팅·브랜딩", roles: ["브랜드 마케팅", "디지털 마케팅", "퍼포먼스 마케팅", "콘텐츠 마케팅", "CRM 마케팅"] },
  { name: "경영·사업", roles: ["경영전략", "사업전략", "신사업", "사업개발", "해외사업"] },
  { name: "재무·회계", roles: ["재무", "회계", "세무", "IR", "자금", "FP&A"] },
  { name: "구매·SCM", roles: ["구매", "전략구매", "SCM", "물류", "생산관리"] },
  { name: "인사·총무", roles: ["인사(HR)", "채용", "조직문화", "교육", "총무"] },
  { name: "영업·고객", roles: ["국내영업", "해외영업", "B2B 영업", "고객관리", "고객지원(CS)"] },
  { name: "데이터·IT", roles: ["데이터 분석", "데이터 사이언스", "프론트엔드 개발", "백엔드 개발", "AI/ML 엔지니어"] },
  { name: "디자인·콘텐츠", roles: ["UX/UI 디자인", "프로덕트 디자인", "그래픽 디자인", "콘텐츠 기획", "영상 콘텐츠"] },
] as const;
```

Replace the existing `JOB_ROLE_PRESETS` declaration with this export.

- [ ] **Step 4: 프리셋 테스트가 통과하는지 확인한다.**

Run: `pnpm exec vitest run client/src/pages/Analyze.jobRoles.test.ts`

Expected: PASS with one passing test.

- [ ] **Step 5: 이 작업만 커밋한다.**

```bash
git add client/src/pages/Analyze.tsx client/src/pages/Analyze.jobRoles.test.ts
git commit -m "feat: add categorized job role presets"
```

### Task 2: 카테고리별 선택 버튼을 렌더링

**Files:**
- Modify: `client/src/pages/Analyze.tsx:258-281`
- Test: `client/src/pages/Analyze.jobRoles.test.ts`

**Interfaces:**
- Consumes: `JOB_ROLE_CATEGORIES` from Task 1
- Produces: 카테고리 제목과 해당 직무 버튼을 렌더링하는 `JobRoleSelector`

- [ ] **Step 1: 렌더링 구조를 검사하는 실패 테스트를 추가한다.**

Append the following test to `client/src/pages/Analyze.jobRoles.test.ts`:

```ts
import { readFileSync } from "node:fs";

it("renders every category before the shared custom input control", () => {
  const source = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");

  expect(source).toContain("JOB_ROLE_CATEGORIES.map((category) => (");
  expect(source).toContain("{category.name}");
  expect(source).toContain("category.roles.map((role) => {");
  expect(source.indexOf("JOB_ROLE_CATEGORIES.map((category) => (")).toBeLessThan(
    source.indexOf("{/* 직접 입력 태그 */}")
  );
});
```

- [ ] **Step 2: 테스트가 기대한 이유로 실패하는지 확인한다.**

Run: `pnpm exec vitest run client/src/pages/Analyze.jobRoles.test.ts`

Expected: FAIL because `JobRoleSelector` still maps `JOB_ROLE_PRESETS`.

- [ ] **Step 3: 카테고리 제목과 직무 버튼 렌더링을 구현한다.**

Replace the existing flat `JOB_ROLE_PRESETS.map(...)` block with:

```tsx
{JOB_ROLE_CATEGORIES.map((category) => (
  <div key={category.name} className="w-full space-y-2">
    <p className="text-xs font-medium text-zinc-500">{category.name}</p>
    <div className="flex flex-wrap items-center gap-2">
      {category.roles.map((role) => {
        const isActive = selected === role;
        return (
          <button
            key={role}
            type="button"
            onClick={() => onSelect(isActive ? null : role)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
              isActive
                ? "bg-gradient-to-r from-blue-500/20 to-cyan-400/20 border-blue-400/40 text-cyan-300 shadow-sm shadow-blue-500/10"
                : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-zinc-200"
            }`}
          >
            {role}
          </button>
        );
      })}
    </div>
  </div>
))}
```

Change the outer selector container from `flex flex-wrap items-center gap-2` to `space-y-5` so each category forms a separate full-width section. Keep the existing custom-input block after the mapping.

- [ ] **Step 4: 렌더링 구조와 프리셋 데이터 테스트가 통과하는지 확인한다.**

Run: `pnpm exec vitest run client/src/pages/Analyze.jobRoles.test.ts`

Expected: PASS with two passing tests.

- [ ] **Step 5: 전체 타입 검사와 프로덕션 빌드를 검증한다.**

Run: `pnpm check && pnpm build`

Expected: both commands exit with status 0.

- [ ] **Step 6: 이 작업만 커밋한다.**

```bash
git add client/src/pages/Analyze.tsx client/src/pages/Analyze.jobRoles.test.ts
git commit -m "feat: group job role presets by category"
```
