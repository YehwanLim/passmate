# Social Proof 지표 및 로고 개선 구현 계획

> **에이전트 작업자용:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** Social Proof 섹션에 실제 기업 로고 18개와 `127+ / 2,000+` 카운트업 지표를 추가하고, 페이지 이동 없이 자연스럽게 반복되는 로고 마키를 구현한다.

**아키텍처:** `socialProof.ts`를 지표와 회사 로고 데이터의 단일 원천으로 확장한다. 숫자 보간은 독립된 `SocialProofMetric` 컴포넌트가 담당하고, 섹션은 viewport 감지 결과와 데이터만 전달한다. 로고는 `client/public/company-logos`에서 정적 SVG로 제공해 외부 네트워크·레이아웃 시프트를 제거한다.

**기술 스택:** React 19, TypeScript, Framer Motion, Tailwind CSS, CSS keyframes, Vitest, Vite

## 전역 제약

- 기존 위치(리포트 미리보기 다음, 분석 파이프라인 전)와 후기 캐러셀은 유지한다.
- 회사 목록은 총 18개이며, 회사별 로고 경로는 `/company-logos/<id>.svg` 형식의 로컬 SVG만 사용한다.
- 지표는 `127+ 합격 기업`, `2,000+ 분석 완료 자소서`를 정확히 사용한다. 수치를 임의로 변경하거나 API에서 가져오지 않는다.
- 기본 상태는 그레이스케일, hover 상태는 원래 색상이다.
- `prefers-reduced-motion`에서는 카운트업과 마키를 재생하지 않고 최종 수치와 첫 번째 로고 묶음을 표시한다.
- 로고 마키는 왼쪽에서 오른쪽으로 이동하며, 동일한 두 묶음의 정확히 50% 폭만 이동해 루프 시 화면이나 문서 높이가 변하지 않아야 한다.
- 루트에서 Vitest를 실행할 때는 다른 작업 디렉터리를 수집하지 않도록 `--exclude '.worktrees/**'`를 사용한다.

---

## 파일 구조

| 경로 | 역할 |
| --- | --- |
| `client/public/company-logos/*.svg` | 18개 회사의 실제 SVG 로고. 고정된 viewBox를 유지하고 색상 정보는 보존한다. |
| `client/public/company-logos/SOURCES.md` | 로고별 공식 출처 URL, 확인 날짜, 라이선스·상표 고지. |
| `client/src/constants/socialProof.ts` | `SocialProofMetric`, `SOCIAL_PROOF_METRICS`, 로고 경로를 포함한 `SUCCESSFUL_COMPANIES`의 단일 원천. |
| `client/src/components/SocialProofMetric.tsx` | viewport 진입 뒤 requestAnimationFrame 카운트업을 담당하는 독립 컴포넌트. |
| `client/src/components/SocialProofMetric.test.tsx` | 숫자 포맷과 정지·감소 모션 상태를 검증. |
| `client/src/components/SocialProofSection.tsx` | 두 지표·SVG 로고·동일한 두 마키 묶음을 조합. |
| `client/src/components/SocialProofSection.test.tsx` | 데이터, 18개 로고, 두 마키 묶음, 섹션 마크업을 검증. |
| `client/src/index.css` | 고정 크기 로고 레일, 그레이스케일/포커스 상태, 정확히 한 묶음 폭을 이동하는 마키 규칙. |

## Task 1: 회사 로고 에셋과 신뢰 데이터 확장

**Files:**
- Create: `client/public/company-logos/{cj,kakao,naver,lg,nexon,ncsoft,netmarble,posco-international,hyundai-motor,sk-chemicals,hyundai-autoever,orion,samsung-electronics,lg-display,sk-telecom,nhn-commerce,samyang-group,cj-olive-networks}.svg`
- Create: `client/public/company-logos/SOURCES.md`
- Modify: `client/src/constants/socialProof.ts`
- Modify: `client/src/components/SocialProofSection.test.tsx`

**Interfaces:**
- Produces: `SocialProofMetric`, `SOCIAL_PROOF_METRICS`, `SuccessfulCompany.logoSrc`, `SuccessfulCompany.logoAlt`.
- Consumes: `SUCCESSFUL_COMPANIES`와 `SUCCESSFUL_COMPANY_COUNT`를 사용하는 `SocialProofSection`.

- [ ] **Step 1: 회사·지표 데이터의 실패 테스트를 작성한다.**

  `client/src/components/SocialProofSection.test.tsx`에 다음 기대값을 추가한다.

  ```tsx
  import {
    SOCIAL_PROOF_METRICS,
    SUCCESSFUL_COMPANIES,
  } from "./SocialProofSection";

  expect(SOCIAL_PROOF_METRICS).toEqual([
    { id: "accepted-companies", value: 127, suffix: "+", label: "합격 기업" },
    { id: "analyzed-cover-letters", value: 2000, suffix: "+", label: "분석 완료 자소서" },
  ]);
  expect(SUCCESSFUL_COMPANIES).toHaveLength(18);
  expect(SUCCESSFUL_COMPANIES.map(({ name }) => name)).toContain("SK케미칼");
  expect(SUCCESSFUL_COMPANIES.map(({ name }) => name)).toEqual(
    expect.arrayContaining(["LG디스플레이", "SK텔레콤", "NHN커머스", "삼양그룹", "CJ올리브네트웍스"])
  );
  expect(SUCCESSFUL_COMPANIES.every(({ logoSrc, logoAlt }) =>
    logoSrc.startsWith("/company-logos/") && logoSrc.endsWith(".svg") && logoAlt.endsWith("로고")
  )).toBe(true);
  ```

- [ ] **Step 2: 실패를 확인한다.**

  Run: `npx vitest run client/src/components/SocialProofSection.test.tsx`

  Expected: `SOCIAL_PROOF_METRICS` 또는 `logoSrc`가 아직 export되지 않아 실패한다.

- [ ] **Step 3: 실제 로고 SVG와 출처 문서를 추가한다.**

  각 회사의 공식 브랜드 가이드·공식 미디어킷 또는 사용 조건이 명시된 SVG 공개 자료에서 현재 로고를 내려받는다. 파일의 viewBox와 원래 색상은 유지하고, 직접 단색으로 변환하지 않는다. `SOURCES.md`에는 18개 파일 각각에 대해 로컬 파일명, 회사명, 실제로 내려받은 정확한 출처 URL, 확인일, 상표 귀속 문구를 기록한다. 출처가 비어 있거나 추정 URL인 에셋은 추가하지 않는다.

  `socialProof.ts`의 타입과 데이터는 아래 형태로 확장한다.

  ```ts
  export type SocialProofMetric = {
    id: "accepted-companies" | "analyzed-cover-letters";
    value: number;
    suffix: "+";
    label: "합격 기업" | "분석 완료 자소서";
  };

  export type SuccessfulCompany = {
    id: string;
    name: string;
    logoSrc: `/company-logos/${string}.svg`;
    logoAlt: `${string} 로고`;
  };

  export const SOCIAL_PROOF_METRICS: readonly SocialProofMetric[] = [
    { id: "accepted-companies", value: 127, suffix: "+", label: "합격 기업" },
    { id: "analyzed-cover-letters", value: 2000, suffix: "+", label: "분석 완료 자소서" },
  ];
  ```

- [ ] **Step 4: 테스트와 SVG 유효성을 확인한다.**

  Run: `npx vitest run client/src/components/SocialProofSection.test.tsx && for asset in client/public/company-logos/*.svg; do rg -q '<svg' "$asset" || exit 1; done`

  Expected: Social Proof 테스트 통과, 18개 SVG 모두 `<svg` 루트 요소를 가진다.

- [ ] **Step 5: 데이터·에셋을 커밋한다.**

  ```bash
  git add client/public/company-logos client/src/constants/socialProof.ts client/src/components/SocialProofSection.test.tsx
  git commit -m "feat: add social proof company logos"
  ```

## Task 2: 재사용 가능한 숫자 카운트업 컴포넌트

**Files:**
- Create: `client/src/components/SocialProofMetric.tsx`
- Create: `client/src/components/SocialProofMetric.test.tsx`

**Interfaces:**
- Consumes: `SocialProofMetric` from `@/constants/socialProof`.
- Produces: `SocialProofMetricCard({ metric, isActive }: { metric: SocialProofMetric; isActive: boolean })` and `formatSocialProofMetric(value: number): string`.
- Depends on: `framer-motion`의 `useReducedMotion`.

- [ ] **Step 1: 숫자 포맷과 초기 상태의 실패 테스트를 작성한다.**

  ```tsx
  import { renderToStaticMarkup } from "react-dom/server";
  import { describe, expect, it } from "vitest";
  import {
    formatSocialProofMetric,
    SocialProofMetricCard,
  } from "./SocialProofMetric";

  describe("SocialProofMetricCard", () => {
    const metric = { id: "analyzed-cover-letters", value: 2000, suffix: "+", label: "분석 완료 자소서" } as const;

    it("formats grouped counts and renders the inactive counter at zero", () => {
      expect(formatSocialProofMetric(2000)).toBe("2,000");
      expect(renderToStaticMarkup(<SocialProofMetricCard metric={metric} isActive={false} />))
        .toContain("0+");
    });
  });
  ```

- [ ] **Step 2: 실패를 확인한다.**

  Run: `npx vitest run client/src/components/SocialProofMetric.test.tsx`

  Expected: 컴포넌트 파일을 찾을 수 없어 실패한다.

- [ ] **Step 3: 최소 카운트업 구현을 작성한다.**

  `SocialProofMetric.tsx`에서 `requestAnimationFrame`을 사용해 `isActive`가 true가 된 시점부터 1,200ms 동안 `0 → metric.value`를 보간한다. 해제 시 `cancelAnimationFrame`을 호출한다. `useReducedMotion()`이 true이면 효과 시작 시 즉시 최종 값을 설정한다.

  ```tsx
  export function formatSocialProofMetric(value: number) {
    return new Intl.NumberFormat("ko-KR").format(value);
  }

  export function SocialProofMetricCard({ metric, isActive }: Props) {
    const shouldReduceMotion = Boolean(useReducedMotion());
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      if (!isActive) return;
      if (shouldReduceMotion) {
        setDisplayValue(metric.value);
        return;
      }
      let frameId = 0;
      let startedAt: number | undefined;
      const tick = (now: number) => {
        startedAt ??= now;
        const progress = Math.min((now - startedAt) / 1200, 1);
        setDisplayValue(Math.round(metric.value * (1 - Math.pow(1 - progress, 4))));
        if (progress < 1) frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frameId);
    }, [isActive, metric.value, shouldReduceMotion]);

    return <div className="social-proof-metric">{formatSocialProofMetric(displayValue)}{metric.suffix}</div>;
  }
  ```

- [ ] **Step 4: 단위 테스트와 타입 검사를 통과시킨다.**

  Run: `npx vitest run client/src/components/SocialProofMetric.test.tsx && npm run check`

  Expected: 숫자는 `2,000`으로 포맷되고 비활성 상태는 `0+`을 렌더링하며 타입 오류가 없다.

- [ ] **Step 5: 카운터 컴포넌트를 커밋한다.**

  ```bash
  git add client/src/components/SocialProofMetric.tsx client/src/components/SocialProofMetric.test.tsx
  git commit -m "feat: animate social proof metrics"
  ```

## Task 3: A안 지표 레이아웃·로고 마키 통합

**Files:**
- Modify: `client/src/components/SocialProofSection.tsx`
- Modify: `client/src/components/SocialProofSection.test.tsx`
- Modify: `client/src/index.css`

**Interfaces:**
- Consumes: `SOCIAL_PROOF_METRICS`, `SUCCESSFUL_COMPANIES`, `SocialProofMetricCard`.
- Produces: 두 개의 `.social-proof-metric`과 정확히 두 개의 `.social-proof-marquee-group`을 가진 섹션.

- [ ] **Step 1: 통합 마크업과 마키 구조의 실패 테스트를 작성한다.**

  ```tsx
  it("renders paired metrics and two equal marquee groups", () => {
    const markup = renderToStaticMarkup(<SocialProofSection />);

    expect(markup).toContain("합격 기업");
    expect(markup).toContain("분석 완료 자소서");
    expect(markup.match(/social-proof-metric"/g)).toHaveLength(2);
    expect(markup.match(/social-proof-marquee-group/g)).toHaveLength(2);
    expect(markup).toContain('src="/company-logos/samsung-electronics.svg"');
  });
  ```

- [ ] **Step 2: 실패를 확인한다.**

  Run: `npx vitest run client/src/components/SocialProofSection.test.tsx`

  Expected: 두 번째 지표와 실제 SVG `img` 요소가 없어 실패한다.

- [ ] **Step 3: 섹션에 viewport 기반 지표와 로고를 연결한다.**

  `SocialProofSection.tsx`에서 section ref에 `useInView(ref, { once: true, amount: 0.35 })`를 연결하고 각 `SOCIAL_PROOF_METRICS` 항목을 `SocialProofMetricCard`로 렌더링한다. 기존의 단일 `text-7xl/md:text-9xl` 숫자 블록은 제거하고, 지표 컨테이너는 아래 구조를 사용한다.

  ```tsx
  <div className="social-proof-metrics mt-10" aria-label="PreView 성과 지표">
    {SOCIAL_PROOF_METRICS.map(metric => (
      <SocialProofMetricCard key={metric.id} metric={metric} isActive={isInView} />
    ))}
  </div>
  ```

  마키의 각 항목은 텍스트 span 대신 아래 형태로 교체한다. 중복 그룹은 `aria-hidden="true"`로 유지하고, 화면 판독기 목록에는 한 번만 회사명을 제공한다.

  ```tsx
  <img
    src={company.logoSrc}
    alt=""
    aria-hidden="true"
    className="social-proof-logo"
    width="168"
    height="44"
  />
  ```

- [ ] **Step 4: 레이아웃 시프트 없는 CSS를 작성한다.**

  `index.css`에서 track에는 gap을 두지 않고, group에만 동일한 trailing gap을 넣는다. 로고 래퍼의 가로·세로를 고정해 SVG 로드 전후에도 레일 높이와 폭이 달라지지 않게 한다.

  ```css
  .social-proof-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 40rem;
    margin-inline: auto;
  }

  .social-proof-metric + .social-proof-metric {
    border-left: 1px solid rgba(255, 255, 255, 0.08);
  }

  .social-proof-logo {
    display: block;
    width: clamp(7.5rem, 12vw, 10.5rem);
    height: 2.75rem;
    object-fit: contain;
    filter: grayscale(1) opacity(0.55);
    transition: filter 240ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .social-proof-logo:hover {
    filter: grayscale(0) opacity(1);
  }

  .social-proof-marquee-group {
    display: flex;
    gap: clamp(2.75rem, 7vw, 5rem);
    padding-right: clamp(2.75rem, 7vw, 5rem);
  }
  ```

  작은 화면에서는 아래 규칙으로 지표를 한 줄씩 배치하고 vertical rule을 top border로 바꾼다. reduced-motion media query에는 `.social-proof-marquee-group + .social-proof-marquee-group { display: none; }`를 추가해 중복 노출을 막는다.

  ```css
  @media (max-width: 639px) {
    .social-proof-metrics { grid-template-columns: 1fr; }
    .social-proof-metric + .social-proof-metric {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      border-left: 0;
    }
  }
  ```

- [ ] **Step 5: 통합 테스트를 통과시킨다.**

  Run: `npx vitest run client/src/components/SocialProofSection.test.tsx client/src/components/SocialProofMetric.test.tsx && npm run check`

  Expected: 두 지표, 두 마키 그룹, 로컬 SVG 경로가 렌더링되고 TypeScript 오류가 없다.

- [ ] **Step 6: 통합 변경을 커밋한다.**

  ```bash
  git add client/src/components/SocialProofSection.tsx client/src/components/SocialProofSection.test.tsx client/src/index.css
  git commit -m "feat: refine social proof metrics and marquee"
  ```

## Task 4: 브라우저 회귀 검증과 최종 확인

**Files:**
- Modify only if a verified defect is found in: `client/src/components/SocialProofSection.tsx`, `client/src/components/SocialProofMetric.tsx`, `client/src/index.css`, or their tests.

**Interfaces:**
- Consumes: Tasks 1–3의 완성된 Social Proof 섹션.
- Produces: desktop·mobile에서 재현 가능한 검증 결과.

- [ ] **Step 1: 개발 서버를 실행한다.**

  Run: `VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=test-key npm run dev`

  Expected: 로컬 랜딩 페이지에 접근 가능한 Vite URL이 출력된다.

- [ ] **Step 2: desktop에서 로고와 카운트업을 검증한다.**

  브라우저에서 리포트 미리보기 직후 섹션으로 이동한다. `0 → 127`, `0 → 2,000`이 한 번만 진행되는지, 모든 로고가 실제 SVG로 보이는지, hover/focus에서 색상이 복원되는지 확인한다.

- [ ] **Step 3: mobile 및 루프 연속성을 검증한다.**

  375px 폭에서 지표가 위아래로 정렬되고, 후기 카드가 한 장씩 보이는지 확인한다. 마키가 한 루프 이상 진행되는 동안 section의 `getBoundingClientRect().top`과 문서 높이가 변하지 않는지 기록해 페이지가 위로 밀리지 않는 것을 확인한다.

- [ ] **Step 4: 최종 자동 검증을 실행한다.**

  Run: `VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=test-key npx vitest run --exclude '.worktrees/**' && npm run check && DATABASE_URL=postgresql://preview:preview@localhost:5432/preview VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=test-key npm run build`

  Expected: 모든 현재 main 테스트, 타입 검사, 프로덕션 빌드가 통과한다.

- [ ] **Step 5: 검증 범위 내 수정이 있었다면 별도 커밋으로 기록한다.**

  ```bash
  git add client/src/components/SocialProofSection.tsx client/src/components/SocialProofMetric.tsx client/src/index.css client/src/components/SocialProofSection.test.tsx client/src/components/SocialProofMetric.test.tsx
  git commit -m "fix: polish social proof motion"
  ```
