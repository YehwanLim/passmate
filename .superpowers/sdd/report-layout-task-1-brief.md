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

