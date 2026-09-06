# 기업 분석 리포트 — 상품 설계와 판매 계획 (설계)

**작성일:** 2026-09-06 · **상태:** 설계 승인(2026-09-06) · **구현 계획:** `docs/superpowers/plans/2026-09-06-company-analysis-report-plan.md`
**관련 문서:** `2026-09-03-premium-two-tier-pricing.md`, `2026-07-27-groble-signed-premium-credit-design.md`, `2026-07-21-premium-analysis-entitlements-design.md`, `2026-07-20-editorial-report-prompt-design.md`, `2026-07-26-analysis-background-processing-design.md`

## Context

Pre:View는 지금 자소서 진단 리포트 하나만 판다. 취준생은 자소서를 쓰기 **전에** 기업을 조사하고, 쓴 **뒤에** 진단을 받고, 면접 **직전에** 다시 기업을 본다. 앞뒤 두 단계가 비어 있다.

참고 자료 4개를 읽고 확인한 것:

- **취업예감 현대차 보고서(2020, 35p)** — 채용공고 → 기업개요(재무·주주·동종업체) → 기업소개(철학·비전·핵심가치·CEO 메시지) → 사업소개(부문별 실적·사업장) → 뉴스클리핑 → 전형별 TIP → 참고 사이트 → 별첨(사업보고서·지속가능경영보고서·증권리포트). 공홈·DART·기사 화면을 **모아둔 자료집**이고 해석은 거의 없다. 그래도 사람들이 돈 내고 샀던 형식이라 "무엇이 들어가야 안심하는가"의 체크리스트로 유효하다.
- **사용자 본인 문서 3개(삼성전자·포스코인터 식량·현대글로비스)** — 사업 정의 → 관점(밸류체인/식량안보) → 위기·한계 → 기회 → **"생각나는 인사이트 전부 끄적이기" → "맡고 싶은 사업"**. 자료 수집에 시간의 대부분이 들어가고, 실제 자소서 가치는 마지막 두 단계에서 나온다.

따라서 이 상품의 정체는 "자료 모음집"이 아니라 **"모음집 → 인사이트 → 맡고 싶은 사업 → 자소서·면접 소재"까지 대신 해주는 브리프**다. 기존 자소서 리포트의 `companyInsight`(합격 기준) 섹션이 이미 회사 수준 해석을 하고 있으므로, 톤과 규칙은 거기서 파생한다.

**확정된 결정(사용자 답변)**
1. 사실 확보: **Gemini Google Search grounding** 사용, 출처 링크를 리포트에 표기.
2. 무료 정책: **무료 없음 + 샘플 리포트 공개**.
3. 1차 범위: **리포트 생성 + 별도 크레딧 + 단품·번들 결제까지**.

---

## 1. 리포트 내용과 구성

### 입력

| 필드 | 필수 | 비고 |
| --- | --- | --- |
| 기업명 | ✓ | 기존 `CompanyCombobox`(400+ 자동완성) 재사용 |
| 직무 | ✓ | 기존 직무 아코디언 재사용 |
| 채용공고 본문 | 선택 | 붙여넣기 ≤ 4,000자. 있으면 04 섹션이 "수행직무 해석"으로 깊어진다. 취업예감 보고서 1장이 이것 |
| 연결할 자소서 분석 | 선택 | 같은 회사의 기존 `Analysis`를 고르면 06 섹션이 그 리포트의 강점·보완점과 연결 |

### 섹션 (8개, 기존 리포트와 같은 번호 매기기 체계)

| # | 섹션 | 답하는 질문 | 취업예감 대응 | 사용자 문서 대응 |
| --- | --- | --- | --- | --- |
| 표지 | 한 문장으로 보는 {회사} | 이 회사를 한 줄로 말하면? | 표지 | — |
| 01 | 돈 버는 구조 | 무엇을 팔아 어디서 버는가 | 4. 사업소개 | "사업 영역 분석" |
| 02 | 지금 밀고 있는 사업 | 최근 1~2년 회사가 돈·사람·발표를 쏟는 곳은 어디고, 비전 문구는 실제 어떤 움직임으로 드러나나 | 3. 기업소개, 5. 뉴스클리핑(신년사) | "신성장 사업", "수소 사업 이슈" |
| 03 | 숫자로 보는 회사 | 매출·이익은 어느 방향이고, 시장(주가·공시)은 이 회사를 어떻게 보나 | 2. 기업개요(재무요약·주주현황) | "기업 기본 정보(실적)" |
| 04 | 최근 1년의 국면 | 무엇이 바뀌고 있고 지원자에게 무슨 의미인가 | 5. 뉴스클리핑 | "관련 이슈" |
| 05 | 이 직무가 놓인 자리 | 이 직무는 어느 사업의 어떤 문제를 푸는가 + **이 직무와 직접 연결된 최신 소식** | 1. 채용공고(조직소개·수행직무) | "인싸담당자" 요약 |
| 06 | 기회와 리스크, 지원자의 시선으로 | 면접에서 "우리 회사 문제는?"에 뭐라 답하나 | — | "위기 및 한계 / 기회" |
| 07 | 맡고 싶은 사업 후보 | 자소서에 어떤 사업을 어떤 각도로 쓰나 | — | **"인사이트 끄적이기 → 맡고 싶은 사업"** |
| 08 | 면접 전 체크리스트 | 회사 관련 예상 질문과 더 읽을 1차 자료 | 6. 전형별 TIP, 7. 참고 사이트, 별첨 | — |
| 부록 | 출처와 기준일 | 어디서 확인했나 | 각 슬라이드 하단 URL | 각주 URL |

02·03·05의 최신 소식은 **직무를 필터로** 쓴다. 같은 회사라도 "전략기획"과 "IT 시스템 기획" 지원자에게 보여줄 소식이 달라야 한다(취업예감 보고서가 직무별 채용공고를 따로 실은 이유와 같다).

### 섹션별 필드 초안 (프롬프트 JSON 스키마 골격)

```jsonc
{
  "brief": {
    "oneLiner": "회사를 한 문장으로. 회사명을 가려도 어느 회사인지 알 수 있어야 한다 (28자 이내)",
    "keywords": ["사업·시장·고객 소재 키워드 4~6개, 범용 인재상 단어 금지"],
    "asOf": "리포트 기준일(서버가 덮어씀)",
    "positionInIndustry": "업계 안에서의 위치와 경쟁 구도 1~2문장"
  },
  "businessMap": {
    "summary": "돈 버는 구조 요약 2~3문장",
    "segments": [
      { "name": "사업부문", "whatItDoes": "무엇을 하는지", "weight": "규모 감각을 말로(예: 매출의 절반 이상). 숫자는 출처가 있을 때만", "phase": "이 부문의 현재 국면(성장/성숙/전환/축소)", "sourceIds": [1] }
    ],
    "customersAndCompetitors": "핵심 고객과 경쟁사 1~2문장"
  },
  "focusBusinesses": {
    "statedDirection": "비전·핵심가치·CEO 메시지가 말하는 방향 1~2문장",
    "items": [
      { "name": "밀고 있는 사업/신사업", "whatChanged": "최근 1~2년 무엇을 새로 시작·확대했나", "evidence": "투자 규모·조직 신설·인수·발표 등 실제 움직임", "whyNow": "왜 지금 이 사업인가(산업 맥락)", "relevanceToRole": "지원 직무와의 거리(직접/간접/무관)", "sourceIds": [2] }
    ],
    "translatedTalentKeywords": [{ "stated": "인재상 문구", "meaning": "이 회사 사업 언어로 번역한 뜻" }]
  },
  "financialSnapshot": {
    "listed": true,
    "market": "상장 시장·종목명(비상장이면 null)",
    "revenueTrend": "최근 2~3년 매출 방향을 말로(성장/정체/감소)와 그 이유. 수치는 출처가 있을 때만",
    "profitTrend": "영업이익 방향과 이유. 부문별 편차가 있으면 언급",
    "keyFigures": [
      { "label": "매출/영업이익/영업이익률 등", "value": "출처에서 확인한 값", "period": "회계 기간", "sourceIds": [4] }
    ],
    "marketView": "상장사만: 최근 주가·시가총액 흐름과 시장이 주목하는 포인트 1~2문장(사실 서술만, 전망·매수매도 판단 금지)",
    "recentDisclosures": [{ "title": "최근 주요 공시·IR 발표", "when": "YYYY-MM", "sourceIds": [5] }],
    "fundingNote": "비상장사만: 투자 유치·기업가치·주요 투자자 1~2문장",
    "forApplicant": "이 숫자들이 지원자에게 뜻하는 것(채용 규모·조직 확장·긴축 신호 등) 1~2문장"
  },
  "currentIssues": [
    { "title": "이슈 제목", "when": "시점(YYYY-MM)", "fact": "확인된 사실 1~2문장", "whyItMatters": "회사에 왜 중요한가", "forApplicant": "지원자에게 무슨 의미인가", "sourceIds": [2, 3] }
  ],
  "roleInContext": {
    "whereItSits": "직무가 붙는 사업부문·조직",
    "problemsItSolves": ["이 직무가 지금 푸는 문제 3~4개"],
    "whyHiringNow": "지금 이 직무를 뽑는 이유(가설임을 명시)",
    "recentNewsForRole": [
      { "title": "이 직무와 직접 연결된 최신 소식", "when": "YYYY-MM", "fact": "확인된 사실", "whyForRole": "이 직무 지원자가 알아야 하는 이유·자소서/면접에서 쓸 지점", "sourceIds": [6] }
    ],
    "postingReading": "채용공고가 있을 때만: 수행직무 문장을 사업 맥락으로 해석"
  },
  "opportunitiesAndRisks": {
    "opportunities": [{ "headline": "20자 이내", "text": "2~3문장", "sourceIds": [] }],
    "risks": [{ "headline": "20자 이내", "text": "2~3문장, 면접에서 말해도 되는 수위로", "sourceIds": [] }]
  },
  "businessCandidates": [
    { "name": "맡고 싶은 사업/프로젝트", "whyForThisRole": "이 직무에서 이 사업이 소재로 강한 이유", "angle": "자소서에서 잡을 각도 1~2문장", "experienceToPrepare": "연결하면 좋은 경험 유형", "seedSentence": "완성 문장이 아닌 방향 제시" }
  ],
  "interviewPrep": {
    "questions": [{ "question": "회사·산업 관련 예상 질문", "direction": "답변 방향 2~3문장" }],
    "primarySources": [{ "label": "사업보고서/IR/지속가능경영보고서 등", "url": "출처" }]
  },
  "sources": [{ "id": 1, "title": "출처 제목", "url": "…", "publisher": "…" }]
}
```

### 프롬프트 규칙 (기존 `reportPrompt.js`에서 가져올 것 / 새로 둘 것)

- **가져오는 것**: 회사 유일성 테스트("회사명을 가렸을 때 짐작할 수 없으면 실패"), 범용 인재상 단어 금지, 지어낸 수치·조직명 금지, 100% 한국어, 굵게는 문장 전체만·섹션당 10~20%, 이모지 금지, `CONTEXT_IRRELEVANT` 반환 규약.
- **새로 두는 것**
  - 출처 규칙: 숫자·날짜·프로그램명·조직명은 `sourceIds`가 붙을 때만 쓴다. 출처 없는 사실은 "알려진 바로는"으로 낮추고 수치를 빼라.
  - 최신성 규칙: `currentIssues`·`recentNewsForRole`은 기준일 기준 12개월 이내, `focusBusinesses`는 24개월 이내. 더 오래된 사건은 01의 맥락으로만.
  - 직무 필터 규칙: 02·05의 소식은 입력된 직무와의 연결을 `relevanceToRole`/`whyForRole`로 반드시 적는다. 연결이 없는 소식은 04로 보낸다.
  - 재무·주식 규칙: `keyFigures`는 최대 4개, 반드시 회계 기간과 출처를 붙인다. 주가·시가총액은 **기준일의 흐름을 사실로만** 서술하고 전망·목표주가·매수/매도 판단은 금지한다. 서버가 "투자 조언이 아니며 수치는 공시 원문에서 확인" 고지를 붙인다. 비상장사는 `listed:false`로 두고 `marketView`·`recentDisclosures`를 비운다.
  - 관점 규칙: 06·07은 "지원자의 시선"이다. 애널리스트 리포트 톤 금지, 취준생이 면접장에서 말할 수 있는 수위.
  - 비상장·소규모·외국계: 회사 정보가 빈약하면 산업·직무 수준으로 내려가되 문장은 구체적으로. `brief`에 정보 밀도가 낮음을 한 줄로 명시.
- **금지**: 점수·퍼센트 평가(서비스 원칙), 재무 표 통째 재현(취업예감 11p 같은 다년·다지표 표는 핵심 지표 4개 + 1차 자료 링크로 대체), 투자 권유로 읽힐 문장.

### 그라운딩 호출 방식 (핵심 위험 지점)

웹 검색으로 확인한 제약(2026-09 기준):

- Gemini **2.5** 계열은 `google_search` 도구와 구조화 출력(`responseMimeType`/`responseSchema`)을 한 호출에 함께 쓰면 `400 INVALID_ARGUMENT`.
- Gemini **3.x** 계열은 둘을 함께 쓸 수 있지만, 그 경우 `groundingMetadata.groundingChunks`가 **비어 오는 사례**가 보고됨 → 출처 링크를 잃는다.
- 그라운딩 비용: 3.x는 월 5,000건 무료 후 1,000건당 $14, 2.5는 1,000건당 $35.

출처 표기가 이 상품의 신뢰 근거이므로 어느 모델을 쓰든 **2단 호출**로 간다:

1. **조사 호출**(grounded, 자유 텍스트): 회사·직무·최근 이슈를 조사해 출처 URL이 붙은 사실 메모를 만든다. `groundingMetadata.groundingChunks[].web.{uri,title}`를 `sources[]`로 수집.
2. **구성 호출**(JSON): 1의 메모 + 출처 목록을 입력으로 위 스키마 JSON을 생성. 출처는 `sourceIds`로만 참조하게 하고, 서버가 `sources[]`를 덮어쓴다.

시간 예산: 모델 타임아웃 100s / `maxDuration` 120s 안에서 조사 ≤ 55s + 구성 ≤ 35s로 나눠 잡고, 조사 단계 실패 시 "정보 부족" 안내로 실패 처리(크레딧 취소). 모델은 조사에 `gemini-2.5-flash`(lite 아님), 구성에 기존 기본 모델. 정확한 분기·설정 위치는 §5 기술 설계 참조.

비용: 그라운딩 건당 약 20~50원(모델 세대에 따라) + 토큰 약 10원. 판매가 4,900원 기준 원가율 2% 미만.

---

## 2. 디자인

기존 `ReportResult.tsx`의 어휘를 그대로 쓴다. 다른 상품처럼 보이면 안 되고, **같은 브랜드의 다른 호(號)** 처럼 보여야 한다.

- **공통 유지**: `bg-[#09090B]` 다크, `max-w-4xl` 본문, `section-divider`, `SectionNumber`(01~07), 우측 `MiniNavigator`, Pretendard, 의미 색(강점/기회 `emerald`, 주의 `amber`, 리스크 `rose`, 목표 `sky`).
- **표지 카드**: 자소서 리포트의 히어로 카드 구조 재사용. 상단 케르닝 라벨을 `First Read · {회사}` → `Company Brief · {회사} · {직무}`로. 큰 제목은 `brief.oneLiner`, 아래 키워드 칩, 우측 하단에 `기준일 · 출처 N건`.
- **01 돈 버는 구조**: 사업부문 카드 그리드(2열, `rounded-xl border-white/[0.08]`). 카드 안에 국면 배지(성장/성숙/전환/축소)는 색이 아닌 텍스트 배지로.
- **02 밀고 있는 사업**: 상단에 "말하는 방향" 인용 블록(`text-zinc-400`), 아래 사업 카드 2~4장. 카드 우상단에 직무 연관도 배지(직접 = `sky`, 간접 = `zinc`, 무관은 표시 안 함). 인재상 번역은 `stated → meaning` 행 목록.
- **03 숫자로 보는 회사**: 지표 카드 3~4장(큰 숫자 `tabular-nums` + 회계 기간 + 출처 칩) 한 줄, 아래 매출·이익 추세 문단. 차트는 넣지 않는다(출처 수치 신뢰도와 구현량 대비 이득이 작음). 주식·공시는 회색 카드 하나로 묶고 카드 하단에 "투자 조언이 아닙니다" 고지. 비상장사는 카드 대신 `fundingNote` 문단.
- **04 국면**: 좌측 날짜 레일이 있는 세로 타임라인. 각 항목 끝에 출처 칩 `[1] [2]` — 클릭 시 부록으로 스크롤.
- **05 직무 자리**: 문단형 + 문제 목록. 그 아래 "이 직무와 연결된 최신 소식" 소제목으로 2~4건의 작은 타임라인(04와 같은 부품, 밀도만 낮게). 채용공고가 있으면 원문 인용 블록(자소서 리포트의 `original` 하이라이트 스타일 재사용).
- **06 기회/리스크**: 기존 02 합격기준의 2열 구조(`emerald` ✓ / `rose` ✕) 재사용.
- **07 맡고 싶은 사업**: 이 리포트의 클라이맥스. `sky` 강조 카드 2~3장, 각 카드 하단에 `seedSentence`를 인용문 스타일로. 카드 아래에 **자소서 진단 CTA**("이 각도로 쓴 자소서, 채용 담당자 시선으로 확인하기").
- **08 체크리스트**: 질문 아코디언(기존 `interviewQA` 스타일) + 1차 자료 링크 목록.
- **부록 출처**: 번호·제목·발행처·링크. 외부 링크는 `rel="noopener noreferrer"`. 상단에 "AI가 공개 자료를 바탕으로 정리한 브리프이며, 수치는 원문에서 확인하세요" 고지 한 줄.
- **화면 조회 전용**: PDF 다운로드·인쇄·공유 링크 버튼을 두지 않고, 인쇄용 스타일도 추가하지 않는다. 리포트는 로그인한 소유자가 `/company-report?analysisId=`에서만 보고, 이미 있는 `/my`(내 분석) 목록에서 다시 열 수 있다. 다운로드 형태 판매가 아니므로 이용권 안내 문구도 "웹에서 조회"로 통일한다.
- **잠금/게이트**: 무료가 없으므로 섹션 잠금 없음. 비로그인 접근은 기존 `ReportAccessGate` 패턴으로 로그인 유도만.
- **샘플 리포트**: `/company-report/sample`에 정적 JSON 픽스처 렌더(동일 컴포넌트). 상단 리본 "샘플 · {회사} · {기준일}".

---

## 3. 판매 방식

### 추천: 단품 + 번들 병행, 번들 우대

| 방식 | 장점 | 단점 |
| --- | --- | --- |
| A. 단품만 | 구현 최소 | 자소서 구매 순간의 높은 의도를 놓침. 단독으론 "ChatGPT로 하면 되는데"와 경쟁 |
| B. 번들(업셀)만 | 결제 1회로 묶임 | 자소서 쓰기 전 단계(기업 조사만 필요한 사람) 유입을 막음 |
| **C. 둘 다, 번들 우대** ✅ | 두 진입점 모두 잡고 번들로 유도. 데이터로 단품/번들 비율을 보고 후속 결정 | Groble 상품 5종 관리 |

### 가격안 (미정 — Groble 상품가가 진실)

기준: 사용자가 말한 "5,000원 안팎", 자소서 1회권 5,900원과의 관계, 심리적 가격대(9,900/26,900).

| 상품 | Groble 상품 | 가격안 | 지급 | 비고 |
| --- | --- | --- | --- | --- |
| 기업 분석 1회권 | 신규 | **4,900원** | 기업 1 | 정가=판매가. 신상품이라 할인 표기 없음(종전거래가격 없음 → 표시광고법 이슈 회피) |
| 자소서 1회권 + 기업 분석 1회 | 신규 | **9,900원** | 자소서 1 · 기업 1 | 개별 합 10,800원 대비 900원 절약. 실질 add-on 4,000원 |
| 자소서 3회권 + 기업 분석 3회 | 신규 | **26,900원** | 자소서 3 · 기업 3 | 개별 합 29,600원 대비 2,700원 절약 |
| (기존) 자소서 1회권 | 유지 | 5,900원 | 자소서 1 | |
| (기존) 자소서 3회권 | 유지 | 14,900원 | 자소서 3 | |

대안으로 검토한 값: add-on 3,900원(번들 9,800 — 끝자리가 어색), 5,900원(자소서와 동가 — "덤"으로 보이지 않음). 4,900/4,000 조합이 "단품보다 번들이 싸다"는 메시지를 가장 단순하게 만든다.

**프로모션 연동 주의**: 자소서 1회권 5,900원은 11/30까지의 할인가(정가 9,900). 프로모션 종료 시 번들도 함께 재산정해야 한다(1회권 9,900 + 4,900 → 번들 13,900 등). `pricing.ts`에 번들 가격을 두고 11/30 전환 체크리스트에 추가.

**표시 규칙**: 번들 카드의 "N원 절약"은 현재 실제 판매 중인 개별 가격의 합과 비교하므로 표시광고법상 안전하다. 기업 분석 단품에는 취소선을 쓰지 않는다.

### 판매 접점 (의도가 높은 순)

1. **자소서 리포트 하단**(`ReportResult` 07 다음): "이 회사를 더 깊게 보기 — 기업 분석 리포트" CTA. 회사·직무를 프리필해 `/company-analysis`로. 기업 크레딧이 있으면 바로 생성, 없으면 단품 결제.
2. **이용권 페이지·랜딩 가격 섹션**: 카드를 5장으로 늘리지 않고, 유료 카드 2장에 **"기업 분석 리포트 함께 받기 (+4,000원)" 토글**을 둔다. 토글이 켜지면 SKU가 번들로 바뀌고 가격·절약액이 갱신된다. 그 아래 단품 카드 1장("기업 분석만 필요하다면").
3. **분석 폼**(`Analyze.tsx`)에서 회사를 고른 순간: 기업 크레딧이 있으면 "○○ 기업 분석 리포트 먼저 받기" 배너, 없으면 조용한 링크.
4. **크레딧 소진 모달**(`ANALYSIS_CREDITS_EXHAUSTED`): 번들을 기본 선택으로 이용권 페이지 이동.
5. **샘플 리포트**: 랜딩 `ReportShowcase` 옆에 링크. 스레드 연재 소재로도 쓴다(샘플 기업은 스레드에서 반응 좋은 대기업 1곳으로 시작).

### 측정

- 번들 선택률(attach rate), 단품 비율, 기업 리포트 → 자소서 분석 전환율, 리포트당 그라운딩 실패율.
- 관리자 결제 내역(`dashboard-payments`)에 신규 상품 라벨·추정 금액 반영.
- 판단 기준(예): 출시 4주 후 번들 선택률이 30% 미만이면 단품 가격을, 단품 비율이 20% 미만이면 단품 노출을 조정.

---

## 4. 출시 단계 (각 단계가 독립 배포 가능)

| 단계 | 내용 | 게이트 |
| --- | --- | --- |
| M1 | 리포트 파이프라인(2단 그라운딩 호출·저장·폴링·화면) + 관리자 지급 기업 크레딧으로 내부 QA · 샘플 리포트 제작 | `companyAnalysisEnabled=false`(관리자만) |
| M2 | 상품 3종 추가(단품·번들 2) · 웹훅 번들 지급 · 가격 페이지 토글 · 체크아웃 | Groble 상품 등록 후 `companyAnalysisEnabled=true` |
| M3 | 업셀 접점(리포트 하단 CTA·폼 배너·소진 모달) · 샘플 공개 · 스레드 공지 | — |

---

## 5. 기술 설계

원칙: **새 api 파일 0개**(12/12 한도), 기존 분석 파이프라인·크레딧 예약·Groble 웹훅 패턴을 그대로 확장한다. 리포트 JSON 스키마는 §1이 정본이다.

### 5-1. 데이터 모델 — 기존 테이블 재사용 + `kind`

새 테이블(`CompanyReport`, `CompanyReservation`…)을 만들면 `lib/analysis-request-lifecycle.js`(상태 머신·복구)·폴링 핸들러·테스트를 복제해야 한다. 대신:

```prisma
enum AnalysisKind { RESUME COMPANY }

model Analysis            { kind AnalysisKind @default(RESUME)  @@index([userId, kind]) }   // questionText/inputText는 "" 저장, totalChars null
model AnalysisReservation { kind AnalysisKind @default(RESUME)  @@index([userId, kind, source, status]) }
model AnalysisEntitlement { companyCreditsGranted Int @default(0) }
model PaymentEntitlement  { companyCreditsGranted Int @default(0) }   // credits_granted는 자소서 의미 유지
model AdminCreditGrant    { kind AnalysisKind @default(RESUME) }
model EntitlementSetting  { companyAnalysisEnabled Boolean @default(false) }

enum PurchaseProduct { SINGLE TRIPLE COMPANY_SINGLE SINGLE_PLUS_COMPANY TRIPLE_PLUS_COMPANY }

/// 상품별 Groble 연결. 2026-09-03 스펙이 제안했으나 미채택했던 카탈로그를 상품 5개 시점에 채택.
model PurchaseProductSetting {
  product         PurchaseProduct @id
  grobleContentId String? @unique
  paymentUrl      String  @default("")
  active          Boolean @default(true)
}
```

- `AnalysisRequest`에는 `kind`를 두지 않는다(폴링은 `analysis.kind`로 충분). `requestHash`에 kind를 섞어 멱등 충돌 방지.
- `Project(company, jobKeyword)` 그대로 재사용, 제목 `${company} ${jobKeyword} 기업 분석`.
- 마이그레이션 3개로 분리: ① enum `analysis_kind` + 컬럼들 + `company_analysis_enabled`, ② `ALTER TYPE purchase_product ADD VALUE` ×3 (**같은 마이그레이션에서 값 사용 금지** — Postgres 제약), ③ `purchase_product_settings` 생성 + 기존 `groble_payment_url`/`groble_single_payment_url`을 TRIPLE/SINGLE 행으로 백필. 기존 두 컬럼은 `@deprecated` 주석만.
- 트레이드오프: `Analysis`에 자소서 전용 컬럼이 빈 값으로 남는다. 관리자 실패 로그 화면에 kind 배지로 보완.

### 5-2. 크레딧 풀 — `lib/analysis-entitlements.js`

- 기업 풀은 무료 티어가 없어 버킷 1개: `source: PREMIUM, kind: COMPANY`. 관리자 지급도 같은 컬럼(`AdminCreditGrant.kind`로 이력 구분).
- `getUsage(tx, userId, source, kind = "RESUME")` — 기존 호출은 무변경.
- `reserveAnalysis(tx, userId, kind = "RESUME")` — COMPANY이고 잔여 0이면 `EntitlementUnavailableError("COMPANY_CREDITS_EXHAUSTED")`.
- `grantGroblePurchase(tx, { resumeCredits, companyCredits, providerPaymentId, rawEvent, userId })` — INSERT … ON CONFLICT(provider_payment_id) 뒤 **한 번의** `update({ premiumCreditsGranted: {increment}, companyCreditsGranted: {increment} })` → 번들 지급이 원자적·멱등. `assertCreditAmount`(≥1 강제)는 못 쓰므로 `assertGrantAmounts`(각 ≥0, 합 1~10000) 신설.
- `GET /api/entitlements` 응답은 **가산만**: 기존 7키 유지 + `companyAnalysisEnabled`, `companyRemaining`, `checkoutUrls: { single, triple, company, singlePlusCompany, triplePlusCompany }`(각 `string|null`). `remaining`은 자소서 합계 의미 유지. `client/src/lib/entitlements.ts` 파서는 신규 필드를 tolerant(`?? 0`, `=== true`)로 읽는다 — `feedbackRewardClaimed` 선례.

### 5-3. 상품 — `lib/entitlement-products.js`

```js
export const PURCHASE_PRODUCTS = {
  SINGLE:              { resumeCredits: 1, companyCredits: 0 },
  TRIPLE:              { resumeCredits: 3, companyCredits: 0 },
  COMPANY_SINGLE:      { resumeCredits: 0, companyCredits: 1 },
  SINGLE_PLUS_COMPANY: { resumeCredits: 1, companyCredits: 1 },
  TRIPLE_PLUS_COMPANY: { resumeCredits: 3, companyCredits: 3 },
};
// 쿼리 키: single | triple | company | single-plus-company | triple-plus-company (undefined→TRIPLE 호환)
export function parsePurchaseProductQuery(value)
export function resolveProductForContentId(contentId, contentIdByProduct)          // env 두 개 → 맵으로 시그니처 변경
export async function readPurchaseProductSettings(db)  // DB 행 + 레거시 env(GROBLE_PREMIUM/SINGLE_CONTENT_ID) 병합
```

- `lib/groble-webhook-handler.js`: `createGrobleWebhookHandler({ readProductSettings, … })`, 지급 시 `grantGroblePurchase(tx, { ...PURCHASE_PRODUCTS[event.product], … })`, 응답에 `grantedCompanyCredits`. 에러 코드 문자열 유지(함정 5).
- `api/entitlements.js` 구매 의도: `paymentUrl = settings[product]?.paymentUrl`, 없으면 기존 503 `PREMIUM_CHECKOUT_NOT_CONFIGURED`.
- 관리자 `dashboard.js`/`user-detail.js`의 상품 역추적은 `readPurchaseProductSettings` 사용, `byProduct`에 3키 추가.
- 트레이드오프: 컬럼 3개+env 3개로도 되지만 다음 상품마다 스키마·env가 늘어난다. 5개가 되는 지금이 카탈로그 전환 적기.

### 5-4. API 표면 — 신규 파일 0

- `POST /api/analyze/company` → `vercel.json` rewrite `"/api/analyze?kind=company"`, `vite.config.ts` `apiRoute()`에 `{ file: "api/analyze.js", query: { kind: "company" } }` (함정 1, split 선례 바로 아래).
- 본문 `{ company(1~100), jobKeyword(1~100), postingText?(≤4000), resumeAnalysisId?(uuid, 소유권·kind=RESUME 검증) }`, `Idempotency-Key` 규칙 동일.
- `createAnalyzeHandler`를 복제하지 않고 **kind 스펙 주입**으로 일반화: `{ kind, normalizeRequest, buildProjectTitle, analysisInput, isEnabled, disabledCode, creditsExhaustedCode, model, getAnalysisThroughputPolicy }`. 기본값은 전부 자소서 현행 → 기존 테스트 무변경.
- 기업 전용 조각은 `lib/company-analysis.js`: `normalizeCompanyRequest`, `companyRequestHash`, `analyzeCompany(request, db)`, `COMPANY_ANALYSIS_THROUGHPUT`(동시 2·15분 5회, route `company-analysis`), `buildCompanyProjectTitle`. 팩토리 합성은 순환 import를 피해 `api/analyze.js` 하단에서:
  ```js
  if (req.query?.split === "1") return resumeSplitHandler(req, res);
  if (req.query?.kind === "company") return companyAnalyzeHandler(req, res);
  return analyzeHandler(req, res);
  ```
- `GET /api/analysis-requests/:id`, `GET /api/analysis/:id`, `GET /api/projects` 응답에 `kind` 가산. 클라이언트 `parseAnalysisRequestStatus`는 알려진 키만 읽어 안전하나 `tests/api/analysis-request-status.test.js`·`protected-user-routes.test.js`의 `toEqual`은 갱신.
- 신규 에러 코드: `COMPANY_CREDITS_EXHAUSTED`(409), `COMPANY_ANALYSIS_DISABLED`(503). 회사 식별 불가는 모델이 `CONTEXT_IRRELEVANT`를 내도록 프롬프트에 규정 → lifecycle·폴링 파서 무변경.

### 5-5. Gemini 호출 — `lib/company-analysis.js`

§1의 제약(2.5는 검색+JSON 동시 불가, 3.x는 출처 유실 사례)을 흡수하는 **하이브리드**:

1. 1차: `COMPANY_RESEARCH_MODEL`(하드코딩 상수, `resume-split.js`의 `SPLIT_MODEL` 선례) + `tools:[{ google_search: {} }]`, `responseMimeType` 없음, 프롬프트에 "JSON만 출력", `thinkingBudget` 낮게. 응답은 `parts[].text`를 **모두 join**(grounded 응답은 parts가 여러 개).
2. `parseModelJsonTolerant`: 코드펜스 제거 → 첫 `{`~마지막 `}` → `JSON.parse`.
3. 실패 시에만 2차 "복구" 호출: 기본 모델 + `responseMimeType: application/json`, 입력 = 1차 원문. 출처는 여전히 1차의 `groundingMetadata`.
4. `sources[]`는 서버가 `groundingChunks[].web.{uri,title}`에서 채움(중복 제거·최대 12). `webSearchQueries`, `searchEntryPoint.renderedContent`를 `reportMeta`에 저장.
5. 데드라인: 총 95s 공유 `fetchWithDeadline`. 1차 ≤ 65s, 2차는 잔여(20s 미만이면 생략 → `PARSE_ERROR`). 100s 모델 < 125s TTL < 120s maxDuration 유지(함정 4).
6. 품질이 부족하면 §1의 2단(조사 → 구성) 방식으로 전환할 수 있게 `analyzeCompany` 내부를 단계 함수로 나눈다. 재무·주식·직무 소식이 추가되어 조사 범위가 넓어졌으므로, 1차 호출 프롬프트에 검색 지시를 주제별로 명시한다(사업부문 / 최근 주력 사업 / 최근 실적·공시·주가 / 직무 관련 소식 / 최근 이슈). 출력 JSON이 커지는 만큼 `thinkingBudget`은 낮게 유지하고, 수동 프로브에서 1차 지연이 65s를 자주 넘기면 2단 방식으로 확정한다.
7. 재무 수치는 검색 스니펫에서 오므로 회계 기간 표기가 어긋날 수 있다. 서버는 값을 검증하지 않고 출처 칩으로 원문 확인을 유도한다. DART OpenAPI 연동(정확한 재무)은 후속 과제로 남긴다.

프롬프트: `shared/prompts/companyReportPrompt.js` `COMPANY_REPORT_SYSTEM_PROMPT`(§1 스키마·규칙). 서버 미러는 만들지 않음. 타입 `client/src/types/companyReport.ts`.

**컴플라이언스 확인(오너)**: Grounding with Google Search 약관은 그라운딩 결과를 사용자에게 보일 때 `searchEntryPoint.renderedContent`(Google 검색 제안 칩)를 표시하도록 요구한다. 부록 출처 섹션 하단에 그대로 렌더하고, `vercel.json` CSP(`style-src`·`img-src`·링크 도메인)가 막지 않는지 PR3 수동 프로브에서 확인(함정 6).

### 5-6. 클라이언트

**추출**(호출자 2곳이 되어 규약상 정당): `Analyze.tsx`의 `CompanyCombobox`·직무 콤보박스 → `client/src/components/analyze/`.

**생성**
- `pages/CompanyAnalyze.tsx` — `/company-analysis`. 회사·직무·채용공고(선택)·연결할 자소서 분석(선택, `/api/projects`의 RESUME만). `COMPANY_CREDITS_EXHAUSTED` → `/entitlements#company`.
- `pages/CompanyReport.tsx` — `/company-report?analysisId=` 및 `?sample=1`(비로그인 허용, 정적 픽스처). `ReportResult` 어휘 재사용(§2). 하단 CTA → `/analyze`(회사·직무 프리필).
- `pages/companyReportNavigation.ts`(01~08), `constants/companyReportSample.ts`, `components/CompanyReportShowcase.tsx`(랜딩 미리보기). 다운로드·인쇄 관련 컴포넌트는 만들지 않는다.

**수정**: `App.tsx` 라우트 2개 · `lib/analysisRequest.ts` `kind?` · `AnalysisPending.tsx` SUCCEEDED 분기(`COMPANY` → `/company-report`) · `lib/entitlements.ts`(5-2) · `lib/pricing.ts`(`companyUses`, 상품 3종, `PurchaseProduct` 5종, `COMPANY_REPORT_INCLUDED_FEATURES`) · `Entitlements.tsx`(유료 카드에 add-on 토글 + 단품 카드, `#company` 앵커, `canPurchase`를 `checkoutUrls[key]`로) · `PricingSection.tsx` · `Checkout.tsx` `PRODUCT_KEYS` · `MyEntitlements.tsx` 기업 잔여 행 · `types/my.ts`·`ProjectCard.tsx`·`MyProjects.tsx` kind 배지·목적지 분기 · `ReportResult.tsx` 하단 업셀 CTA · `Home.tsx` `HOME_NAV_ITEMS` "기업 분석" · 관리자 `SettingsPage`/`admin-entitlements.ts`/`lib/admin-handlers/entitlements.js`에 `companyAnalysisEnabled` 토글(단일 키 PATCH 유지) · `lib/admin-handlers/credits.js` `kind?`.

### 5-7. 테스트

| 파일 | 내용 |
| --- | --- |
| `lib/entitlement-products.test.js` (확장) | 5상품 쿼리 파싱, 맵 기반 contentId 역추적, DB+env 병합 |
| `lib/analysis-entitlements.test.js` (확장) | COMPANY 예약 소진 → `COMPANY_CREDITS_EXHAUSTED`(자소서 잔여와 무관), 번들 지급 update 1회·두 increment, 중복 providerPaymentId → 둘 다 0, 관리자 kind 지급 |
| `tests/api/groble-webhook-handler.test.js` (확장) | 번들 contentId 결제 → `{resumeCredits:1, companyCredits:1}`, 미설정 상품 422 유지 |
| `tests/api/entitlements.test.js` (확장) | 요약 신규 필드, `?product=company` 201, URL 미설정 503 |
| `tests/api/analyze-company.test.js` (신규) | 401/405, 본문 검증(누락·초과·미소유 resumeAnalysisId 404), 503 disabled, 409 exhausted, 202 접수증 + `analysis.create({kind:"COMPANY", questionText:""})`, `?kind` 없으면 자소서 경로 회귀 |
| `tests/api/company-analysis-grounding.test.js` (신규) | tolerant 파서, `extractGroundingSources`(중복·상한·web 없는 chunk), 다중 parts 결합, 1차 실패 → 2차 1회, 데드라인 부족 → `PARSE_ERROR` |
| `tests/api/analysis-request-status.test.js`·`protected-user-routes.test.js` (갱신) | `toEqual`에 `kind` |
| `client/src/lib/entitlements.test.ts`·`analysisRequest.test.ts`·`pricing.test.ts`·`pages/analysisPending.test.ts` (확장) | 구버전 응답 호환, kind 기본값, 번들가 ≤ 단품 합, kind별 목적지 |
| `client/src/pages/companyReportPrompt.test.ts` (신규) | 프롬프트 예시 JSON 파싱·렌더 가능, `api/analyze.js`에 본문 인라인 없음 |
| `scripts/vercel-function-limit.test.js` | 변경 없음(12 유지 확인) |

### 5-8. PR 순서 (§4 단계에 매핑)

| PR | 단계 | 범위 | 검증 |
| --- | --- | --- | --- |
| PR1 크레딧 풀 | M1 | 마이그레이션 ①, `analysis-entitlements.js` kind, 요약 신규 필드, 관리자 credits kind·`companyAnalysisEnabled` 토글, 클라이언트 파서 | `pnpm exec prisma generate && pnpm exec vitest run lib/analysis-entitlements.test.js tests/api/entitlements.test.js tests/api/admin client/src/lib/entitlements.test.ts && pnpm check` |
| PR2 생성 백엔드 | M1 | `lib/company-analysis.js`, 프롬프트, `createAnalyzeHandler` 일반화, 라우팅 2곳, 폴링/조회/프로젝트 kind | `pnpm exec vitest run tests/api/analyze-company.test.js tests/api/company-analysis-grounding.test.js tests/api/analyze-*.test.js tests/api/analysis-request-status.test.js tests/api/protected-user-routes.test.js scripts/vercel-function-limit.test.js client/src/pages/reportPrompt.singleSource.test.ts` + `scripts/manual/`에 그라운딩 1회 수동 프로브(JSON 조합 지원·지연·검색칩 CSP 기록) |
| PR3 화면 | M1 | 콤보박스 추출, `CompanyAnalyze`, `CompanyReport`, `AnalysisPending` 분기, MyProjects 배지 | `pnpm exec vitest run client/src/pages client/src/lib/analysisRequest.test.ts && pnpm check` → 관리자 지급 크레딧으로 QA·샘플 제작 |
| PR4 상품·결제 | M2 | 마이그레이션 ②③, `PurchaseProductSetting`, `entitlement-products.js`, 웹훅 번들, purchase-intent, `pricing.ts`, Entitlements/PricingSection/Checkout/MyEntitlements | `pnpm exec vitest run lib/entitlement-products.test.js tests/api/groble-webhook-handler.test.js tests/api/entitlements.test.js tests/api/admin/dashboard-payments.test.js tests/api/admin/user-detail.test.js client/src/lib/pricing.test.ts && pnpm check` |
| PR5 진입점·샘플 | M3 | 샘플 픽스처·Showcase, GNB, ReportResult 업셀 CTA, 폼 배너, 소진 모달 기본값 | `pnpm exec vitest run client/src && pnpm check` |

`pnpm build`는 로컬에 `DATABASE_URL`이 있을 때만. 실결제·웹훅은 Groble 상품 5종 등록 후 실거래 1건으로 확인.

---

## 6. 남은 위험 / 오너 결정

1. **가격 확정** — §3 가격안(4,900 / 9,900 / 26,900)은 제안. Groble 상품가가 진실이므로 `pricing.ts`는 확정 전까지 플레이스홀더. 11/30 프로모션 종료 시 번들 재산정 체크리스트 추가.
2. **Google 검색 제안 칩 표시 의무**와 CSP 충돌 가능 — PR2 수동 프로브에서 확인 후 `vercel.json` 조정.
3. **그라운딩 품질** — 비상장·소규모 기업에서 정보 밀도가 낮을 때 리포트가 얇아진다. 프롬프트의 "정보 밀도 낮음 명시" 규칙과 샘플 QA로 방어. 실패는 크레딧이 취소되므로 과금되지 않는다.
   **재무·주식 섹션** — 검색 기반 수치는 회계 기간·단위 오류 가능성이 있고, 주가 서술은 투자 조언으로 읽힐 위험이 있다. 수치 4개 상한 + 출처 필수 + 고지 문구로 방어하고, 정확도가 문제가 되면 DART 연동을 후속으로 검토한다.
4. **`PurchaseProductSetting` 행 세팅 전** 신규 3상품 결제가 오면 422 — Groble 등록 → SQL 행 입력 → `companyAnalysisEnabled` ON 순서를 운영 절차로 고정.
5. **관리자 집계 의미 변화** — `analysis.count`가 기업 리포트를 포함하게 됨. 대시보드에 kind 분리 표시는 후속.

---

## 7. 1차(서버) 구현 후 확인 사항 — 2026-09-06 프로브 결과와 결정

1차 서버 플랜은 `origin/main` `b310168`까지 반영되었고 마이그레이션도 적용되었다. `scripts/manual/company-analysis-probe.mjs`를 현대자동차·전략기획으로 1회 실행한 결과:

| 항목 | 측정값 | 결정 |
| --- | --- | --- |
| 1차 호출 지연 | 48.6s, 복구 호출 없음(`repaired: false`) | §5-5 하이브리드(단일 그라운딩 호출 + 실패 시 복구) 유지. 2단 호출로 바꾸지 않는다 |
| 토큰 | prompt 3,642 / completion 7,647 / total 16,424 | 예산 안. 변경 없음 |
| 섹션 개수 | 사업부문 2·주력 3·지표 4·이슈 3·직무 소식 3·후보 3·질문 6 | 프롬프트 제약 준수 확인 |
| 출처 | 서버가 저장한 `sources[]`는 12개(상한), 모델이 본문에 쓴 `sourceIds`는 1~47 | **`sourceIds`는 화면에 각주 번호로 쓰지 않는다**(아래) |
| 검색 제안 칩 HTML | 9.8KB, 인라인 `<style>` 1개 + `<a>` 12개(vertexaisearch.cloud.google.com), 스크립트·이미지 없음 | 현재 CSP(`style-src 'unsafe-inline'`)로 표시 가능. **`vercel.json` CSP 변경 불필요** |

### 7-1. 출처 표기 방식 확정

모델이 붙이는 `sourceIds`는 모델이 스스로 매긴 번호라 서버가 `groundingChunks`에서 뽑은 `sources[]` 번호와 대응하지 않는다(프로브에서 47 vs 12). 따라서:

- **화면(2단계)은 항목별 각주 칩을 그리지 않는다.** 부록 "출처와 기준일"에 `sources[]` 전체를 번호·제목·발행처·링크로 나열하고, 각 섹션 끝에는 "출처는 부록 참고" 한 줄만 둔다. §2의 "출처 칩 `[1] [2]`" 설계는 폐기한다.
- 프롬프트의 `sourceIds` 규칙은 **유지**한다. 번호 자체는 쓰지 않지만 "출처가 있을 때만 수치를 쓴다"는 규율을 모델에 강제하는 장치로 유효하다. JSON 스키마도 그대로 둔다(하위 호환).
- `lib/company-analysis.js`의 `MAX_SOURCES`를 12 → **20**으로 올린다. 프로브에서 모델이 40개 이상 자료를 봤으므로 12개는 부록이 너무 얇다. 20개면 화면 한 섹션 분량이다. (2단계 플랜의 첫 Task)
- 그라운딩 URL(`vertexaisearch.cloud.google.com/grounding-api-redirect/…`)은 수 주 뒤 만료될 수 있다. 부록은 **제목·발행처를 앞에, 링크는 뒤에** 두고 `reportMeta.asOf`(기준일)를 부록 상단에 표기한다.
- 검색 제안 칩(`reportMeta.searchEntryPointHtml`)은 Google 약관상 표시 의무가 있다. 부록 하단에 그대로 렌더한다(`dangerouslySetInnerHTML`, 스크립트 없음 확인됨). `rel="noopener noreferrer"`는 칩 안 링크에는 붙일 수 없으므로 칩 컨테이너를 `<div>`로 감싸기만 한다.

### 7-2. 2단계 플랜 범위(화면)

`docs/superpowers/plans/2026-09-06-company-analysis-screens-plan.md`로 작성한다. 포함: `MAX_SOURCES` 20, `/company-analysis` 신청 폼, `/company-report` 리포트 화면(8섹션 + 부록), `AnalysisPending` kind 분기, `/my` 목록 kind 배지, 관리자 설정의 `companyAnalysisEnabled` 토글, 관리자 크레딧 지급 UI의 kind 선택, `MyEntitlements` 기업 잔여 행, 자소서 폼(`Analyze`)의 이전 지원서 목록에서 기업 프로젝트 제외 + 쿼리 프리필. 제외(③④로): 상품·결제·가격 카드·`ReportResult` 하단 업셀 CTA·랜딩 노출·GNB·**정적 샘플 픽스처(`?sample=1`)** — 샘플은 실제 생성 결과를 사용자가 검수해 픽스처로 굳혀야 하므로 ④에서 프로브 `--out` 저장 옵션과 함께 다룬다.

### 7-3. 가격·상품 구성 확정(2026-09-06) — 티어형. §3 가격안·§5-3 `PURCHASE_PRODUCTS`·§5-6의 add-on 토글 설계를 덮어쓴다

2단계(화면)까지 `origin/main`에 반영(`46a2372`)한 뒤 오너와 여러 안(단품+번들 토글, 3티어 순수형, 세트형, 계단형)을 비교해 **"베이직 → 스탠다드 → 프리미엄" 티어형**으로 확정했다. 판단 기준: 저항감(기존 가격 5,900·14,900 유지), 한 축으로만 올라가는 사다리(단위 = 분석 1회, 어느 종류든 5,900원 가치), 모든 티어에 기업 분석이 있을 것, 위로 갈수록 회당 가격이 내려갈 것.

| 티어 | `PurchaseProduct` | 쿼리 키 | 구성(자소서·기업) | 가격 | 따로 살 때 | 절약 | 회당 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 베이직 | `SINGLE` | `single` | 1 · 0 | 5,900(현행, 11/30까지 정가 9,900의 할인가) | | | 5,900 |
| 베이직 | `COMPANY_SINGLE` | `company` | 0 · 1 | 5,900(신규, 정가=판매가) | | | 5,900 |
| 스탠다드 | `STANDARD` | `standard` | 2 · 1 | 14,900 | 17,700 | 2,800 | 4,967 |
| 프리미엄 | `PREMIUM` | `premium` | 3 · 3 | 25,900 | 35,400 | 9,500 | 4,317 |
| (구) 3회권 | `TRIPLE` | `triple` | 3 · 0 | 14,900 — **판매 종료(레거시)** | | | |

- **베이직은 카드 한 장에 선택 버튼 두 개**("자소서 진단 1회" / "기업 분석 1회"). 뒤에서는 상품 2개(`SINGLE`·`COMPANY_SINGLE`). 할인 배지(정가 9,900)는 자소서 선택 시에만 보인다.
- **스탠다드는 지금 파는 3회권(자소서 3회, 14,900)의 구성 변경**이다. 가격은 같으므로 인상이 아니다. 그로블에서는 기존 3회권 상품(contentId 유지)의 이름·설명을 "자소서 2회 + 기업 분석 1회"로 고친다. 이미 지급된 크레딧은 영향 없음. 자소서만 3회 원하면 베이직을 하나 더 산다.
- `TRIPLE`은 과거 결제 기록의 라벨("3회권(구)")과 전환 기간의 지급을 위해 enum·카탈로그에 남기되 판매하지 않는다(`active=false`).
- 그로블 신규 등록 상품: **2개**(기업 분석 1회 5,900, 프리미엄 25,900). 1회권은 그대로.
- 절약 표시: "따로 사면 17,700원 / 35,400원"은 실제 판매 중인 베이직(5,900) 단위 합과 비교하므로 표시광고법상 안전. 기업 단품에는 취소선 없음.
- 프로모션 연동: 11/30에 1회권이 9,900으로 돌아가면 베이직 자소서 가격만 바뀌고 티어 사다리는 유지(스탠다드·프리미엄 재산정 여부는 그때 판단).

**전환(컷오버) 절차** — 코드가 배포된 뒤 관리자가 순서대로:
1. `pnpm exec prisma migrate deploy`(배포 **전**, 새 테이블 `purchase_product_settings`를 코드가 읽는다). 마이그레이션은 `STANDARD` 행에 기존 3회권 결제 URL을, `SINGLE` 행에 1회권 URL을 백필하고 둘 다 `active=true`로 둔다. `TRIPLE`·`COMPANY_SINGLE`·`PREMIUM` 행은 URL 없음·`active=false`.
2. 배포 직후: 스탠다드 카드가 기존 3회권 URL로 팔리지만, 그 contentId는 아직 env(`GROBLE_PREMIUM_CONTENT_ID`) fallback으로 `TRIPLE`(자소서 3)에 대응하므로 **초과 지급(자소서 3)** 상태다. 부족 지급은 어느 순간에도 생기지 않는다.
3. 그로블에서 3회권 상품 이름·설명을 스탠다드로 고친 뒤, 관리자 설정 화면에서 `STANDARD` 행에 그 contentId를 입력한다 → 이때부터 2+1 지급. DB 행의 contentId가 env 값과 겹치면 DB 행이 이기고 env fallback은 무시된다.
4. 그로블에 기업 분석 1회·프리미엄 상품을 등록하고 contentId·결제 URL을 입력, `active`를 켠다. 마지막으로 `companyAnalysisEnabled`를 켠다(기업 크레딧이 든 상품은 이 스위치가 꺼져 있으면 팔리지 않는다).

**3단계 플랜**: `docs/superpowers/plans/2026-09-06-company-analysis-products-plan.md`. 포함: 마이그레이션(enum 3값 + 상품 설정 테이블 백필), `entitlement-products.js` 카탈로그·설정 읽기, 웹훅 번들 지급, `checkoutUrls`·상품별 게이트, 관리자 상품 설정 엔드포인트·화면, `pricing.ts` 티어, 이용권 페이지 티어 카드 3장(베이직 선택 버튼), `Checkout`, 결제 내역 라벨. 제외(④): 랜딩 `PricingSection`·GNB·업셀 CTA·샘플.
