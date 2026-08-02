# 공식 로고 교체 구현 계획

> **에이전트 작업자용:** 필수 하위 스킬: 이 계획을 작업 단위로 구현할 때 `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`를 사용한다. 진행 상태는 체크박스(`- [ ]`)로 관리한다.

**목표:** 제공된 `PRE:VIEW` 워드마크를 모든 사용자용 공식 로고에 적용하고, 밝은/어두운 배경에서 읽기 쉬운 변형과 파비콘을 제공한다.

**아키텍처:** `Logo`와 `BrandName`을 이미지 기반의 단일 브랜드 표시 경계로 유지한다. 두 컴포넌트는 동일한 `variant` 계약으로 기본(검정/파랑) 또는 반전(흰색) 워드마크를 선택하며, 기존 호출부와 리포트 내 직접 브랜드 표시를 이 계약으로 이관한다.

**기술 스택:** React 18, TypeScript, Tailwind CSS, Vitest, Vite 정적 자산, ImageGen.

## 전역 제약

- 새로 만들거나 수정하는 설계 문서는 한국어로 작성한다. 코드 식별자, 경로, 명령, 원문 표기가 더 명확한 기술 용어는 유지한다.
- 제공 이미지의 대문자 `PRE:VIEW` 글자 형태가 기준이며, 새 글꼴로 근사하지 않는다.
- `Logo`와 `BrandName`의 대체 텍스트는 정확히 `Pre:View`로 유지한다.
- 어두운 배경은 `inverse`(흰색), 밝은 관리자 사이드바는 `default`(검정/파랑) 변형을 쓴다.
- 기존의 내부 `passmate_*` 저장소 키, API 이름, 법률 문구는 변경하지 않는다.
- 현재 작업 트리에는 이 작업과 무관한 변경이 있으므로 이 계획의 파일만 수정하고, 사용자의 별도 요청 없이는 스테이징·커밋·푸시하지 않는다.

---

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `client/public/pre-view-wordmark.png` | 제공 이미지에서 추출한 투명 배경의 기본 검정/파랑 워드마크 |
| `client/public/pre-view-wordmark-white.png` | 어두운 배경용 흰색 글자·약한 발광의 하늘색 콜론 워드마크 |
| `client/public/passmate-wordmark.png` | 기존 공개 URL 호환용 기본 워드마크 별칭 |
| `client/public/passmate-logo.png` | 기존 공개 URL 호환용 파란 콜론 심볼 |
| `client/public/pre-view-wordmark.svg` | 기존 SVG URL 호환용 흰색 워드마크 별칭 |
| `client/public/favicon.svg` | 제공 워드마크의 파란 콜론 심볼을 표현하는 작은 브라우저 아이콘 |
| `client/src/components/Logo.tsx` | 헤더·푸터·인증·관리자 영역의 블록형 공식 로고 |
| `client/src/components/BrandName.tsx` | 문장과 리포트 안에서 인라인으로 쓰이는 공식 로고 |
| `client/src/components/Logo.test.ts` | 로고 자산 선택 및 접근성 계약 |
| `client/src/components/BrandName.test.tsx` | 인라인 로고 자산 선택 및 접근성 계약 |
| `client/src/pages/ReportResult.tsx` | 직접 렌더링하던 리포트 헤더·푸터 브랜드를 `BrandName`으로 통일 |
| `client/src/pages/ReportResult.identity.test.ts` | 리포트가 직접 PassMate 워드마크를 다시 렌더링하지 않는 회귀 방지 |
| `client/src/pages/*.tsx`, `client/src/components/FounderSection.tsx`, `client/src/components/admin/layout/AdminSidebar.tsx` | 기존 `Logo` 호출부에 높이와 배경 변형을 명시 |

### Task 1: 이미지 기반 브랜드 컴포넌트의 실패 테스트 작성

**파일:**

- 수정: `client/src/components/Logo.test.ts`
- 수정: `client/src/components/BrandName.test.tsx`
- 수정: `client/src/components/ReportShowcase.test.tsx`
- 수정: `client/src/components/SocialProofSection.test.tsx`
- 수정: `client/src/pages/ReportResult.identity.test.ts`

**인터페이스:**

- 생산: `Logo({ className?: string; variant?: "default" | "inverse" })`
- 생산: `BrandName({ className?: string; variant?: "default" | "inverse" })`
- 소비: `client/public/pre-view-wordmark.png`, `client/public/pre-view-wordmark-white.png`

- [ ] **Step 1: `Logo`의 기본·반전 변형 실패 테스트를 작성한다.**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Logo from "./Logo";

describe("Logo", () => {
  it("renders the inverse supplied wordmark with an accessible name by default", () => {
    const markup = renderToStaticMarkup(<Logo className="h-5" />);

    expect(markup).toContain('src="/pre-view-wordmark-white.png"');
    expect(markup).toContain('alt="Pre:View"');
    expect(markup).toContain("h-5");
  });

  it("renders the supplied default wordmark on a light surface", () => {
    const markup = renderToStaticMarkup(<Logo variant="default" />);

    expect(markup).toContain('src="/pre-view-wordmark.png"');
    expect(markup).toContain('alt="Pre:View"');
  });
});
```

- [ ] **Step 2: `BrandName`의 인라인 이미지 계약 실패 테스트를 작성한다.**

```tsx
it("renders the supplied inverse wordmark as an accessible inline image", () => {
  const markup = renderToStaticMarkup(<BrandName className="h-[1em]" />);

  expect(markup).toContain('src="/pre-view-wordmark-white.png"');
  expect(markup).toContain('alt="Pre:View"');
  expect(markup).toContain("h-[1em]");
  expect(markup).not.toContain("text-sky-400");
});
```

- [ ] **Step 3: 리포트의 직접 브랜드 텍스트를 막는 실패 테스트를 작성한다.**

```ts
it("uses the shared visual Pre:View brand in report chrome", () => {
  expect(source).toContain('import { BrandName } from "@/components/BrandName"');
  expect(source).toContain("<BrandName");
  expect(source).not.toContain("<span>PassMate Report</span>");
  expect(source).not.toContain("<p>PassMate 2026. All rights reserved.</p>");
});
```

- [ ] **Step 4: 기존 랜딩 브랜드 테스트를 새 접근성 이름으로 먼저 갱신한다.**

`ReportShowcase.test.tsx`의 프레임 탐색을 아래처럼 바꾼다. 현재 `BrandName`은
`role="img"`와 `Pre:View` 이름을 제공하지 않으므로 구현 전에는 이 테스트가
실패한다.

```tsx
const frame = screen
  .getAllByRole("img", { name: "Pre:View" })
  .find(brand => brand.parentElement?.textContent?.includes("Report Preview"))
  ?.closest(".rounded-xl");
```

`SocialProofSection.test.tsx`의 `aria-label="PreView"` 기대값은
`alt="Pre:View"`로 바꾼다.

- [ ] **Step 5: 테스트가 현재 텍스트 구현 때문에 실패하는지 확인한다.**

실행:

```bash
pnpm exec vitest run client/src/components/Logo.test.ts client/src/components/BrandName.test.tsx client/src/components/ReportShowcase.test.tsx client/src/components/SocialProofSection.test.tsx client/src/pages/ReportResult.identity.test.ts
```

기대 결과: `Logo`와 `BrandName`에서 이미지 `src` 또는 `alt`를 찾지 못하고,
랜딩 테스트는 `role="img"`의 `Pre:View` 이름을 찾지 못하며, 리포트에서는
`BrandName` import를 찾지 못해 실패한다.

### Task 2: 제공 이미지에서 공식 로고 자산과 파비콘을 준비

**파일:**

- 수정: `client/public/pre-view-wordmark.png`
- 생성: `client/public/pre-view-wordmark-white.png`
- 수정: `client/public/passmate-wordmark.png`
- 수정: `client/public/passmate-logo.png`
- 수정: `client/public/pre-view-wordmark.svg`
- 수정: `client/public/favicon.svg`

**인터페이스:**

- 생산: `/pre-view-wordmark.png` — 투명 배경, 검정 글자와 파란 콜론
- 생산: `/pre-view-wordmark-white.png` — 투명 배경, 흰색 글자와 하늘색 콜론
- 생산: `/favicon.svg` — 파란색 상·하단 원으로 된 콜론 심볼
- 호환: 기존 `passmate-*`와 SVG URL은 위 자산을 가리켜 구형 로고를 노출하지 않는다.

- [ ] **Step 1: 제공 이미지를 로컬에서 확인하고, ImageGen 편집 입력으로 지정한다.**

`/var/folders/gj/lmj4qdw510s5gh87z_tknfkc0000gn/T/codex-clipboard-f3b38cac-929a-44c7-bdd3-1217613d2675.png`를 `view_image`로 확인한 뒤, 입력 역할을 “edit target”으로 지정한다. 글자, 자간, 두 개의 콜론 점, 파란 발광 위치가 기준 이미지와 같은지 후속 검수 항목으로 기록한다.

- [ ] **Step 2: 기본 워드마크용 투명 자산을 생성·검수한다.**

ImageGen 편집 프롬프트:

```text
Use case: background-extraction
Asset type: web application official wordmark
Primary request: Extract only the exact PRE:VIEW wordmark from the edit target. Keep the uppercase letterforms, letter spacing, black or near-black lettering, the two vertically stacked blue colon dots, and their centered blue glow unchanged. Remove every other visual element.
Input images: Image 1 is the edit target and canonical visual reference.
Scene/backdrop: a perfectly flat solid #00ff00 chroma-key background.
Text (verbatim): "PRE:VIEW"
Constraints: preserve the original wordmark geometry; no crop of any letter; no added tagline, border, shadow beyond the existing subtle blue colon glow, watermark, or extra text.
Avoid: misspelled text, lowercase letters, gradients outside the colon glow, a gray background, and altered spacing.
```

선택한 결과를 프로젝트 임시 위치로 복사하고, `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`로 알파 PNG를 만든 뒤 `client/public/pre-view-wordmark.png`에 둔다. `view_image`로 투명 모서리와 완전한 `PRE:VIEW` 철자를 확인한다.

- [ ] **Step 3: 반전 워드마크용 투명 자산을 생성·검수한다.**

ImageGen 편집 프롬프트:

```text
Use case: precise-object-edit
Asset type: web application dark-surface official wordmark
Primary request: Starting from the supplied PRE:VIEW wordmark, change the letters to solid pure white while preserving the two vertically stacked sky-blue colon dots. Reduce the surrounding sky-blue glow enough that the two dots remain visibly separate. Preserve the uppercase letterforms, letter spacing, and exact positions. Do not change geometry.
Input images: Image 1 is the edit target and canonical visual reference.
Scene/backdrop: a perfectly flat solid #00ff00 chroma-key background.
Text (verbatim): "PRE:VIEW"
Constraints: every letter is #FFFFFF; both colon dots remain sky blue; any sky-blue glow is subtle and must not visually connect the dots; no black, gray, border, watermark, or extra text.
Avoid: misspelled text, lowercase letters, altered kerning, and non-uniform background.
```

같은 chroma-key 제거 절차로 `client/public/pre-view-wordmark-white.png`를 만든다. `view_image`로 글자가 순백색이고 콜론이 하늘색인지, 배경이 투명인지, 모든 문자가 남았는지 확인한다.

- [ ] **Step 4: 파란 콜론 파비콘을 SVG로 교체한다.**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="Pre:View">
  <circle cx="12" cy="7" r="3.25" fill="#1686E8" />
  <circle cx="12" cy="17" r="3.25" fill="#1686E8" />
</svg>
```

### Task 3: 공용 컴포넌트와 모든 공식 표시를 새 자산으로 이관

**파일:**

- 수정: `client/src/components/Logo.tsx`
- 수정: `client/src/components/BrandName.tsx`
- 수정: `client/src/pages/Home.tsx`
- 수정: `client/src/pages/Analyze.tsx`
- 수정: `client/src/pages/Login.tsx`
- 수정: `client/src/pages/MyAnalyses.tsx`
- 수정: `client/src/pages/MyProjects.tsx`
- 수정: `client/src/pages/Terms.tsx`
- 수정: `client/src/pages/Privacy.tsx`
- 수정: `client/src/pages/Entitlements.tsx`
- 수정: `client/src/pages/admin/AdminForbiddenPage.tsx`
- 수정: `client/src/pages/admin/login/AdminLoginPage.tsx`
- 수정: `client/src/components/FounderSection.tsx`
- 수정: `client/src/components/admin/layout/AdminSidebar.tsx`
- 수정: `client/src/pages/ReportResult.tsx`

**인터페이스:**

- 소비: Task 2의 `/pre-view-wordmark.png`, `/pre-view-wordmark-white.png`
- 생산: 각 사용처는 `className="h-N w-auto"`와 필요 시 `variant="default"`를 전달한다.
- 생산: 리포트 크롬은 `BrandName`에 이어 일반 텍스트 `Report` 또는 저작권 문구만 렌더링한다.

- [ ] **Step 1: `Logo`와 `BrandName`을 최소 구현으로 교체한다.**

```tsx
type BrandVariant = "default" | "inverse";

const WORDMARK_SOURCE: Record<BrandVariant, string> = {
  default: "/pre-view-wordmark.png",
  inverse: "/pre-view-wordmark-white.png",
};

export default function Logo({
  className,
  variant = "inverse",
}: {
  className?: string;
  variant?: BrandVariant;
}) {
  return <img alt="Pre:View" className={className} src={WORDMARK_SOURCE[variant]} />;
}
```

`BrandName`도 같은 `BrandVariant`와 `WORDMARK_SOURCE` 선택 규칙을 사용하되, 기본 클래스 `inline-block h-[1em] w-auto align-[-0.12em]`를 `cn`으로 합친다. 기존의 `textClassName`, `logoColor`, 텍스트 `Pre`, 파란 콜론 `<span>`, `font-bold` 구현을 모두 제거한다.

- [ ] **Step 2: 헤더·푸터·인증·관리자 호출부를 이미지 높이 기반으로 바꾼다.**

`Logo`를 쓰는 파일에서 `textClassName`과 `logoColor` prop을 제거하고, 기존 글자 크기와 가장 가까운 `className="h-N w-auto"`를 전달한다. `Home`, `Analyze`, `Login`, `MyAnalyses`, `MyProjects`, `Terms`, `Privacy`, `Entitlements`, `AdminForbiddenPage`, `AdminLoginPage`, `FounderSection`은 어두운 UI이므로 기본 `inverse`를 사용한다. 밝은 배경의 `AdminSidebar`만 `variant="default"`를 명시한다.

- [ ] **Step 3: 문장·미리보기·리포트의 공식 브랜드 표시를 같은 인라인 자산으로 통일한다.**

`BrandName`의 모든 기존 호출부(`Home`, `FounderSection`, `SocialProofSection`, `ReportShowcase`)는 기본 `inverse` 자산을 사용하게 둔다. `ReportResult.tsx`에 `BrandName`을 import하고, `<span>PassMate Report</span>`을 `<span className="inline-flex items-center gap-1"><BrandName className="h-3" /> Report</span>`으로 바꾼다. 저작권 줄의 `PassMate` 텍스트도 `<BrandName className="h-3" />`으로 바꾸고, 연도와 나머지 문구는 유지한다.

- [ ] **Step 4: 실패 테스트가 통과하는지 확인한다.**

실행:

```bash
pnpm exec vitest run client/src/components/Logo.test.ts client/src/components/BrandName.test.tsx client/src/components/ReportShowcase.test.tsx client/src/components/SocialProofSection.test.tsx client/src/pages/ReportResult.identity.test.ts
```

기대 결과: 다섯 테스트 파일의 모든 테스트가 통과하며, `Logo`와 `BrandName`은 정확한 자산 경로와 `alt="Pre:View"`를 렌더링한다.

### Task 4: 통합 회귀 검증과 참조 점검

**파일:**

- 검증: `client/index.html`
- 검증: `client/src/components/Logo.tsx`
- 검증: `client/src/components/BrandName.tsx`
- 검증: Task 3에서 수정한 모든 호출부

**인터페이스:**

- 소비: 최종 정적 로고 자산, `Logo`, `BrandName`
- 생산: 모든 공식 시각 브랜드가 제공 워드마크 또는 파란 콜론 파비콘을 사용한다는 검증 결과

- [ ] **Step 1: 컴포넌트와 브랜드 관련 테스트를 실행한다.**

실행:

```bash
pnpm exec vitest run client/src/components/Logo.test.ts client/src/components/BrandName.test.tsx client/src/components/ReportShowcase.test.tsx client/src/components/SocialProofSection.test.tsx client/src/pages/homeOnboardingCopy.test.ts client/src/pages/ReportResult.identity.test.ts
```

기대 결과: 모두 통과한다. `ReportShowcase.test.tsx`와 `SocialProofSection.test.tsx`는 새 이미지의 `Pre:View` 대체 텍스트를 사용한다.

- [ ] **Step 2: TypeScript 검사를 실행한다.**

실행:

```bash
pnpm check
```

기대 결과: 새 `variant` prop과 제거한 레거시 prop 때문에 발생하는 TypeScript 오류 없이 종료 코드 0으로 끝난다.

- [ ] **Step 3: 공식 로고 참조와 파비콘 경로를 점검한다.**

실행:

```bash
rg -n 'textClassName=|logoColor=|<span>PassMate Report</span>|<p>PassMate 2026\. All rights reserved\.</p>|passmate-wordmark|passmate-logo' client/src client/index.html
rg -n 'pre-view-wordmark|favicon\.svg' client/src client/index.html
```

기대 결과: 첫 명령은 수정 범위 안에서 결과가 없고, 두 번째 명령은 `Logo`, `BrandName`, `client/index.html`에서 새 자산을 확인할 수 있다.

- [ ] **Step 4: 최종 변경 범위와 공백 오류를 확인한다.**

실행:

```bash
git diff --check
git status --short
```

기대 결과: 공백 오류가 없고, 사용자 소유의 기존 변경은 보존되며 이번 작업의 로고·테스트·문서 파일만 추가로 변경되어 있다.
