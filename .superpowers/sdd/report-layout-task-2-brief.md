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

