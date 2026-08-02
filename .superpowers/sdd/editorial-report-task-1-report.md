# Task 1 작업 보고서: 해석형 프롬프트 계약 고정

## 상태

완료. `MASTER_SYSTEM_PROMPT`의 JSON 출력 스키마를 유지하면서 해석 중심 작성 원칙을 공용 프롬프트에 반영하고, 이를 검증하는 계약 테스트를 추가했다.

## TDD 기록

1. `client/src/pages/reportPrompt.singleSource.test.ts`에 `keeps editorial interpretation rules in the canonical prompt` 테스트를 추가했다.
2. 구현 전 `pnpm exec vitest run client/src/pages/reportPrompt.singleSource.test.ts`를 실행했다.
3. 새 테스트는 `반복해서 보여주는 하나의 관통 패턴` 문구를 찾지 못해 의도대로 실패했다.
4. `shared/prompts/reportPrompt.js`에 해석형 분석 원칙과 섹션별 제약을 추가했다.
5. 첫 구현 뒤 해시태그 우선순위 문구의 표기 차이로 다시 실패한 것을 확인했고, 계약 문구와 동일하게 보정했다.
6. 집중 테스트와 관련 회귀 테스트가 모두 통과했다.

## 반영 내용

- 경험 전체에서 반복되는 관통 패턴을 먼저 찾고, 각 섹션이 서로 다른 근거와 관점을 제공하도록 지시했다.
- `summaryOneLiner`, `persona`에 `도메인 + 행동 + 특징` 구조를 명시하고 추상적 인재 라벨을 금지했다.
- 해시태그는 산업, 프로젝트, 직무, 기술을 우선하고 추상 역량은 최대 1~2개로 제한했다.
- 소제목은 읽기 쉬움, 의미 전달, 직무 연결을 먼저 판단해 조건을 충족하면 기존 표현을 유지하도록 했다.
- 비유와 스토리텔링은 명확성·가독성·직무 연결성이 있으면 유지하도록 했다.
- `feedbackCards`는 인정, 좋은 이유, 보완점, 보완 방법 순서로 작성하도록 했고, `detailedAnalysis`에는 서로 다른 관점 세 가지 이상을 요구했다.
- 강점과 보완점은 역량 라벨 대신 경험의 근거와 개선 방향을 설명하도록 했다.

## 검증

실행 명령:

```bash
pnpm exec vitest run client/src/pages/reportPrompt.singleSource.test.ts client/src/pages/MyProjects.persistence.test.ts client/src/pages/ReportResult.identity.test.ts
```

결과: 테스트 파일 3개, 테스트 10개 모두 통과.

## 커밋

- `c8cf8c9 feat: make report prompt editorial`
- 커밋에는 `shared/prompts/reportPrompt.js`, `client/src/pages/reportPrompt.singleSource.test.ts` 두 파일만 포함했다.

## 우려 사항

- 이번 작업은 프롬프트 계약과 작성 지침만 고정한다. 실제 모델 출력의 품질 분포는 모델별로 달라질 수 있으므로, 다음 단계에서 실제 자소서 샘플을 통한 출력 품질 검증이 필요하다.
