# 랜딩 프리미엄 이용권 구매 동선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** 랜딩 이용권 카드에서 `₩9,900` 결제 시 분석 3회권을 명확히 안내하고, 사용자가 기존의 안전한 이용권 결제 화면으로 이동할 수 있게 한다.

**아키텍처:** `PricingSection`은 상품 문구와 랜딩 CTA만 담당한다. CTA는 `/entitlements`로 이동하며, 로그인 검증·판매 상태 확인·구매 인텐트 생성·그로블 결제 이동은 이미 검증된 `Entitlements`와 API 경계를 그대로 사용한다.

**기술 스택:** React 19, TypeScript, Wouter, Tailwind CSS, Lucide React, Vitest.

## 전역 제약

- 가격 표기는 정확히 `₩9,900`, 상품 표기는 `분석 3회권`으로 한다.
- 랜딩의 `2회권` 문구를 모두 제거한다.
- 랜딩 CTA는 `/entitlements`로만 이동하며, 결제 인텐트를 직접 생성하지 않는다.
- 결제사 URL, 웹훅, DB 스키마, `premiumCreditsPerPurchase` 설정, 판매 활성화 상태는 변경하지 않는다.
- 기존 무료 분석 CTA의 `/analyze` 이동은 유지한다.
- pnpm만 사용하며, `.worktrees/**`의 중복 테스트를 제외하고 필요한 테스트만 실행한다.
- 현재 작업 트리의 관련 없는 변경은 건드리거나 스테이지하지 않는다. 커밋·푸시는 별도 요청이 있을 때만 한다.

---

## 파일 구조

| 파일                                            | 책임                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `client/src/components/PricingSection.tsx`      | 랜딩 프리미엄 상품 문구와 이용권 화면 이동 CTA를 렌더링한다.                                           |
| `client/src/components/PricingSection.test.tsx` | 랜딩의 3회권 상품 표시와 CTA 클릭 후 이용권 화면 이동을 실제 렌더링으로 검증한다.                      |
| `client/src/pages/homeOnboardingCopy.test.ts`   | 더 이상 렌더링 테스트로 대체되는 이용권 소스 문자열 검증을 제거하고, 나머지 랜딩 문구 계약만 유지한다. |

### Task 1: 랜딩 이용권의 기대 동작을 먼저 고정

**파일:**

- 생성: `client/src/components/PricingSection.test.tsx`
- 수정: `client/src/pages/homeOnboardingCopy.test.ts:5-8, 42-50`
- 수정: `client/src/components/PricingSection.tsx:6-12, 41, 93-102, 121-131`

**인터페이스:**

- 소비: `PricingSection`의 Wouter `navigate(path)` 함수와 브라우저 history.
- 산출: 렌더링된 랜딩의 프리미엄 CTA가 `/entitlements`로 이동한다는 사용자 동작 계약.

- [ ] **Step 1: 실패하는 랜딩 이용권 상호작용 테스트를 작성한다.**

`PricingSection.test.tsx`를 jsdom 환경에서 만들고, 실제 컴포넌트를 렌더링한다. 다음 테스트는 현재 프리미엄 CTA가 없으므로 실패해야 한다.

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import PricingSection from "./PricingSection";

describe("PricingSection", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("shows the ₩9,900 three-analysis-credit offer", () => {
    render(<PricingSection />);

    expect(screen.getByText("₩9,900")).toBeTruthy();
    expect(screen.getByText("분석 3회권")).toBeTruthy();
    expect(
      screen.getByText(
        "추가 분석은 3회권으로 이용하고, 수정본이나 다른 지원서에 자유롭게 사용할 수 있습니다."
      )
    ).toBeTruthy();
  });

  it("opens entitlements when the three-credit purchase CTA is selected", () => {
    render(<PricingSection />);

    fireEvent.click(
      screen.getByRole("button", { name: "분석 3회권 구매하기" })
    );

    expect(window.location.pathname).toBe("/entitlements");
  });
});
```

`homeOnboardingCopy.test.ts`에서는 `pricingSource` 읽기와 이용권 소스 문자열 테스트 전체를 제거한다. 나머지 랜딩 문구 테스트는 변경하지 않는다.

- [ ] **Step 2: 테스트가 의도대로 실패하는지 확인한다.**

실행:

```bash
pnpm exec vitest run --exclude '.worktrees/**' client/src/components/PricingSection.test.tsx
```

기대 결과: `PricingSection.tsx`에 아직 `분석 3회권 구매하기` 버튼이 없으므로, 버튼을 찾지 못했다는 실패가 발생한다.

- [ ] **Step 3: 가격 카드의 문구와 프리미엄 CTA를 최소 변경으로 구현한다.**

`PricingSection.tsx`에서 다음을 바꾼다.

```tsx
const includedItems = [
  "첫 분석 1회 무료",
  "첫 분석부터 전체 리포트 제공",
  "추가 분석은 3회권으로 이용",
  "수정본 재분석 또는 다른 지원서 분석 가능",
];
```

제목 아래 설명은 `더 다듬고 싶은 지원서가 생기면 3회권으로 이어서 분석할 수 있습니다.`로, 가격 옆 표기는 `/ 분석 3회권`으로, 프리미엄 설명은 `추가 분석은 3회권으로 이용하고, 수정본이나 다른 지원서에 자유롭게 사용할 수 있습니다.`로 변경한다.

프리미엄 열의 `ul` 아래에 기존 무료 CTA와 대비되는 보라색 계열 버튼을 추가한다. 이 버튼은 추가 API 호출 없이 아래처럼 이동만 수행한다.

```tsx
<button
  type="button"
  className="group w-full md:w-fit flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-purple-400 text-[#0A0A0A] text-[14px] font-medium transition-all duration-300 hover:bg-purple-300 active:scale-[0.98]"
  onClick={() => navigate("/entitlements")}
>
  분석 3회권 구매하기
  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
</button>
```

`ArrowRight`는 이미 import되어 있으므로 새 의존성이나 import 변경은 필요 없다.

- [ ] **Step 4: 계약 테스트가 통과하는지 확인한다.**

실행:

```bash
pnpm exec vitest run --exclude '.worktrees/**' client/src/components/PricingSection.test.tsx client/src/pages/homeOnboardingCopy.test.ts
```

기대 결과: 두 테스트 파일의 모든 테스트가 통과하며, 상품 문구·CTA·이동 경로 중 하나라도 어긋나면 실패한다.

- [ ] **Step 5: 타입 검사를 실행한다.**

실행:

```bash
pnpm check
```

기대 결과: TypeScript 오류 없이 종료한다.

- [ ] **Step 6: 변경 범위를 확인한다.**

실행:

```bash
git diff -- client/src/components/PricingSection.tsx client/src/components/PricingSection.test.tsx client/src/pages/homeOnboardingCopy.test.ts
git status --short
```

기대 결과: 이 작업의 코드 변경은 위 세 파일로 한정되며, 이미 존재하던 작업 트리 변경은 그대로 남는다.

## 계획 자체 점검

- 명세의 가격·3회권 표기 요구는 Task 1의 문구 계약과 구현 단계에서 다룬다.
- 랜딩 CTA의 `/entitlements` 이동은 Task 1의 테스트와 구현 단계에서 다룬다.
- 로그인, 결제 인텐트, 판매 상태 및 그로블 리디렉션은 기존 이용권 경계로 유지하므로 새 서버·DB 작업은 없다.
- 미완성 표기, 모호한 구현 지시나 정의되지 않은 인터페이스는 없다.
