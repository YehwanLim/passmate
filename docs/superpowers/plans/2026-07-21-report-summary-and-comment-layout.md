# 리포트 요약과 실무자 코멘트 가독성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상단 리포트 메시지를 짧게 고정하고, 실무자 코멘트를 세 개의 해석 블록과 절제된 키워드 강조로 읽기 쉽게 만든다.

**Architecture:** 공용 프롬프트는 기존 문자열 JSON 필드를 유지한 채 생성 길이와 문단 구조만 제한한다. `reportFirstImpression.ts`에 표시용 길이 제한, 코멘트 분할, 키워드 토큰화 도우미를 두고, `ReportResult.tsx`는 그 결과만 렌더링한다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, pnpm

## 전역 제약

- JSON 키, 자료형, 배열 개수 제약은 변경하지 않는다.
- `persona`는 공백 포함 28자 이내, `summaryOneLiner`는 공백 포함 42자 이내의 한 문장으로 생성한다.
- `pmComment`는 빈 줄로 구분된 정확히 세 문단이며, 각 문단은 1~2문장이다.
- 구형 리포트 데이터도 안전하게 표시한다.
- 키워드 강조는 코멘트 블록마다 최대 한 구절이며, 네온·형광·과도한 배경 효과를 사용하지 않는다.

---

### Task 1: 짧은 요약과 세 문단 코멘트 생성을 프롬프트 계약으로 고정

**Files:**
- Modify: `shared/prompts/reportPrompt.js`
- Modify: `client/src/pages/reportPrompt.singleSource.test.ts`
- Test: `client/src/pages/reportPrompt.singleSource.test.ts`

**Interfaces:**
- Consumes: `MASTER_SYSTEM_PROMPT` 문자열
- Produces: 길이 제한과 `pmComment` 세 문단 규칙을 포함한 단일 공용 프롬프트

- [ ] **Step 1: 실패하는 계약 테스트 작성**

`keeps editorial interpretation rules in the canonical prompt` 테스트에 아래 단언을 추가한다.

```ts
expect(sharedPrompt).toContain("공백 포함 28자 이내")
expect(sharedPrompt).toContain("공백 포함 42자 이내")
expect(sharedPrompt).toContain("정확히 세 문단")
expect(sharedPrompt).toContain("빈 줄(\\n\\n)")
expect(sharedPrompt).toContain("각 문단은 1~2문장")
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run client/src/pages/reportPrompt.singleSource.test.ts`

Expected: 새 문구를 찾지 못해 실패한다.

- [ ] **Step 3: 최소 프롬프트 구현**

`shared/prompts/reportPrompt.js`의 `firstImpression` 필드 설명과 `pmComment` 제약에 아래 의미를 추가한다.

```text
persona: 공백 포함 28자 이내의 한 문장
summaryOneLiner: 공백 포함 42자 이내의 한 문장
pmComment: 빈 줄(\n\n)로 구분한 정확히 세 문단, 각 문단 1~2문장
문단 순서: 읽힌 관통 인상 → 더 선명하게 만들 연결고리 → 면접에서 준비할 설명
```

- [ ] **Step 4: 집중 테스트 통과 확인**

Run: `pnpm exec vitest run client/src/pages/reportPrompt.singleSource.test.ts`

Expected: 모든 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add shared/prompts/reportPrompt.js client/src/pages/reportPrompt.singleSource.test.ts
git commit -m "feat: constrain report summary copy"
```

### Task 2: 코멘트 블록과 키워드 강조용 표시 도우미 추가

**Files:**
- Modify: `client/src/pages/reportFirstImpression.ts`
- Modify: `client/src/pages/reportFirstImpression.test.ts`
- Test: `client/src/pages/reportFirstImpression.test.ts`

**Interfaces:**
- Produces: `limitReportText(text: string, maxLength: number): string`
- Produces: `splitMentorComment(comment: string): Array<{ title: string; text: string }>`
- Produces: `tokenizeCommentKeywords(text: string, keywords: string[]): Array<{ text: string; highlighted: boolean }>`

- [ ] **Step 1: 실패하는 도우미 테스트 작성**

```ts
it("limits legacy summary copy without breaking a word", () => {
  expect(limitReportText("시장 데이터를 사업 기회로 연결하고 실행까지 이끄는 기획형 지원자입니다", 28))
    .toBe("시장 데이터를 사업 기회로 연결하고…")
})

it("splits paragraph and legacy comments into three editorial blocks", () => {
  expect(splitMentorComment("첫 인상입니다.\n\n보완점입니다.\n\n면접 준비입니다.").map((item) => item.title))
    .toEqual(["읽힌 인상", "더 선명해질 지점", "면접에서 준비할 것"])
  expect(splitMentorComment("첫 문장입니다. 둘째 문장입니다. 셋째 문장입니다.")).toHaveLength(3)
})

it("marks only matching editorial keywords for inline emphasis", () => {
  expect(tokenizeCommentKeywords("식량사업의 시장분석 경험이 보입니다.", ["식량사업", "시장분석"])
    .filter((token) => token.highlighted)
    .map((token) => token.text)).toEqual(["식량사업", "시장분석"])
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run client/src/pages/reportFirstImpression.test.ts`

Expected: 새 함수가 없어 실패한다.

- [ ] **Step 3: 최소 도우미 구현**

`reportFirstImpression.ts`에 다음 동작을 구현한다.

```ts
const MENTOR_COMMENT_TITLES = ["읽힌 인상", "더 선명해질 지점", "면접에서 준비할 것"]

export function limitReportText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) return normalized
  const shortened = normalized.slice(0, maxLength - 1)
  const boundary = shortened.lastIndexOf(" ")
  return `${(boundary > Math.floor(maxLength / 2) ? shortened.slice(0, boundary) : shortened).trimEnd()}…`
}
```

`splitMentorComment`는 빈 줄 문단을 우선 사용하고, 문단이 부족하면 마침표·물음표·느낌표 뒤 문장 단위로 균등하게 세 조각을 만든다. 빈 블록은 만들지 않고, 남는 문장은 마지막 블록에 합친다.

`tokenizeCommentKeywords`는 빈 문자열을 제외한 키워드를 긴 순서로 정렬해 정규식 이스케이프 후 분할한다. 각 키워드는 최대 한 번만 강조하고, 평문 토큰도 보존한다.

- [ ] **Step 4: 집중 테스트 통과 확인**

Run: `pnpm exec vitest run client/src/pages/reportFirstImpression.test.ts`

Expected: 모든 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add client/src/pages/reportFirstImpression.ts client/src/pages/reportFirstImpression.test.ts
git commit -m "feat: format editorial mentor comments"
```

### Task 3: 리포트 화면에 안전한 길이 제한, 코멘트 블록, 키워드 강조 적용

**Files:**
- Modify: `client/src/pages/ReportResult.tsx`
- Modify: `client/src/pages/ReportResult.identity.test.ts`
- Test: `client/src/pages/ReportResult.identity.test.ts`

**Interfaces:**
- Consumes: `limitReportText`, `splitMentorComment`, `tokenizeCommentKeywords`
- Produces: 상단 요약과 실무자 코멘트의 공통 표시 구조

- [ ] **Step 1: 실패하는 화면 계약 테스트 작성**

```ts
it("renders mentor comments as labeled editorial blocks with keyword emphasis", () => {
  expect(source).toContain('"읽힌 인상"')
  expect(source).toContain('"더 선명해질 지점"')
  expect(source).toContain('"면접에서 준비할 것"')
  expect(source).toContain("tokenizeCommentKeywords")
  expect(source).toContain("text-indigo-200")
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run client/src/pages/ReportResult.identity.test.ts`

Expected: 코멘트 블록과 강조 렌더링이 없어 실패한다.

- [ ] **Step 3: 최소 화면 구현**

`ReportResult.tsx`에 아래 계산 값을 추가한다.

```ts
const heroPersona = useMemo(
  () => limitReportText(compressPersonaForHero(reportData.firstImpression.persona), 28),
  [reportData.firstImpression.persona]
)
const heroSummary = useMemo(
  () => limitReportText(reportData.firstImpression.summaryOneLiner, 42),
  [reportData.firstImpression.summaryOneLiner]
)
const mentorCommentBlocks = useMemo(
  () => splitMentorComment(reportData.pmComment),
  [reportData.pmComment]
)
```

상단 보조 문장은 `heroSummary`를 사용한다. 상단의 짧은 코멘트와 ACT 6의 긴 코멘트는 `mentorCommentBlocks`를 공통 사용한다. 각 블록은 제목에 서로 다른 절제된 색(`text-indigo-200`, `text-amber-200`, `text-emerald-200`)을 사용하고, 본문 토큰 중 키워드는 `text-indigo-200 font-semibold`으로 한 번만 강조한다. 모바일에서는 한 열, `md` 이상에서는 세 열 또는 읽기 쉬운 세로 구성을 사용하며 본문이 넘치지 않게 한다.

- [ ] **Step 4: 화면 계약 테스트 통과 확인**

Run: `pnpm exec vitest run client/src/pages/ReportResult.identity.test.ts client/src/pages/reportFirstImpression.test.ts`

Expected: 모든 테스트 PASS.

- [ ] **Step 5: 전체 관련 회귀 테스트와 빌드 확인**

Run: `pnpm exec vitest run client/src/pages/reportPrompt.singleSource.test.ts client/src/pages/reportFirstImpression.test.ts client/src/pages/ReportResult.identity.test.ts client/src/pages/MyProjects.persistence.test.ts`

Expected: 모든 테스트 PASS.

Run: `pnpm run build`

Expected: exit code 0.

- [ ] **Step 6: 커밋**

```bash
git add client/src/pages/ReportResult.tsx client/src/pages/ReportResult.identity.test.ts
git commit -m "feat: improve report summary readability"
```
