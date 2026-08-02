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
