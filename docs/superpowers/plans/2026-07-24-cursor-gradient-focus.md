# 커서 중심 그라데이션 강화 구현 계획

> **에이전트 작업자용:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위별로 구현한다. 진행 상태는 체크박스로 관리한다.

**목표:** 랜딩 배경의 넓고 은은한 커서 반응은 유지하면서, 커서 중심부는 더 진하게 보이고 빠르게 움직일 때만 추가로 밝아지게 한다.

**아키텍처:** `SubtleBackground`의 기존 `smoothVelocity` 모션 값을 재사용해 두 개의 중심 불투명도 모션 값을 만든다. 기존 방사형 그라데이션의 중심 색상에만 이 값을 연결하고, 중간 색상 정지점과 투명 전환 지점을 조여 외곽보다 중심 대비가 높게 만든다.

**기술 스택:** React 19, TypeScript, Framer Motion, Vitest, Vite

## 전역 제약

- 변경 범위는 `SubtleBackground`와 그 단위 테스트로 제한한다.
- 기존의 RAF 기반 마우스 입력 배치, 스프링 보간, 이벤트 정리 로직을 변경하지 않는다.
- 새 DOM 요소, 포인터 오브젝트, 타이머, 이벤트 리스너를 추가하지 않는다.
- 넓은 외곽 그라데이션과 bloom band의 크기 및 애니메이션 시간은 유지한다.
- 테스트는 구현 코드보다 먼저 작성하고, 실패를 확인한 후 최소 코드로 통과시킨다.

---

## 파일 구조

- 수정: `client/src/components/SubtleBackground.tsx` — 속도 기반 중심 불투명도와 강화된 방사형 색상 정지점을 제공한다.
- 수정: `client/src/components/SubtleBackground.test.ts` — 강화된 중심부와 속도 기반 강도를 정적으로 회귀 검증한다.

### Task 1: 커서 중심 강도 회귀 테스트 추가

**파일:**

- 수정: `client/src/components/SubtleBackground.test.ts`
- 구현 대상: `client/src/components/SubtleBackground.tsx`

**인터페이스:**

- 소비: 기존 `smoothVelocity: MotionValue<number>`
- 산출: `fieldCenterOpacity`는 `0.32`에서 `0.46`까지, `sweepCenterOpacity`는 `0.23`에서 `0.35`까지 속도에 따라 증가하는 모션 값

- [ ] **1단계: 실패하는 테스트 작성**

`tracks cursor movement with a premium RAF-smoothed glow` 테스트 다음에 아래 테스트를 추가한다.

```ts
  it("keeps a sharper cursor center and intensifies it with pointer speed", () => {
    expect(source).toContain("fieldCenterOpacity");
    expect(source).toContain("sweepCenterOpacity");
    expect(source).toContain("[0.32, 0.46]");
    expect(source).toContain("[0.23, 0.35]");
    expect(source).toContain("rgba(145,183,255,${fieldCenterOpacity}) 0%");
    expect(source).toContain("rgba(124,58,237,${sweepCenterOpacity}) 0%");
    expect(source).toContain("rgba(34,211,238,0.16) 22%");
    expect(source).toContain("transparent 62%");
  });
```

- [ ] **2단계: 테스트가 실패하는지 확인**

실행:

```bash
npx vitest run client/src/components/SubtleBackground.test.ts
```

예상 결과: 새 테스트가 `fieldCenterOpacity` 문자열을 찾지 못해 실패한다.

- [ ] **3단계: 최소 구현 작성**

`SubtleBackground.tsx`에서 `fieldOpacity` 선언 바로 아래에 아래 모션 값을 추가한다.

```ts
  const fieldCenterOpacity = useTransform(
    smoothVelocity,
    [0, 2500],
    [0.32, 0.46]
  );
  const sweepCenterOpacity = useTransform(
    smoothVelocity,
    [0, 2500],
    [0.23, 0.35]
  );
```

`responsiveField`의 첫 번째 방사형 그라데이션을 아래 값으로 바꾼다.

```ts
radial-gradient(circle 26vmax at ${fieldXPct} ${fieldYPct}, rgba(145,183,255,${fieldCenterOpacity}) 0%, rgba(34,211,238,0.16) 22%, rgba(34,211,238,0.10) 38%, transparent 62%),
```

두 번째 방사형 그라데이션을 아래 값으로 바꾼다.

```ts
radial-gradient(circle 18vmax at ${sweepXPct} ${sweepYPct}, rgba(124,58,237,${sweepCenterOpacity}) 0%, rgba(99,102,241,0.10) 28%, rgba(99,102,241,0.055) 46%, transparent 62%),
```

- [ ] **4단계: 테스트가 통과하는지 확인**

실행:

```bash
npx vitest run client/src/components/SubtleBackground.test.ts
```

예상 결과: 모든 `SubtleBackground` 테스트가 통과한다.

- [ ] **5단계: 코드 형식과 전체 타입을 확인**

실행:

```bash
npx prettier --check client/src/components/SubtleBackground.tsx client/src/components/SubtleBackground.test.ts
pnpm check
```

예상 결과: Prettier와 TypeScript가 오류 없이 종료된다.

- [ ] **6단계: 프로덕션 빌드 확인**

실행:

```bash
pnpm build
```

예상 결과: Vite 클라이언트 빌드와 서버 번들이 오류 없이 생성된다.

- [ ] **7단계: 커밋**

```bash
git add client/src/components/SubtleBackground.tsx client/src/components/SubtleBackground.test.ts
git commit -m "feat: sharpen cursor gradient focus"
```
