# Persisted Application Data Design

## Goal

`내 지원서`에서 선택한 지원서의 AI 리포트와 문항 원문이 해당 분석에 저장된 실제 데이터만 표시되도록 한다. 조회 실패 또는 오래된 형식의 데이터는 샘플·더미 데이터로 대체하지 않는다.

## Scope

- 프로젝트 카드의 `AI 리포트 보기`는 `latest_analysis_id`로 선택한 분석을 연다.
- 리포트 화면은 `analysisId`가 있으면 `GET /api/analysis/:id` 응답을 유일한 원본으로 사용한다.
- 문항 상세 목록은 저장된 `question_text`와 `input_text`에서 실제 질문과 답변을 문항별로 복원한다.
- 프로젝트 목록 및 문항 목록 조회 실패 시 샘플 프로젝트·샘플 문항을 표시하지 않고 오류 상태를 보여준다.

## Data Flow

1. `MyProjects`는 로그인한 사용자의 프로젝트 목록에서 `latest_analysis_id`를 받는다.
2. 사용자가 `AI 리포트 보기`를 누르면 `/report-new?analysisId=<id>`로 이동한다.
3. `ReportResult`는 `GET /api/analysis/:id`를 호출해 `ai_response_json`, `company_name`, 분석 ID를 받는다.
4. `ai_response_json.questionTabs`가 존재하면 이를 렌더링한다. 조회 실패 또는 유효하지 않은 응답이면 리포트 본문을 렌더링하지 않고 재시도·뒤로가기 안내를 표시한다.
5. 사용자가 `문항 상세 보기`를 누르면 `GET /api/projects/:projectId/analyses`가 실제 저장된 질문과 원문을 반환한다.
6. API는 하나의 `Analysis` 행에 `[문항 N]` 형식으로 저장된 다중 질문·답변을 같은 순서로 나누고, 단일 문항은 그대로 반환한다.

## Error Handling

- `analysisId`가 있는 리포트 조회는 localStorage, sessionStorage, `FALLBACK_DATA`를 대체 원본으로 사용하지 않는다.
- 문항/프로젝트 조회 실패는 사용자에게 실패 상태를 표시하고, 개발자 콘솔에만 상세 원인을 기록한다.
- 저장된 리포트에 `questionTabs`가 없으면 형식 오류 안내를 표시한다. 기존 데이터를 임의로 재생성하거나 다른 분석 결과를 보여주지 않는다.

## UI Behavior

- 리포트 로딩 중에는 리포트 스켈레톤 또는 로딩 안내를 표시한다.
- 리포트 오류 상태에는 `다시 시도`와 `내 지원서로 돌아가기` 동작을 제공한다.
- 문항 상세 화면은 실제 문항과 실제 답변을 `Q1`, `Q2` 순서로 보여준다.
- 샘플 데이터 표식, `mock=true`, 더미 리포트 경로는 운영 사용자 흐름에서 사용하지 않는다.

## Testing

- 분석 ID가 있을 때 DB 리포트만 요청하고, 실패 시 더미 데이터가 렌더링되지 않는 회귀 테스트를 추가한다.
- 다중 문항으로 저장된 `question_text`·`input_text`를 실제 질문/답변 항목으로 분리하는 API 테스트를 추가한다.
- 프로젝트·문항 목록 API 실패 시 mock 상수가 설정되지 않는 화면 테스트를 추가한다.
- 타입 검사와 관련 Vitest 테스트를 실행한다.

## Non-goals

- 과거 리포트를 다시 AI로 생성하거나 수정하지 않는다.
- 데이터베이스 스키마를 변경하지 않는다.
- 이번 범위에서 인증·권한 모델을 재설계하지 않는다.
