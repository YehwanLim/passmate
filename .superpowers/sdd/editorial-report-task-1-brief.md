### Task 1: 해석형 프롬프트 계약을 테스트로 고정

**Files:**
- Modify: `client/src/pages/reportPrompt.singleSource.test.ts`
- Test: `client/src/pages/reportPrompt.singleSource.test.ts`

**Interfaces:**
- Consumes: `shared/prompts/reportPrompt.js`의 `MASTER_SYSTEM_PROMPT` 문자열
- Produces: 해석 중심 기준과 JSON 계약 보존을 검증하는 Vitest 테스트

- [ ] **Step 1: 실패하는 테스트 작성**

기존 `describe` 블록에 아래 테스트를 추가한다.

```ts
it("keeps editorial interpretation rules in the canonical prompt", () => {
  expect(sharedPrompt).toContain("반복해서 보여주는 하나의 관통 패턴");
  expect(sharedPrompt).toContain("도메인 + 행동 + 특징");
  expect(sharedPrompt).toContain("산업, 프로젝트, 직무, 기술");
  expect(sharedPrompt).toContain("인정 → 왜 좋은지 → 무엇이 조금 부족한지 → 어떻게 보완하면 더 좋아지는지");
  expect(sharedPrompt).toContain("서로 다른 관점");
  expect(sharedPrompt).toContain("feedbackCards의 original 필드");
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm exec vitest run client/src/pages/reportPrompt.singleSource.test.ts`

Expected: 새 테스트가 해석형 문구를 찾지 못해 실패한다.

- [ ] **Step 3: 최소 프롬프트 구현 작성**

`shared/prompts/reportPrompt.js`의 핵심 원칙, 톤, 섹션별 제약 조건을 아래 기준으로 보강한다.

```text
- 지원자의 경험 전체를 먼저 읽고 반복해서 보여주는 하나의 관통 패턴을 찾는다.
- summaryOneLiner와 persona는 "도메인 + 행동 + 특징"으로 작성한다.
- 해시태그는 산업, 프로젝트, 직무, 기술을 우선한다.
- feedbackCards는 인정 → 왜 좋은지 → 무엇이 조금 부족한지 → 어떻게 보완하면 더 좋아지는지 순서로 작성한다.
- detailedAnalysis는 서로 다른 관점 세 가지 이상을 포함한다.
```

기존 JSON 예시의 키, 배열 구조, 문자열 제약은 수정하지 않는다.

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `pnpm exec vitest run client/src/pages/reportPrompt.singleSource.test.ts`

Expected: 모든 테스트 PASS.

- [ ] **Step 5: 관련 회귀 테스트 실행**

Run: `pnpm exec vitest run client/src/pages/reportPrompt.singleSource.test.ts client/src/pages/MyProjects.persistence.test.ts client/src/pages/ReportResult.identity.test.ts`

Expected: 모든 테스트 PASS.

- [ ] **Step 6: 커밋**

```bash
git add shared/prompts/reportPrompt.js client/src/pages/reportPrompt.singleSource.test.ts docs/superpowers/plans/2026-07-20-editorial-report-prompt.md
git commit -m "feat: make report prompt editorial"
```
