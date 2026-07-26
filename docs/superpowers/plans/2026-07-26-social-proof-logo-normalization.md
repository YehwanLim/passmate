# Social Proof 로고 정렬·가독성 보정 구현 계획

> **에이전트 작업자용:** 필수 하위 스킬: 이 계획은 작업별로 `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`를 사용해 실행한다. 모든 단계는 체크박스로 관리한다.

**목표:** Social Proof 마키의 18개 기업 로고가 잘리지 않고 같은 수직 기준선에서 보이도록 맞추며, 기본 상태의 로고 식별성을 높인다.

**아키텍처:** `socialProof.ts`에 회사별 `logoScale`을 추가해 시각적 크기를 데이터로만 보정한다. `SocialProofSection`은 이 값을 CSS custom property로 전달하고, CSS는 절대 위치·최대 크기 제약으로 모든 이미지가 고정 레일 안에 수용되게 한다.

**기술 스택:** React 19, TypeScript, CSS custom properties, Vite, Vitest, in-app browser

## 전역 제약

- 기업 목록은 18개를 유지한다.
- 마키는 현재처럼 왼쪽에서 오른쪽으로 연속 반복한다.
- 기본 상태는 완전 흑백이 아닌 부분 그레이스케일과 높은 불투명도를 사용한다.
- hover 시 원래 색상을 복원한다.
- 모바일의 세로 지표 레이아웃과 reduced-motion 동작을 바꾸지 않는다.

---

## 파일 구조

| 경로 | 역할 |
| --- | --- |
| `client/src/constants/socialProof.ts` | 각 기업의 `logoScale`을 포함하는 단일 로고 데이터 원천 |
| `client/src/components/SocialProofSection.tsx` | 회사별 배율을 `--logo-scale` CSS custom property로 전달 |
| `client/src/components/SocialProofSection.test.tsx` | 18개 배율 데이터와 렌더링된 custom property를 검증 |
| `client/src/index.css` | 로고 프레임 수용 규칙, 수직 중앙 정렬, 기본 색상 필터 |

## Task 1: 회사별 시각 배율 데이터를 추가한다

**Files:**

- Modify: `client/src/constants/socialProof.ts`
- Modify: `client/src/components/SocialProofSection.test.tsx`

**Interfaces:**

- Produces: `SuccessfulCompany.logoScale: number`
- Consumes: `SUCCESSFUL_COMPANIES`를 순회하는 `SocialProofSection`

- [ ] **Step 1: 배율 데이터의 실패 테스트를 작성한다**

  ```tsx
  expect(SUCCESSFUL_COMPANIES).toHaveLength(18);
  expect(
    SUCCESSFUL_COMPANIES.every(
      company => company.logoScale >= 0.9 && company.logoScale <= 1.2
    )
  ).toBe(true);
  ```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

  Run: `npx vitest run client/src/components/SocialProofSection.test.tsx`

  Expected: `logoScale`가 존재하지 않아 실패한다.

- [ ] **Step 3: `SuccessfulCompany`과 18개 데이터를 최소 변경한다**

  ```ts
  export type SuccessfulCompany = {
    id: string;
    name: string;
    wordmark: string;
    logoSrc: \`/company-logos/\${string}.svg\`;
    logoAlt: \`\${string} 로고\`;
    logoScale: number;
  };

  // 순서대로: CJ, 카카오, NAVER, LG, 넥슨, NCSOFT, 넷마블,
  // 포스코인터내셔널, 현대자동차, SK케미칼, 현대오토에버, 오리온,
  // 삼성전자, LG디스플레이, SK텔레콤, NHN커머스, 삼양그룹, CJ올리브네트웍스
  const logoScales = [
    1.15, 0.95, 0.95, 1.1, 1, 1.12, 0.92, 1,
    1.18, 1.08, 0.98, 0.95, 1.15, 0.94, 1.05, 0.97, 0.96, 1.12,
  ] as const;
  ```

  각 객체에는 위 순서의 수치를 `logoScale`로 직접 넣는다. 별도 런타임 계산이나 API 호출은 추가하지 않는다.

- [ ] **Step 4: 단위 테스트가 통과하는지 확인한다**

  Run: `npx vitest run client/src/components/SocialProofSection.test.tsx`

  Expected: 18개 회사 모두 `logoScale`을 가지며 범위 테스트가 통과한다.

- [ ] **Step 5: 데이터 변경을 커밋한다**

  ```bash
  git add client/src/constants/socialProof.ts client/src/components/SocialProofSection.test.tsx
  git commit -m "feat: tune social proof logo scales"
  ```

## Task 2: 배율을 전달하고 로고 프레임을 고정한다

**Files:**

- Modify: `client/src/components/SocialProofSection.tsx`
- Modify: `client/src/components/SocialProofSection.test.tsx`
- Modify: `client/src/index.css`

**Interfaces:**

- Consumes: `company.logoScale`
- Produces: 모든 `.social-proof-logo`의 `--logo-scale` inline custom property와 고정 프레임 내부 정렬

- [ ] **Step 1: 렌더링 custom property의 실패 테스트를 작성한다**

  ```tsx
  const markup = renderToStaticMarkup(<SocialProofSection />);

  expect(markup).toContain("--logo-scale:1.15");
  expect(markup).toContain('src="/company-logos/hyundai-motor.svg"');
  ```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

  Run: `npx vitest run client/src/components/SocialProofSection.test.tsx`

  Expected: `--logo-scale`이 마크업에 없어 실패한다.

- [ ] **Step 3: 섹션에서 배율을 CSS custom property로 전달한다**

  ```tsx
  import { useRef, type CSSProperties } from "react";

  <img
    src={company.logoSrc}
    alt=""
    aria-hidden="true"
    className="social-proof-logo"
    style={{ "--logo-scale": company.logoScale } as CSSProperties}
    width={168}
    height={48}
  />
  ```

- [ ] **Step 4: 절대 위치와 최대 크기 제약을 적용한다**

  ```css
  .social-proof-logo-shell {
    position: relative;
    display: block;
    width: clamp(7.5rem, 12vw, 10.5rem);
    height: 3rem;
    flex: 0 0 auto;
    overflow: hidden;
  }

  .social-proof-logo {
    position: absolute;
    inset: 0;
    display: block;
    width: auto;
    height: auto;
    max-width: calc(100% - 0.75rem);
    max-height: 2rem;
    margin: auto;
    object-fit: contain;
    transform: scale(var(--logo-scale, 1));
    transform-origin: center;
    filter: grayscale(0.35) opacity(0.82) contrast(1.08) brightness(1.12);
    transition: filter 240ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .social-proof-logo-shell:hover .social-proof-logo {
    filter: none;
  }
  ```

- [ ] **Step 5: 단위 테스트가 통과하는지 확인한다**

  Run: `npx vitest run client/src/components/SocialProofSection.test.tsx`

  Expected: 18개 로고, 두 마키 그룹, `--logo-scale` 마크업 검증이 모두 통과한다.

- [ ] **Step 6: UI 변경을 커밋한다**

  ```bash
  git add client/src/components/SocialProofSection.tsx client/src/components/SocialProofSection.test.tsx client/src/index.css
  git commit -m "fix: normalize social proof logo alignment"
  ```

## Task 3: 데스크톱·모바일 시각 회귀를 검증한다

**Files:**

- Modify only when verification exposes a defect: `client/src/constants/socialProof.ts`, `client/src/components/SocialProofSection.tsx`, `client/src/index.css`

**Interfaces:**

- Consumes: Task 1~2에서 구현한 `logoScale`, 프레임 CSS, 기존 마키 애니메이션
- Produces: 크롭·수직 이탈이 없는 18개 로고 레일

- [ ] **Step 1: 단위·타입·빌드 검증을 실행한다**

  Run:

  ```bash
  VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=test-key npx vitest run
  npm run check
  DATABASE_URL=postgresql://preview:preview@localhost:5432/preview VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=test-key npm run build
  ```

  Expected: 전체 Vitest, TypeScript 검사, 프로덕션 빌드가 통과한다.

- [ ] **Step 2: 데스크톱에서 DOM 경계를 확인한다**

  브라우저에서 Social Proof 섹션을 연다. 첫 번째 마키 그룹의 18개 이미지에 대해 아래 조건을 확인한다.

  ```js
  const images = Array.from(
    document.querySelector('section[aria-labelledby="social-proof-title"]')
      .getElementsByTagName("img")
  ).slice(0, 18);

  images.every(image => {
    const imageBox = image.getBoundingClientRect();
    const shellBox = image.parentElement.getBoundingClientRect();
    return (
      imageBox.top >= shellBox.top &&
      imageBox.bottom <= shellBox.bottom &&
      Math.abs(
        imageBox.top + imageBox.height / 2 - (shellBox.top + shellBox.height / 2)
      ) <= 1
    );
  });
  ```

  Expected: `true`. 마키 transform의 Y값은 `0`이며, 300ms 뒤 X값만 변한다.

- [ ] **Step 3: 모바일 레이아웃을 확인한다**

  브라우저 viewport를 `390 × 844`로 설정한다. `.social-proof-metrics`의 `grid-template-columns`가 단일 열이고, 두 번째 지표의 위쪽 경계선만 남는지 확인한다. 로고 18개는 데스크톱과 동일하게 프레임 안에 있어야 한다.

- [ ] **Step 4: 검증 결과를 커밋에 포함한다**

  Run: `git status --short`

  Expected: 추가 코드 수정이 없다면 깨끗한 작업 트리. 검증 중 수정했다면 해당 수정과 테스트를 의미 단위 커밋으로 추가한다.
