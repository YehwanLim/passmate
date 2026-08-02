# 스크롤 주도형 리포트 미리보기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데스크톱 랜딩에서 리포트 미리보기를 스크롤 순서에 맞춰 고정 전환하고, 각 예시 화면을 실제 리포트처럼 풍성하게 채운다.

**Architecture:** `ReportShowcase`의 기존 네 장면은 유지하되, 프리뷰 전용 스크롤 트랙과 고정 프레임을 추가한다. Framer Motion의 `useScroll` 진행도를 활성 장면 인덱스로 변환하며, 작은 화면과 동작 감소 환경에서는 기존 버튼 기반 탐색만 제공한다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Framer Motion 12, Vitest

## Global Constraints

- API, Prisma 스키마, 실제 분석 리포트 화면, 랜딩의 다른 섹션은 변경하지 않는다.
- 기존 네 장면과 직접 탐색 버튼의 접근 가능한 이름을 유지한다.
- 새 패키지, 이미지 에셋, 전역 휠 이벤트 가로채기, 점수·미제공 기능을 암시하는 예시를 추가하지 않는다.
- 데스크톱과 `prefers-reduced-motion: no-preference`에서만 고정 스크롤 연출을 적용한다.
- 모바일과 동작 감소 환경은 일반 페이지 스크롤과 버튼 탐색을 유지한다.

---

## File Structure

- `client/src/components/ReportShowcase.tsx`: 스크롤 진행도에 따른 장면 선택, 반응형 고정 프레임, 네 장면의 보강된 정적 예시를 담당한다.
- `client/src/components/ReportShowcase.test.tsx`: 프리뷰의 장면 진행도 계산과 직접 탐색으로 보이는 장면 콘텐츠를 검증한다.

### Task 1: 리포트 프리뷰 계약 테스트 추가

**Files:**

- Create: `client/src/components/ReportShowcase.test.tsx`

**Interfaces:**

- Consumes: `ReportShowcase`와 새 `getReportPreviewSceneIndex(progress: number)` 내보내기
- Produces: 스크롤 진행도 경계와 직접 탐색 시 각 장면의 보강된 콘텐츠를 보호하는 Vitest 계약

- [x] **Step 1: Write the failing test**

실제 렌더링과 버튼 탐색을 사용하는 다음 테스트 파일을 추가한다. 이 테스트가 잡는 회귀는 스크롤 진행도를 잘못된 장면에 연결하거나, 네 장면에 필요한 읽을 거리를 제거하는 변경이다.

```tsx
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReportShowcase, { getReportPreviewSceneIndex } from "./ReportShowcase";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("ReportShowcase", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("maps each scroll quarter to its report scene", () => {
    expect(
      [0, 0.249, 0.25, 0.5, 0.75, 1].map(getReportPreviewSceneIndex)
    ).toEqual([0, 0, 1, 2, 3, 3]);
  });

  it("shows enriched report details as visitors advance through scenes", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));

    render(<ReportShowcase />);
    expect(screen.getByText("근거가 된 경험")).toBeTruthy();

    const next = () =>
      fireEvent.click(
        screen.getAllByRole("button", { name: "다음 리포트 미리보기" })[0]
      );

    next();
    await waitFor(() =>
      expect(screen.getByText("우선 보완 순서")).toBeTruthy()
    );
    next();
    await waitFor(() =>
      expect(
        screen.getByText("고객군을 나눈 기준을 문장 안에 넣어야 합니다.")
      ).toBeTruthy()
    );
    next();
    await waitFor(() =>
      expect(screen.getAllByText("답변에서 설명할 근거")).toHaveLength(3)
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run client/src/components/ReportShowcase.test.tsx`

Expected: FAIL because `getReportPreviewSceneIndex` is undefined and the first scene has no `근거가 된 경험` content. These are the missing scroll-progress and enriched-content contracts the implementation must provide.

- [x] **Step 3: Do not modify production code in this task**

Keep `ReportShowcase.tsx` unchanged until Task 2. The failing import must be the only new production contract before implementation begins.

- [ ] **Step 4: Commit**

Do not create a commit unless the user explicitly asks. If requested, stage only `client/src/components/ReportShowcase.test.tsx` and use `test: specify scroll-driven report preview`.

### Task 2: 스크롤 고정 프레임과 풍성한 예시 구현

**Files:**

- Modify: `client/src/components/ReportShowcase.tsx:1-520`
- Test: `client/src/components/ReportShowcase.test.tsx`

**Interfaces:**

- Consumes: `REPORT_PREVIEW_SCENES`, `activeIndex`, `goToPreviousScene`, `goToNextScene`
- Produces: `getReportPreviewSceneIndex(progress: number)`와 `ReportShowcase`가 `scrollYProgress`에 따라 0부터 3까지의 `activeIndex`를 선택하고, 직접 탐색과 반응형 폴백을 유지한다.

- [x] **Step 1: Add the scroll-motion imports and media-query state**

Replace the Framer Motion import and React import so the component can observe a target scroll range and responsive media query.

```ts
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

const DESKTOP_SCROLL_PREVIEW_QUERY =
  "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

export function getReportPreviewSceneIndex(progress: number) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  return Math.min(
    REPORT_PREVIEW_SCENES.length - 1,
    Math.floor(clampedProgress * REPORT_PREVIEW_SCENES.length)
  );
}
```

Inside `ReportShowcase`, create `scrollTrackRef`, `isScrollDriven`, and an effect that updates `isScrollDriven` from `window.matchMedia(DESKTOP_SCROLL_PREVIEW_QUERY)`. Register and remove the media-query `change` listener in the effect cleanup.

- [x] **Step 2: Map only the pinned track’s progress to a scene**

Create the progress source from the new track ref and update the active index only while the desktop animation is allowed.

```ts
const { scrollYProgress } = useScroll({
  target: scrollTrackRef,
  offset: ["start start", "end end"],
});

useMotionValueEvent(scrollYProgress, "change", progress => {
  if (!isScrollDriven) return;

  setActiveIndex(getReportPreviewSceneIndex(progress));
});
```

Remove the existing `window.setInterval` effect entirely. Keep the arrow and navigator handlers unchanged so manual selection remains immediate.

- [x] **Step 3: Add the responsive scroll track around the existing frame**

Keep the heading outside the track. Wrap `ReportPreviewFrame` in a ref-bearing container that reserves four desktop viewports, and make the frame sticky only when `isScrollDriven` is true.

```tsx
<div
  ref={scrollTrackRef}
  className={isScrollDriven ? "relative h-[400vh]" : "relative"}
>
  <div
    className={
      isScrollDriven ? "sticky top-0 flex min-h-screen items-center py-8" : ""
    }
  >
    <ReportPreviewFrame
      activeIndex={activeIndex}
      onSelectScene={setActiveIndex}
      goToPreviousScene={goToPreviousScene}
      goToNextScene={goToNextScene}
    />
  </div>
</div>
```

Do not attach a `wheel` listener or call `preventDefault`. The surrounding page must be able to leave the section once the track ends.

- [x] **Step 4: Fill the first-impression and diagnosis scenes**

Extend the existing static arrays and card layouts so they show all of the following Korean labels and details:

```tsx
<p className="text-sm font-semibold text-white">근거가 된 경험</p>
<p className="text-sm font-semibold text-white">우선 보완 순서</p>
<p className="text-sm font-semibold text-white">지원 전략 요약</p>
```

Use three evidence rows for the first-impression card: `행동 데이터 3,000건 직접 수집`, `이탈률 35% → 18% 개선`, `일간 활성 사용자 20% 증가`. Use three numbered diagnosis priorities: company-context connection, segment definition, and collaboration decision-making. Preserve the existing current and target positioning comparison and add one concise strategy summary below it.

- [x] **Step 5: Fill the line-feedback and interview scenes**

Extend `previewAnswer` to at least six source paragraphs and mark at least three with `annotation-hl` plus their existing numbered indicator. Render matching commentary cards for a strength, an improvement, and a revision; each card must contain an explanatory sentence and a suggested replacement sentence where a revision is needed. Keep the visible label `개선한 문장`.

Expand the final scene to three interview questions. For each question, show its follow-up question list and this visible heading:

```tsx
<p className="text-sm font-semibold text-white">답변에서 설명할 근거</p>
```

Keep the action plan adjacent to the questions, expand it to four numbered items, and retain the existing expected-effect copy pattern.

- [x] **Step 6: Preserve readable dimensions and direct controls**

Keep `ReportPreviewFrame`’s opaque black background, border, desktop navigation, responsive tabs, mobile arrows, and `AnimatePresence` transition. Adjust scene and frame spacing only as needed so the added content fills the frame without creating an inner scrolling pane or clipping content. Keep the fade at the bottom only if it no longer hides content.

- [x] **Step 7: Run the focused test to verify it passes**

Run: `pnpm exec vitest run client/src/components/ReportShowcase.test.tsx`

Expected: PASS with `maps each scroll quarter to its report scene` and `shows enriched report details as visitors advance through scenes` green.

- [x] **Step 8: Run TypeScript validation**

Run: `pnpm check`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 9: Commit**

Do not create a commit unless the user explicitly asks. If requested, stage only `client/src/components/ReportShowcase.tsx` and `client/src/components/ReportShowcase.test.tsx` (plus this plan/spec only if the user requests documentation in the commit), then use `feat: add scroll-driven report preview`.
