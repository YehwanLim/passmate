# 채용공고 맞춤형 자소서 분석 — 설계

## 배경

자소서 분석은 회사·직무 이름만 받는다. 사용자는 실제 채용공고를 붙여 "이 공고에 내 자소서가 어떻게 읽히는가"를 알고 싶어 한다.
채용공고 텍스트는 기업 분석(`lib/company-analysis.js`의 `postingText`)에만 있고 저장되지 않으며 프롬프트에만 쓰인다.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| 입력 방식 (MVP) | 텍스트 붙여넣기 + URL. PDF는 2차 |
| 입력 화면 | 공고를 붙이면 가벼운 모델 호출(flash-lite)로 자격요건·우대사항·키워드 요약을 뽑아 카드로 보여 주고, 문항 작성 중 sticky 요약 바로 참고 |
| 리포트 | 전용 섹션 "공고 적합도"(공고 있을 때만, 합격 기준 다음) + 기존 섹션도 공고를 기준으로 판단 |
| 과금 | 같은 크레딧 1회. 공고는 선택 입력. 요약 추출은 크레딧 없이 로그인 + 레이트리밋(15분 10회) |
| 장기 방향 | 관리자가 큐레이션한 공고 목록에서 선택 → 공고를 독립 테이블로 시작 |
| 점수 | 쓰지 않는다. 요구사항 대조는 `드러남 / 약함 / 언급 없음` 3단계 정성 라벨 |

## 데이터 모델

- `JobPosting`(`job_postings`): `id`, `userId`, `sourceUrl?`, `rawText`(정제 본문 ≤ 6,000자), `summaryJson`, `createdAt`. 사용자 삭제 시 Cascade.
- `Analysis.jobPostingId?` FK(SetNull). 공고 준비 시점에 행이 생기고, 분석 요청이 그 id를 참조한다.

## 공고 준비 API — `POST /api/analyze/posting` (`api/analyze.js?posting=1`)

1. 로그인 필수. 본문은 `{ url }` 또는 `{ text }` 중 하나.
2. 레이트리밋 `analyze-posting` 15분 10회.
3. URL이면 서버가 fetch: http/https만, DNS 해석 후 사설·루프백·링크로컬 IP 차단, 8초 타임아웃, 리다이렉트 3회(매번 재검사), 1.5MB 상한, `text/html`·`text/plain`만. HTML→텍스트는 의존성 없이 처리. 본문 200자 미만 → `POSTING_URL_UNREADABLE` 422.
4. flash-lite로 요약 추출: `{ title, company, role, responsibilities[], requirements[], preferred[], keywords[] }`. 공고가 아니면 `POSTING_NOT_RECOGNIZED` 422. 모델 실패 `POSTING_EXTRACT_FAILED` 502.
5. `JobPosting` 생성 → `200 { job_posting_id, source_url, summary, char_count }`.

Gemini url_context 도구 대신 서버 fetch를 택한 이유: 실패 원인 판별과 테스트 격리(실제 호출 금지)가 쉽다.

## 분석 요청 연결 (`lib/resume-analysis.js`)

- `normalizeRequest` 허용 키에 `jobPostingId`(uuid) 추가. `requestHash`에 포함.
- `verifyResumeRequest`가 소유권을 확인하고 `request.jobPosting`을 부착(해시 계산 뒤라 영향 없음). 남의 id는 404.
- `resumeAnalysisInput`이 `jobPostingId`를 돌려 `Analysis`에 저장.
- `buildUserPrompt`에 `[채용공고 요약]`·`[채용공고 원문]` 블록.

## 프롬프트 (`shared/prompts/reportPrompt.js`)

출력 JSON에 선택 키 `postingFit` 추가. 공고 없으면 `null`.

```json
"postingFit": {
  "headline": "...", "verdict": "...",
  "requirementMatches": [{ "requirement": "...", "status": "드러남 | 약함 | 언급 없음", "evidence": "...", "advice": "..." }],
  "missingKeywords": ["..."],
  "questionAdvice": [{ "questionIndex": 1, "advice": "..." }]
}
```

공고가 주어지면 `companyInsight`·`gaps`·`questionTabs`도 공고의 자격요건·우대사항을 기준으로 판단한다. 지시는 규칙 나열보다 스키마 필드 설명에 쓴다.

## 리포트

- `GET /api/analysis/:id`가 `job_posting: { id, source_url, summary } | null`을 추가로 돌려준다.
- 새 섹션 `section-posting-fit` "공고 적합도"는 합격 기준(02) 다음. 조건부라 내비 배열은 `buildReportNavSections({ hasPostingFit })`로 만들고 번호를 재계산해 각 섹션에 `indexLabel`로 내린다.
- `isRenderableReport`에는 추가하지 않는다(기존 리포트 보호).
- 예시 리포트 픽스처에도 `postingFit`을 넣어 데모한다.

## 분석 폼

- 회사/직무 아래 "채용공고 (선택)" 섹션: [URL | 텍스트] 탭 → "공고 불러오기"(비로그인은 로그인 모달) → 요약 카드 + "다른 공고로 바꾸기".
- 문항 목록 위 sticky 요약 바(키워드 칩 한 줄, 펼치면 자격요건·우대사항).
- 제출 페이로드에 `jobPostingId`.

## 라우팅

`vite.config.ts` `apiRoute()`와 `vercel.json` rewrite에 `/api/analyze/posting` 추가. 새 함수 파일 없음(12개 한도).

## 범위 밖 / 위험

- SPA 공고(원티드 등)는 URL로 못 읽을 수 있어 붙여넣기 안내로 유도.
- DNS 리바인딩은 MVP에서 막지 않음.
- 관리자 콘솔 표시, GA 파라미터, 내 지원서 목록 배지는 별도.
- 마이그레이션 적용은 사용자 승인 후.
