# 랜딩 소셜 프루프 및 브랜드 표기 구현 계획

> **에이전트 작업자용:** 이 계획은 작업별로 실행한다. 각 단계는 체크박스(`- [ ]`)로 추적하며, 구현 전에는 반드시 실패하는 테스트를 확인한다.

**목표:** 랜딩 페이지의 합격 기업 지표·로고 가독성을 개선하고, 브랜드 표기를 파란색 콜론의 `Pre:View`로 통일한다.

**아키텍처:** `BrandName` 프레젠테이션 컴포넌트가 브랜드 글자와 파란색 콜론을 렌더링한다. 소셜 프루프는 기존 데이터 모델과 CSS 구조를 유지하되, 숫자와 접미사를 묶는 전용 요소와 자산별 배율을 사용한다. 로고의 색상과 비율은 각 SVG 원본에서 유지한다.

**기술 스택:** React, TypeScript, Tailwind CSS, Vitest, Vite

## 전역 제약

- `pnpm`만 사용하며 의존성·라우팅·설정은 변경하지 않는다.
- 로그인 후 제품 화면과 API는 변경하지 않는다.
- 숫자와 `+`는 같은 줄에 표시한다.
- 브랜드 라벨에서는 `:`만 `text-sky-400`으로 표시한다.
- 기존의 관련 없는 워킹 트리 변경은 덮어쓰거나 스테이징하지 않는다.

---

## 파일 구조

- 생성: `client/src/components/BrandName.tsx` — 파란색 콜론을 포함한 재사용 브랜드 라벨
- 생성: `client/src/components/BrandName.test.tsx` — 브랜드 라벨의 텍스트·접근성·색상 클래스 검증
- 수정: `client/src/components/SocialProofMetric.tsx` — 숫자와 접미사를 한 줄로 묶음
- 수정: `client/src/components/SocialProofMetric.test.tsx` — 접미사 묶음 검증
- 수정: `client/src/constants/socialProof.ts` — 합격 기업 수와 로고 배율 조정
- 수정: `client/src/components/SocialProofSection.tsx` — 브랜드 라벨 사용
- 수정: `client/src/components/SocialProofSection.test.tsx` — 지표·로고 자산 기대값 검증
- 수정: `client/src/pages/Home.tsx`, `client/src/components/FounderSection.tsx`, `client/src/components/ReportShowcase.tsx` — 사용자에게 보이는 랜딩 브랜드 라벨 사용
- 수정: `client/src/pages/homeOnboardingCopy.test.ts`, `client/src/components/ReportShowcase.test.tsx` — 랜딩 렌더링 결과의 브랜드 라벨 검증
- 수정: `client/public/company-logos/{naver,kakao,nhn-commerce,samsung-electronics,hyundai-autoever,hyundai-motor,cj-olive-networks}.svg` — 색상·비율·식별성 개선

### 작업 1: 브랜드 라벨 컴포넌트와 랜딩 텍스트

**파일:**

- 생성: `client/src/components/BrandName.tsx`
- 생성: `client/src/components/BrandName.test.tsx`
- 수정: `client/src/components/SocialProofSection.tsx`
- 수정: `client/src/pages/Home.tsx`
- 수정: `client/src/components/FounderSection.tsx`
- 수정: `client/src/components/ReportShowcase.tsx`

**인터페이스:**

- 제공: `BrandName({ className?: string }): JSX.Element`
- 사용: 모든 사용자 노출 랜딩 브랜드 문구는 `<BrandName />` 뒤에 문맥 텍스트를 이어 붙인다.

- [ ] **1단계: 실패하는 브랜드 라벨 테스트 작성**

```tsx
it("renders an accessible Pre:View label with a blue colon", () => {
  render(<BrandName />);

  const brand = screen.getByLabelText("PreView");
  expect(brand).toHaveTextContent("Pre:View");
  expect(brand.querySelector(".text-sky-400")).toHaveTextContent(":");
});
```

- [ ] **2단계: 테스트가 실패하는지 확인**

실행: `pnpm exec vitest run client/src/components/BrandName.test.tsx`

기대 결과: `BrandName` 모듈을 찾지 못해 실패한다.

- [ ] **3단계: 최소 브랜드 라벨 구현**

```tsx
import { cn } from "@/lib/utils";

export function BrandName({ className }: { className?: string }) {
  return (
    <span aria-label="PreView" className={cn(className)}>
      Pre<span className="text-sky-400">:</span>View
    </span>
  );
}
```

각 랜딩 컴포넌트의 사용자 노출 `PreView` 텍스트를 `<BrandName />`로 바꾸고, 기존의 글꼴·크기·간격 클래스는 부모 요소에 그대로 둔다.

- [ ] **4단계: 테스트 통과 확인**

실행: `pnpm exec vitest run client/src/components/BrandName.test.tsx client/src/components/ReportShowcase.test.tsx client/src/pages/homeOnboardingCopy.test.ts`

기대 결과: 0개 실패.

### 작업 2: 합격 기업 지표와 숫자 줄바꿈 방지

**파일:**

- 수정: `client/src/constants/socialProof.ts`
- 수정: `client/src/components/SocialProofMetric.tsx`
- 수정: `client/src/components/SocialProofMetric.test.tsx`
- 수정: `client/src/components/SocialProofSection.test.tsx`

**인터페이스:**

- 제공: `SUCCESSFUL_COMPANY_COUNT === 20`
- 제공: `SocialProofMetricCard`는 값과 접미사를 `.social-proof-metric-number` 내부에 렌더링한다.

- [ ] **1단계: 실패하는 지표 테스트 작성**

```tsx
it("keeps the metric value and plus suffix together", () => {
  const markup = renderToStaticMarkup(
    <SocialProofMetricCard metric={metric} isActive={false} />
  );

  expect(markup).toContain('class="social-proof-metric-number"');
  expect(markup).toContain("0+");
});
```

`SocialProofSection.test.tsx`의 기대 지표를 `{ value: 20, suffix: "+", label: "합격 기업" }`로 바꾼다.

- [ ] **2단계: 테스트가 실패하는지 확인**

실행: `pnpm exec vitest run client/src/components/SocialProofMetric.test.tsx client/src/components/SocialProofSection.test.tsx`

기대 결과: `social-proof-metric-number` 클래스와 합격 기업 값 불일치로 실패한다.

- [ ] **3단계: 최소 구현**

```tsx
<p className="social-proof-metric-value tabular-nums">
  <span className="social-proof-metric-number">
    {formatSocialProofMetric(displayValue)}{metric.suffix}
  </span>
</p>
```

```css
.social-proof-metric-number { white-space: nowrap; }
```

`SUCCESSFUL_COMPANY_COUNT`를 `20`으로 바꾼다.

- [ ] **4단계: 테스트 통과 확인**

실행: `pnpm exec vitest run client/src/components/SocialProofMetric.test.tsx client/src/components/SocialProofSection.test.tsx`

기대 결과: 0개 실패.

### 작업 3: 합격 기업 로고 자산과 배율

**파일:**

- 수정: `client/public/company-logos/naver.svg`
- 수정: `client/public/company-logos/kakao.svg`
- 수정: `client/public/company-logos/nhn-commerce.svg`
- 수정: `client/public/company-logos/samsung-electronics.svg`
- 수정: `client/public/company-logos/hyundai-autoever.svg`
- 수정: `client/public/company-logos/hyundai-motor.svg`
- 수정: `client/public/company-logos/cj-olive-networks.svg`
- 수정: `client/src/constants/socialProof.ts`
- 수정: `client/src/components/SocialProofSection.test.tsx`

**인터페이스:**

- 제공: 각 로고 경로는 기존 `/company-logos/*.svg` 계약을 유지한다.
- 제공: `SUCCESSFUL_COMPANIES`의 배율은 마키 셸 안에서 해당 워드마크가 읽히는 크기를 만든다.

- [ ] **1단계: 실패하는 로고 기대값 추가**

```tsx
expect(SUCCESSFUL_COMPANIES.find(company => company.id === "samsung-electronics")?.logoScale)
  .toBeGreaterThan(1.15);
expect(readFileSync(new URL("../../public/company-logos/cj-olive-networks.svg", import.meta.url), "utf8"))
  .not.toContain("<image");
```

NAVER·카카오·NHN커머스·현대오토에버 SVG는 각각 브랜드 그린, 카카오 옐로, 밝은 중립색, 밝은 블루 색상을 포함하는지 검증한다.

- [ ] **2단계: 테스트가 실패하는지 확인**

실행: `pnpm exec vitest run client/src/components/SocialProofSection.test.tsx`

기대 결과: 삼성 배율과 CJ올리브네트웍스 래스터 `<image>` 기대값으로 실패한다.

- [ ] **3단계: 최소 자산 구현**

각 SVG를 투명 배경의 가로형 벡터 워드마크로 정리하고 다음을 보장한다.

```text
NAVER: #03C75A
카카오: #FEE500
NHN커머스: #E4E4E7
현대오토에버: #6FA8FF
현대자동차: HYUNDAI + 현대자동차 가로형 표기
CJ올리브네트웍스: <image> 없는 벡터 워드마크
```

`socialProof.ts`에서 삼성전자 배율을 `1.3` 이상으로 올리고, 새 로고 비율에 맞게 필요한 개별 배율만 조정한다.

- [ ] **4단계: 테스트 통과 확인**

실행: `pnpm exec vitest run client/src/components/SocialProofSection.test.tsx`

기대 결과: 0개 실패.

### 작업 4: 전체 변경 검증

**파일:**

- 검증만 수행: 위의 모든 변경 파일

- [ ] **1단계: 영향 테스트 실행**

실행: `pnpm exec vitest run client/src/components/BrandName.test.tsx client/src/components/SocialProofMetric.test.tsx client/src/components/SocialProofSection.test.tsx client/src/components/ReportShowcase.test.tsx client/src/pages/homeOnboardingCopy.test.ts`

기대 결과: 0개 실패.

- [ ] **2단계: TypeScript 검사 실행**

실행: `pnpm check`

기대 결과: 종료 코드 0.

- [ ] **3단계: 변경 범위 확인**

실행: `git diff --check` 및 `git diff -- client/src/components/BrandName.tsx client/src/components/BrandName.test.tsx client/src/components/SocialProofMetric.tsx client/src/components/SocialProofMetric.test.tsx client/src/components/SocialProofSection.tsx client/src/components/SocialProofSection.test.tsx client/src/constants/socialProof.ts client/src/pages/Home.tsx client/src/components/FounderSection.tsx client/src/components/ReportShowcase.tsx client/src/pages/homeOnboardingCopy.test.ts client/src/components/ReportShowcase.test.tsx client/src/index.css client/public/company-logos/naver.svg client/public/company-logos/kakao.svg client/public/company-logos/nhn-commerce.svg client/public/company-logos/samsung-electronics.svg client/public/company-logos/hyundai-autoever.svg client/public/company-logos/hyundai-motor.svg client/public/company-logos/cj-olive-networks.svg`

기대 결과: 공백 오류가 없고, 관련 없는 변경은 수정·스테이징하지 않는다.
