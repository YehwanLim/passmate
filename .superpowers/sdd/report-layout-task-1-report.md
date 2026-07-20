# Task 1 완료 보고서: 짧은 요약과 세 문단 코멘트 계약

## 상태

완료. 기존 JSON 스키마를 변경하지 않고 공용 `MASTER_SYSTEM_PROMPT`에 요약 길이와 실무자 코멘트 구조 규칙을 추가했다.

## TDD 기록

1. `reportPrompt.singleSource.test.ts`에 다음 계약 단언을 먼저 추가했다.
   - `공백 포함 28자 이내`
   - `공백 포함 42자 이내`
   - `정확히 세 문단`
   - `빈 줄(\\n\\n)`
   - `각 문단은 1~2문장`
2. 집중 테스트를 실행해 새 규칙이 없어 실패하는 것을 확인했다.
   - 실패 원인: 공용 프롬프트에 `공백 포함 28자 이내` 문구가 없었음.
3. 공용 프롬프트의 `firstImpression`과 `pmComment` 설명 및 제약 조건에 최소 변경으로 계약을 추가했다.
4. 집중 테스트를 다시 실행해 통과를 확인했다.

## 구현 내용

- `persona`: 공백 포함 28자 이내의 한 문장.
- `summaryOneLiner`: 공백 포함 42자 이내의 한 문장.
- `pmComment`: 빈 줄(`\\n\\n`)로 나눈 정확히 세 문단, 각 문단 1~2문장.
- `pmComment` 문단 순서: 읽힌 관통 인상 → 더 선명하게 만들 연결고리 → 면접에서 준비할 설명.

## 검증

`pnpm exec vitest run client/src/pages/reportPrompt.singleSource.test.ts`

결과: 테스트 파일 1개, 테스트 3개 모두 통과.

추가 확인: `git diff --cached --check` 통과.

## 자체 검토

- JSON 키, 배열/중첩 구조, 한국어 및 JSON 단독 출력 규칙은 변경하지 않았다.
- 변경 범위는 지정된 프롬프트와 계약 테스트 두 파일로 한정했다.
- `pmComment`의 줄바꿈 표기는 JSON 문자열 규칙과 계약 테스트에 맞춰 `\\n\\n` 의미를 명시했다.

## 커밋

`2c4d0a5 feat: constrain report summary copy`

## Important 이슈 수정: 런타임 JSON 줄바꿈 이스케이프

### 상태

완료. JavaScript 템플릿 리터럴에서 `\n\n`이 실제 개행으로 해석되던 문제를 수정했다. 이제 모델이 받는 `MASTER_SYSTEM_PROMPT`에는 JSON 문자열용 리터럴 이스케이프 문자 `\n\n`이 포함된다.

### TDD 기록

1. `MASTER_SYSTEM_PROMPT`를 직접 import하는 런타임 계약 테스트를 먼저 추가했다.
2. `pnpm exec vitest run client/src/pages/reportPrompt.singleSource.test.ts`를 실행해 실패를 확인했다.
   - 실패 원인: 런타임 프롬프트에 `빈 줄(\n\n)` 대신 실제 줄바꿈이 포함되어 있었음.
3. 공용 프롬프트의 줄바꿈 안내와 `pmComment`의 JSON 예시·제약 문구만 `\\n` 및 `\\n\\n` 이스케이프 표기로 수정했다.
4. 같은 집중 테스트를 다시 실행했다.
   - 결과: 테스트 파일 1개, 테스트 4개 모두 통과.

### 자체 검토

- JSON 스키마와 기존 에디토리얼 규칙은 변경하지 않았다.
- 런타임 테스트는 파일 원문 검사와 별도로 실제 `MASTER_SYSTEM_PROMPT` 값에 리터럴 JSON 이스케이프가 존재하는지 확인한다.
- `git diff --check`를 통과했다.
