# 인사이트 리포트 120초 제한 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인사이트 리포트 생성 서버가 120초 동안 실행될 수 있도록 서버리스 최대 실행 시간을 클라이언트 제한과 일치시킨다.

**Architecture:** 클라이언트 요청 취소 제한은 이미 120초이므로 변경하지 않는다. Vercel 함수 엔트리포인트 `api/analyze.js`의 `maxDuration`만 120으로 올리고, 소스 기반 회귀 테스트로 이 배포 설정을 고정한다.

**Tech Stack:** Node.js, Vercel Serverless Functions, Vitest, TypeScript/Vite

## Global Constraints

- `api/analyze.js`의 서버리스 최대 실행 시간은 정확히 `120`초여야 한다.
- `client/src/pages/Analyze.tsx`의 기존 120초 취소 제한은 변경하지 않는다.
- 모델별 25초 호출 제한과 3초 폴백 재시도 정책은 변경하지 않는다.

---

### Task 1: 서버리스 실행 시간 제한 정렬

**Files:**
- Create: `tests/api/analyze-timeout.test.js`
- Modify: `api/analyze.js:376`
- Test: `tests/api/analyze-timeout.test.js`

**Interfaces:**
- Consumes: `api/analyze.js`가 Vercel 함수 설정으로 내보내는 `maxDuration` 상수
- Produces: 120초까지 실행 가능한 분석 API 함수와 이 설정을 고정하는 회귀 테스트

- [x] **Step 1: Write the failing test**

```js
import { describe, expect, it } from "vitest";
import { maxDuration } from "../../api/analyze.js";

describe("analysis API runtime", () => {
  it("allows the insight report to run for up to 120 seconds", () => {
    expect(maxDuration).toBe(120);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/analyze-timeout.test.js`

Expected: FAIL because `api/analyze.js` currently exports `maxDuration = 60`.

- [x] **Step 3: Write minimal implementation**

```js
export const maxDuration = 120;
```

Replace the existing `export const maxDuration = 60;` declaration in `api/analyze.js`. Do not change `MODEL_CALL_TIMEOUT_MS`, `FALLBACK_RETRY_DELAY_MS`, or the client abort timer.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/analyze-timeout.test.js`

Expected: PASS with one passing assertion.

- [x] **Step 5: Run project verification**

Run: `npx vitest run tests/api/analyze-timeout.test.js && npm run check && npm run build`

Expected: all commands exit with status `0`.

- [x] **Step 6: Commit**

```bash
git add api/analyze.js tests/api/analyze-timeout.test.js
git commit -m "fix: extend insight report timeout"
```
