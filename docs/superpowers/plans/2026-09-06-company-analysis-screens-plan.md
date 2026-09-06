# 기업 분석 리포트 — 2차 구현 플랜 (화면)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 기업 분석 리포트를 **신청하고(`/company-analysis`) → 대기하고(`/analysis-pending`) → 화면에서 읽고(`/company-report`) → 내 지원서 목록에서 다시 여는** 흐름을 완성하고, 관리자가 스위치·크레딧을 화면에서 다룰 수 있게 한다. 결제·상품·랜딩 노출·샘플은 후속 플랜.

**Architecture:** 서버는 1차 플랜으로 끝났다(`POST /api/analyze/company`, 응답 `kind`, 관리자 API). 이 플랜은 클라이언트만 건드린다. 자소서 리포트(`ReportResult.tsx`)의 **시각 어휘를 재사용하되 파일은 분리**한다 — 소스 문자열 테스트가 기존 파일의 마커·문자열에 묶여 있어 기존 파일은 최소로만 고친다. 리포트 텍스트는 기존 `parseHighlightedText`로 `**굵게**`와 태그 제거를 그대로 적용한다.

**Tech Stack:** React 19 · Vite · Wouter · Tailwind 4 · framer-motion · lucide-react · Vitest(소스 문자열 테스트 + jsdom RTL) · pnpm

**Spec:** `docs/superpowers/specs/2026-09-06-company-analysis-report-design.md` — §1(입력·8섹션), §2(디자인), §5-6(클라이언트), **§7(프로브 결과·출처 표기 확정·2차 범위)**.

## Global Constraints

- `pnpm`만. npm·락파일 변경 금지. DB 명령 금지. 실제 Gemini 호출 금지(`scripts/manual/company-analysis-probe.mjs` 실행 금지).
- **화면 조회 전용**(스펙 §2): `CompanyReport`에 PDF·인쇄·다운로드·공유 버튼과 `window.print`를 넣지 않는다.
- **출처 표기**(스펙 §7-1): 항목별 각주 칩을 그리지 않는다. 부록에 `sources[]` 전체를 번호·제목·발행처·링크로 나열하고 섹션 끝에는 "출처는 부록 참고" 한 줄. `reportMeta.searchEntryPointHtml`은 부록 하단에 `dangerouslySetInnerHTML`로 그대로 렌더(스크립트 없음 확인됨). 부록 상단에 기준일(`reportMeta.asOf` 또는 `brief.asOf`)과 고지 문구.
- 서버 응답 필드명(snake_case)·에러 코드 문자열은 계약이다: `COMPANY_CREDITS_EXHAUSTED`(409), `COMPANY_ANALYSIS_DISABLED`(503), `RESUME_ANALYSIS_NOT_FOUND`(404), `CONTEXT_IRRELEVANT`, `analysis_id`, `kind`.
- 브라우저 스토리지(`localStorage`/`sessionStorage`)에 사용자·분석 식별자를 저장하지 않는다(`analysisPending.test.ts`가 금지 문자열을 검사).
- 기존 소스 문자열 테스트가 묶여 있는 것들은 **그대로 유지**: `Analyze.tsx`의 `{/* ════════ GNB ════════ */}`·`{/* ════════ MAIN FORM ════════ */}` 마커, `MyProjects.tsx`의 리터럴 `analysisId=${encodeURIComponent(project.latest_analysis_id)}`, `ReportResult.tsx`의 `function isRenderableReport`(이름·위치 불변), `reportNavigation.ts`의 `REPORT_NAV_SECTIONS`(불변, 새 배열은 새 파일), `index.css`의 `#section-*` 앵커 규칙(불변, 새 클래스 추가).
- `App.tsx` 라우트 순서: `/analysis-pending`가 `/report-new`보다 앞(기존 테스트). 새 라우트 `/company-analysis`·`/company-report`도 `/analysis-pending` 뒤, `/my` 앞에 둔다.
- 클라이언트 테스트 스타일: 순수 로직은 `pages/*.ts` 형제 파일로 빼서 단위 테스트, JSX는 소스 문자열 테스트, 렌더 검증은 `// @vitest-environment jsdom` + RTL(기존 `Entitlements.purchase.test.tsx` 패턴, `AuthButton`·`Logo`·`wouter` 모킹).
- TS 변경 후 `pnpm check` 0 오류. 커밋은 Task별, 승인된 경우에만. 메시지 끝 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. `git add`는 해당 Task 파일만(무관한 미커밋 변경 `client/src/pages/Login.tsx`, `vercel.json`, `client/src/lib/googleIdentity*.ts`, `groble-cover-4x3.png`는 스테이징·수정·stash 금지).
- 문서·주석 한국어, 식별자 원형.

---

## 파일 구조

| 파일 | 역할 | 상태 |
| --- | --- | --- |
| `lib/company-analysis.js` · `lib/company-analysis.test.js` | `MAX_SOURCES` 12→20 | 수정 |
| `client/src/lib/analysisRequest.ts` · `.test.ts` | `AnalysisKind`, 상태 응답의 `kind` | 수정 |
| `client/src/types/companyReport.ts` · `client/src/types/companyReport.test.ts` | `CompanyReportData` 타입 + `isRenderableCompanyReport` | 생성 |
| `client/src/pages/companyReportFixture.ts` | 테스트 공용 픽스처 `buildCompanyReportFixture()` | 생성 |
| `client/src/pages/companyReportNavigation.ts` · `.test.ts` | `COMPANY_REPORT_NAV_SECTIONS` | 생성 |
| `client/src/components/analyze/CompanyCombobox.tsx` · `JobRoleCombobox.tsx` | `Analyze.tsx`에서 추출(호출자 2곳) | 생성 |
| `client/src/pages/Analyze.tsx` | 콤보박스 import, 이전 지원서 목록에서 `kind === "COMPANY"` 제외, `?company=&jobKeyword=` 프리필 | 수정 |
| `client/src/pages/companyAnalyzeErrors.ts` · `.test.ts` | 회사 분석 에러 코드 → 모달 문구 | 생성 |
| `client/src/pages/CompanyAnalyze.tsx` · `CompanyAnalyze.source.test.ts` | 신청 폼 | 생성 |
| `client/src/pages/AnalysisPending.tsx` · `analysisPending.test.ts` | `kind` 분기(목적지·문구·analytics) | 수정 |
| `client/src/pages/companyReportParts.tsx` | 텍스트 렌더러·섹션 제목·출처 안내·타임라인 등 표현 부품 | 생성 |
| `client/src/pages/CompanyReport.tsx` · `CompanyReport.render.test.tsx` · `CompanyReport.source.test.ts` | 리포트 화면 | 생성 |
| `client/src/index.css` | `.report-section-anchor` | 수정 |
| `client/src/App.tsx` | `/company-analysis`, `/company-report` | 수정 |
| `client/src/types/my.ts` · `components/my/ProjectCard.tsx` · `pages/MyProjects.tsx` · `pages/MyEntitlements.tsx` | `kind` 배지·목적지 분기·기업 잔여 행 | 수정 |
| `client/src/lib/admin-entitlements.ts` · `.test.ts` · `pages/admin/settings/SettingsPage.tsx` | `companyAnalysisEnabled` 토글 | 수정 |
| `client/src/lib/admin-credits.ts` · `components/admin/users/UserCreditManagementCard.tsx` · `pages/admin/users/UserCredits.ui.test.ts` | 지급 kind 선택·기업 잔여 타일 | 수정 |

---

### Task 1: 서버 `MAX_SOURCES` 12 → 20

**Files:**
- Modify: `lib/company-analysis.js` (상수 `MAX_SOURCES`)
- Test: `lib/company-analysis.test.js` ("caps sources at 12" 테스트)

**Interfaces:**
- Produces: `extractGroundingSources(data)`가 최대 20개 반환. 화면 부록이 이 상한을 신뢰한다.

- [ ] **Step 1: 테스트를 20으로 바꾼다**

`lib/company-analysis.test.js`의 `it("caps sources at 12", …)`를 다음으로 교체:

```js
  it("caps sources at 20", () => {
    const many = {
      candidates: [{
        groundingMetadata: {
          groundingChunks: Array.from({ length: 30 }, (_, index) => ({
            web: { uri: `https://redirect/${index}`, title: `site-${index}` },
          })),
        },
      }],
    };
    expect(extractGroundingSources(many)).toHaveLength(20);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run lib/company-analysis.test.js`
Expected: FAIL — 12개 반환.

- [ ] **Step 3: 구현**

`lib/company-analysis.js`: `const MAX_SOURCES = 12;` → `const MAX_SOURCES = 20;` 그리고 바로 위에 주석 한 줄:

```js
// 프로브에서 모델이 40개 이상 자료를 참고했다. 12개는 부록이 너무 얇고, 20개면 화면 한 섹션 분량이다(스펙 §7-1).
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run lib/company-analysis.test.js`
Expected: PASS.

- [ ] **Step 5: 커밋(승인 시)**

```bash
git add lib/company-analysis.js lib/company-analysis.test.js
git commit -m "feat(company-analysis): keep up to 20 grounding sources for the report appendix"
```

---

### Task 2: 클라이언트 계약 — `kind`, 리포트 타입·검증, 목차

**Files:**
- Modify: `client/src/lib/analysisRequest.ts`, `client/src/lib/analysisRequest.test.ts`
- Create: `client/src/types/companyReport.ts`, `client/src/types/companyReport.test.ts`
- Create: `client/src/pages/companyReportFixture.ts`
- Create: `client/src/pages/companyReportNavigation.ts`, `client/src/pages/companyReportNavigation.test.ts`

**Interfaces:**
- Produces:
  - `export type AnalysisKind = "RESUME" | "COMPANY"` (in `analysisRequest.ts`); `AnalysisRequestStatus.kind: AnalysisKind` (응답에 없거나 다른 값이면 `"RESUME"`).
  - `CompanyReportData`, `CompanySource`, `CompanyReportMeta` 타입; `isRenderableCompanyReport(payload: unknown): payload is CompanyReportData`.
  - `buildCompanyReportFixture(overrides?: Partial<CompanyReportData>): CompanyReportData`.
  - `COMPANY_REPORT_NAV_SECTIONS: ReportNavSection[]` (9개: 01~08 + 09 출처), `COMPANY_HERO_ID = "company-hero"`.

- [ ] **Step 1: 실패하는 테스트 — `kind` 파싱**

`client/src/lib/analysisRequest.test.ts`의 "parses only the safe status projection" 기대값에 `kind: "RESUME",`을 추가하고, 파일 끝 `describe` 안에 추가:

```ts
  it("reads the analysis kind and defaults unknown or missing kinds to RESUME", () => {
    const base = { analysis_id: "analysis-1", error: null, id: "request-1", requestId: "request-id", status: "SUCCEEDED" };
    expect(parseAnalysisRequestStatus({ ...base, kind: "COMPANY" }).kind).toBe("COMPANY");
    expect(parseAnalysisRequestStatus({ ...base, kind: "RESUME" }).kind).toBe("RESUME");
    expect(parseAnalysisRequestStatus({ ...base, kind: "OTHER" }).kind).toBe("RESUME");
    expect(parseAnalysisRequestStatus(base).kind).toBe("RESUME");
  });
```

다른 `toEqual` 기대값(상태 응답 전체를 단언하는 곳)에도 `kind: "RESUME"`을 추가한다.

- [ ] **Step 2: 실패하는 테스트 — 리포트 검증과 목차**

`client/src/types/companyReport.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildCompanyReportFixture } from "../pages/companyReportFixture";
import { isRenderableCompanyReport } from "./companyReport";

describe("isRenderableCompanyReport", () => {
  it("accepts the fixture and a fixture without optional meta", () => {
    expect(isRenderableCompanyReport(buildCompanyReportFixture())).toBe(true);
    const { reportMeta: _meta, ...withoutMeta } = buildCompanyReportFixture();
    expect(isRenderableCompanyReport(withoutMeta)).toBe(true);
  });

  it.each([
    ["null", null],
    ["no brief", { ...buildCompanyReportFixture(), brief: undefined }],
    ["brief without oneLiner", { ...buildCompanyReportFixture(), brief: { keywords: [] } }],
    ["segments not an array", { ...buildCompanyReportFixture(), businessMap: { summary: "", segments: "x" } }],
    ["risks missing", { ...buildCompanyReportFixture(), opportunitiesAndRisks: { opportunities: [] } }],
    ["questions missing", { ...buildCompanyReportFixture(), interviewPrep: { primarySources: [] } }],
    ["sources not an array", { ...buildCompanyReportFixture(), sources: undefined }],
    ["résumé report shape", { companyInsight: {}, firstImpression: {}, strengths: [], gaps: [], questionTabs: [], actionPlan: [] }],
  ])("rejects %s", (_label, payload) => {
    expect(isRenderableCompanyReport(payload)).toBe(false);
  });
});
```

`client/src/pages/companyReportNavigation.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { COMPANY_HERO_ID, COMPANY_REPORT_NAV_SECTIONS } from "./companyReportNavigation";

describe("company report navigation", () => {
  it("lists the eight sections and the appendix in reading order", () => {
    expect(COMPANY_REPORT_NAV_SECTIONS.map((section) => `${section.indexLabel}. ${section.label}`)).toEqual([
      "01. 돈 버는 구조",
      "02. 밀고 있는 사업",
      "03. 숫자로 보는 회사",
      "04. 최근 1년의 국면",
      "05. 이 직무의 자리",
      "06. 기회와 리스크",
      "07. 맡고 싶은 사업",
      "08. 면접 전 체크리스트",
      "09. 출처와 기준일",
    ]);
  });

  it("uses company- prefixed ids that never collide with the résumé report", () => {
    expect(COMPANY_HERO_ID).toBe("company-hero");
    for (const section of COMPANY_REPORT_NAV_SECTIONS) {
      expect(section.id.startsWith("company-")).toBe(true);
      expect(section.id.startsWith("section-")).toBe(false);
    }
    expect(new Set(COMPANY_REPORT_NAV_SECTIONS.map((section) => section.id)).size).toBe(9);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm exec vitest run client/src/lib/analysisRequest.test.ts client/src/types/companyReport.test.ts client/src/pages/companyReportNavigation.test.ts`
Expected: FAIL — 모듈 없음 / `kind` 없음.

- [ ] **Step 4: 구현 — `analysisRequest.ts`**

`AnalysisRequestStatus` 위에 타입을 추가하고 인터페이스·파서를 고친다:

```ts
/** 분석 종류. 서버 enum AnalysisKind 와 같다. 구버전 응답에 없으면 RESUME 으로 본다. */
export type AnalysisKind = "RESUME" | "COMPANY";

export interface AnalysisRequestStatus {
  analysisId: string | null;
  error: "ANALYSIS_FAILED" | "CONTEXT_IRRELEVANT" | null;
  id: string;
  kind: AnalysisKind;
  requestId: string;
  status: AnalysisRequestStatusName;
}
```

`parseAnalysisRequestStatus`의 반환 객체에 `kind: value.kind === "COMPANY" ? "COMPANY" : "RESUME",`을 추가한다(다른 검증은 그대로).

- [ ] **Step 5: 구현 — `client/src/types/companyReport.ts`**

```ts
// =============================================================================
// 기업 분석 리포트 — 타입 정의와 렌더 가능 검증
// 서버 shared/prompts/companyReportPrompt.js 의 JSON 스키마와 1:1. sources/reportMeta 는 서버가 붙인다.
// =============================================================================

export interface CompanyBrief {
  oneLiner: string;
  keywords: string[];
  asOf: string;
  positionInIndustry: string;
}

export interface CompanySegment {
  name: string;
  whatItDoes: string;
  weight: string;
  phase: string;
  sourceIds?: number[];
}

export interface CompanyBusinessMap {
  summary: string;
  segments: CompanySegment[];
  customersAndCompetitors: string;
}

export interface CompanyFocusItem {
  name: string;
  whatChanged: string;
  evidence: string;
  whyNow: string;
  relevanceToRole: string;
  sourceIds?: number[];
}

export interface CompanyFocusBusinesses {
  statedDirection: string;
  items: CompanyFocusItem[];
  translatedTalentKeywords: Array<{ stated: string; meaning: string }>;
}

export interface CompanyKeyFigure {
  label: string;
  value: string;
  period: string;
  sourceIds?: number[];
}

export interface CompanyFinancialSnapshot {
  listed: boolean;
  market: string | null;
  revenueTrend: string;
  profitTrend: string;
  keyFigures: CompanyKeyFigure[];
  marketView: string;
  recentDisclosures: Array<{ title: string; when: string; sourceIds?: number[] }>;
  fundingNote: string;
  forApplicant: string;
}

export interface CompanyIssue {
  title: string;
  when: string;
  fact: string;
  whyItMatters: string;
  forApplicant: string;
  sourceIds?: number[];
}

export interface CompanyRoleNews {
  title: string;
  when: string;
  fact: string;
  whyForRole: string;
  sourceIds?: number[];
}

export interface CompanyRoleInContext {
  whereItSits: string;
  problemsItSolves: string[];
  whyHiringNow: string;
  recentNewsForRole: CompanyRoleNews[];
  postingReading: string;
}

export interface CompanyHeadlineText {
  headline: string;
  text: string;
  sourceIds?: number[];
}

export interface CompanyBusinessCandidate {
  name: string;
  whyForThisRole: string;
  angle: string;
  experienceToPrepare: string;
  seedSentence: string;
}

export interface CompanyInterviewPrep {
  questions: Array<{ question: string; direction: string }>;
  primarySources: Array<{ label: string; url: string }>;
}

export interface CompanySource {
  id: number;
  title: string;
  url: string;
  publisher: string;
}

export interface CompanyReportMeta {
  kind: "COMPANY";
  schemaVersion: number;
  asOf: string;
  searchQueries: string[];
  searchEntryPointHtml: string | null;
  linkedResumeAnalysisId: string | null;
  repaired: boolean;
}

export interface CompanyReportData {
  brief: CompanyBrief;
  businessMap: CompanyBusinessMap;
  focusBusinesses: CompanyFocusBusinesses;
  financialSnapshot: CompanyFinancialSnapshot;
  currentIssues: CompanyIssue[];
  roleInContext: CompanyRoleInContext;
  opportunitiesAndRisks: { opportunities: CompanyHeadlineText[]; risks: CompanyHeadlineText[] };
  businessCandidates: CompanyBusinessCandidate[];
  interviewPrep: CompanyInterviewPrep;
  sources: CompanySource[];
  reportMeta?: CompanyReportMeta;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * CompanyReport 가 역참조하는 최상위 필드를 렌더 전에 확인한다.
 * 불완전 생성 리포트가 TypeError(화이트스크린)로 이어지지 않게 한다. 자소서 리포트 형태는 거부한다.
 */
export function isRenderableCompanyReport(payload: unknown): payload is CompanyReportData {
  if (!isRecord(payload)) return false;
  const brief = payload.brief;
  const businessMap = payload.businessMap;
  const focus = payload.focusBusinesses;
  const risks = payload.opportunitiesAndRisks;
  const interview = payload.interviewPrep;
  return (
    isRecord(brief) && typeof brief.oneLiner === "string" &&
    isRecord(businessMap) && Array.isArray(businessMap.segments) &&
    isRecord(focus) && Array.isArray(focus.items) &&
    isRecord(payload.financialSnapshot) &&
    Array.isArray(payload.currentIssues) &&
    isRecord(payload.roleInContext) &&
    isRecord(risks) && Array.isArray(risks.opportunities) && Array.isArray(risks.risks) &&
    Array.isArray(payload.businessCandidates) &&
    isRecord(interview) && Array.isArray(interview.questions) &&
    Array.isArray(payload.sources)
  );
}
```

- [ ] **Step 6: 구현 — 픽스처 `client/src/pages/companyReportFixture.ts`**

```ts
import type { CompanyReportData } from "@/types/companyReport";

/** 테스트·스토리용 최소 완전 픽스처. 실제 회사 사실이 아니라 형태만 맞춘 예시 문장이다. */
export function buildCompanyReportFixture(overrides: Partial<CompanyReportData> = {}): CompanyReportData {
  return {
    brief: {
      oneLiner: "전동화로 체급을 바꾸는 완성차",
      keywords: ["전동화", "SDV", "글로벌 판매", "제네시스"],
      asOf: "2026-09-06",
      positionInIndustry: "국내 1위, 글로벌 3위권 완성차 그룹의 핵심 계열사.",
    },
    businessMap: {
      summary: "차량 판매가 매출의 대부분이고 금융이 이익을 받친다.",
      segments: [
        { name: "차량", whatItDoes: "완성차 생산·판매", weight: "매출의 8할 이상", phase: "전환", sourceIds: [1] },
        { name: "금융", whatItDoes: "할부·리스", weight: "매출의 1할", phase: "성숙", sourceIds: [2] },
      ],
      customersAndCompetitors: "개인 고객과 법인 플릿, 경쟁은 토요타·폭스바겐.",
    },
    focusBusinesses: {
      statedDirection: "스마트 모빌리티 솔루션 기업으로의 전환을 말한다.",
      items: [
        { name: "SDV 전환", whatChanged: "소프트웨어 조직 통합", evidence: "연구소 신설", whyNow: "차량 가치가 소프트웨어로 이동", relevanceToRole: "직접 — 전략기획이 로드맵을 다룬다", sourceIds: [3] },
      ],
      translatedTalentKeywords: [{ stated: "도전", meaning: "전동화 전환 속도를 감당하는 실행" }],
    },
    financialSnapshot: {
      listed: true,
      market: "유가증권시장 · 현대차",
      revenueTrend: "최근 2년 성장, 고가 차종 비중 확대가 이유.",
      profitTrend: "영업이익 성장, 환율 효과 포함.",
      keyFigures: [{ label: "매출", value: "175조 원", period: "2025년 연간", sourceIds: [4] }],
      marketView: "시가총액 흐름은 완만한 상승.",
      recentDisclosures: [{ title: "2분기 실적 발표", when: "2026-07", sourceIds: [5] }],
      fundingNote: "",
      forApplicant: "**신사업 투자 여력이 있는 회사라 전략기획 채용이 이어질 가능성이 높습니다.**",
    },
    currentIssues: [
      { title: "관세 변수", when: "2026-04", fact: "미국 관세 정책 변경", whyItMatters: "수출 비중이 높다", forApplicant: "지역 전략 질문이 나온다", sourceIds: [6] },
    ],
    roleInContext: {
      whereItSits: "기획조정 부문 아래.",
      problemsItSolves: ["중장기 전략 수립", "신사업 타당성 검토"],
      whyHiringNow: "전환기에 전략 인력 수요가 늘었다는 가설.",
      recentNewsForRole: [{ title: "전략 조직 개편", when: "2026-03", fact: "기획 부문 신설", whyForRole: "직무 정의가 최근에 바뀌었다", sourceIds: [7] }],
      postingReading: "",
    },
    opportunitiesAndRisks: {
      opportunities: [{ headline: "전동화 선점", text: "**전동화 라인업이 경쟁사보다 빠릅니다.**", sourceIds: [] }],
      risks: [{ headline: "관세 노출", text: "수출 의존도가 리스크입니다.", sourceIds: [] }],
    },
    businessCandidates: [
      { name: "SDV 전환 로드맵", whyForThisRole: "전략기획의 본업", angle: "전환 속도와 투자 배분", experienceToPrepare: "데이터로 우선순위를 정한 경험", seedSentence: "소프트웨어 전환의 속도를 숫자로 설명하는 각도" },
    ],
    interviewPrep: {
      questions: [{ question: "우리 회사의 가장 큰 숙제는?", direction: "관세와 전동화 전환을 연결해 답한다." }],
      primarySources: [{ label: "사업보고서", url: "https://dart.fss.or.kr" }],
    },
    sources: [
      { id: 1, title: "hyundai.com", url: "https://redirect/1", publisher: "redirect" },
      { id: 2, title: "dart.fss.or.kr", url: "https://redirect/2", publisher: "redirect" },
    ],
    reportMeta: {
      kind: "COMPANY",
      schemaVersion: 1,
      asOf: "2026-09-06",
      searchQueries: ["현대자동차 전략기획"],
      searchEntryPointHtml: "<div class=\"container\"><a href=\"https://vertexaisearch.cloud.google.com/x\">현대자동차 실적</a></div>",
      linkedResumeAnalysisId: null,
      repaired: false,
    },
    ...overrides,
  };
}
```

- [ ] **Step 7: 구현 — `client/src/pages/companyReportNavigation.ts`**

```ts
import type { ReportNavSection } from "./reportNavigation";

/** 표지(히어로)는 목차에 넣지 않는다. 자소서 리포트의 section- 접두와 겹치지 않게 company- 를 쓴다. */
export const COMPANY_HERO_ID = "company-hero";

export const COMPANY_REPORT_NAV_SECTIONS: ReportNavSection[] = [
  { id: "company-business", indexLabel: "01", label: "돈 버는 구조" },
  { id: "company-focus", indexLabel: "02", label: "밀고 있는 사업" },
  { id: "company-numbers", indexLabel: "03", label: "숫자로 보는 회사" },
  { id: "company-issues", indexLabel: "04", label: "최근 1년의 국면" },
  { id: "company-role", indexLabel: "05", label: "이 직무의 자리" },
  { id: "company-risks", indexLabel: "06", label: "기회와 리스크" },
  { id: "company-candidates", indexLabel: "07", label: "맡고 싶은 사업" },
  { id: "company-interview", indexLabel: "08", label: "면접 전 체크리스트" },
  { id: "company-sources", indexLabel: "09", label: "출처와 기준일" },
];
```

- [ ] **Step 8: 통과 + 타입 체크**

Run: `pnpm exec vitest run client/src/lib/analysisRequest.test.ts client/src/types/companyReport.test.ts client/src/pages/companyReportNavigation.test.ts client/src/pages/reportNavigation.test.ts && pnpm check`
Expected: PASS, tsc 0 오류.

- [ ] **Step 9: 커밋(승인 시)**

```bash
git add client/src/lib/analysisRequest.ts client/src/lib/analysisRequest.test.ts client/src/types/companyReport.ts client/src/types/companyReport.test.ts client/src/pages/companyReportFixture.ts client/src/pages/companyReportNavigation.ts client/src/pages/companyReportNavigation.test.ts
git commit -m "feat(client): add the company report contract, kind parsing, and navigation"
```

---

### Task 3: 콤보박스 추출 + `Analyze.tsx` 최소 수정

**Files:**
- Create: `client/src/components/analyze/CompanyCombobox.tsx`, `client/src/components/analyze/JobRoleCombobox.tsx`
- Modify: `client/src/pages/Analyze.tsx` (219~445행의 두 컴포넌트 제거 → import; 658~661행 필터; `company`/`jobRole` 초기값)
- Test: `client/src/pages/Analyze.previousResume.test.ts`(기존, 확장)

**Interfaces:**
- Produces: `export default function CompanyCombobox({ value, onChange }: { value: string; onChange: (value: string) => void })`, `export default function JobRoleCombobox(...)` 동일 시그니처. 마크업·클래스는 `Analyze.tsx`의 현행 그대로.

- [ ] **Step 1: 실패하는 테스트**

`client/src/pages/Analyze.previousResume.test.ts`에 추가:

```ts
  it("imports the shared comboboxes and keeps company projects out of the résumé picker", () => {
    expect(analyzeSource).toContain('from "@/components/analyze/CompanyCombobox"');
    expect(analyzeSource).toContain('from "@/components/analyze/JobRoleCombobox"');
    expect(analyzeSource).not.toContain("function CompanyCombobox(");
    expect(analyzeSource).not.toContain("function JobRoleCombobox(");
    expect(analyzeSource).toContain('project.kind !== "COMPANY"');
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run client/src/pages/Analyze.previousResume.test.ts`
Expected: FAIL.

- [ ] **Step 3: 추출**

`client/src/components/analyze/CompanyCombobox.tsx`를 만든다. `Analyze.tsx` 219~329행의 `function CompanyCombobox(...)` 본문을 **그대로** 옮기고 파일 상단에 필요한 import만 둔다:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Plus, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { COMPANY_PRESETS, normalizeCompanyName } from "@/constants/companies";

/** 회사명 자동완성 입력. 자소서 분석(Analyze)과 기업 분석(CompanyAnalyze)이 함께 쓴다. */
export default function CompanyCombobox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  // ...Analyze.tsx 의 본문 그대로...
}
```

`JobRoleCombobox.tsx`도 같은 방식(334~445행, import는 `BriefcaseBusiness, Plus, Search, X` + `filterJobRoleCategories`).

`Analyze.tsx`: 두 함수 정의를 삭제하고 상단 import에 두 줄 추가. 삭제로 **쓰이지 않게 된 import**(`Building2`는 1043행에서 여전히 쓰이므로 유지; `BriefcaseBusiness`, `Plus`, `Search`, `COMPANY_PRESETS`, `normalizeCompanyName`, `filterJobRoleCategories` 등은 다른 사용처가 없으면 제거)만 정리한다. `pnpm check`가 미사용 import를 잡지 않으므로 grep으로 확인한다.

- [ ] **Step 4: 이전 지원서 목록 필터와 프리필**

`Analyze.tsx` 658~661행:

```tsx
      const projects: ProjectSummary[] = await response.json();
      // 기업 분석 프로젝트는 자소서가 없어 불러올 것이 없다.
      setPreviousResumes(projects.filter(project => project.kind !== "COMPANY" && project.latest_analysis_id));
```

`company`/`jobRole` 상태 초기값을 쿼리에서 읽는다(후속 플랜의 "이 각도로 자소서 쓰기" CTA가 `/analyze?company=…&jobKeyword=…`로 들어온다). 기존 `useState("")` 두 줄을:

```tsx
  // /company-report 의 CTA 가 회사·직무를 쿼리로 넘긴다. 없으면 빈 값.
  const [company, setCompany] = useState(() => readQueryParam("company"));
  const [jobRole, setJobRole] = useState(() => readQueryParam("jobKeyword"));
```

파일 상단(컴포넌트 밖)에 헬퍼:

```tsx
function readQueryParam(name: string): string {
  if (typeof window === "undefined") return "";
  const value = new URLSearchParams(window.location.search).get(name);
  return typeof value === "string" ? value.slice(0, 100) : "";
}
```

`ProjectSummary`에 `kind`가 아직 없으므로(Task 7) 이 Task에서 `client/src/types/my.ts`의 `ProjectSummary`에 다음을 추가한다:

```ts
  /** 분석 종류. 구버전 응답에 없으면 RESUME 으로 본다. */
  kind?: "RESUME" | "COMPANY";
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm exec vitest run client/src/pages/Analyze.previousResume.test.ts client/src/pages/Analyze.jobRoles.test.ts client/src/pages/analyzeErrorMessage.test.ts client/src/pages/analyzeAuthAccess.test.ts client/src/pages/AnalyzeLoadingIcon.test.ts && pnpm check`
Expected: PASS, tsc 0 오류.

- [ ] **Step 6: 커밋(승인 시)**

```bash
git add client/src/components/analyze/CompanyCombobox.tsx client/src/components/analyze/JobRoleCombobox.tsx client/src/pages/Analyze.tsx client/src/pages/Analyze.previousResume.test.ts client/src/types/my.ts
git commit -m "refactor(analyze): share the company and job comboboxes and hide company projects from the résumé picker"
```

---

### Task 4: 신청 폼 `/company-analysis`

**Files:**
- Create: `client/src/pages/companyAnalyzeErrors.ts`, `client/src/pages/companyAnalyzeErrors.test.ts`
- Create: `client/src/pages/CompanyAnalyze.tsx`, `client/src/pages/CompanyAnalyze.source.test.ts`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `CompanyCombobox`/`JobRoleCombobox`(Task 3), `parseAnalysisReceipt`/`analysisPendingPath`(기존), `fetchEntitlementSummary`, `getAnalyzeErrorMessage`/`getAnalyzeErrorTitle`(`Analyze.tsx` export).
- Produces: `getCompanyAnalyzeError(errorData: unknown, status: number): { title: string; message: string; actionLabel?: string; actionHref?: string; trackingType: string }`; 라우트 `/company-analysis`.

- [ ] **Step 1: 실패하는 테스트 — 에러 매핑**

`client/src/pages/companyAnalyzeErrors.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getCompanyAnalyzeError } from "./companyAnalyzeErrors";

describe("getCompanyAnalyzeError", () => {
  it("maps the company-specific codes to Korean copy and actions", () => {
    expect(getCompanyAnalyzeError({ error: "COMPANY_CREDITS_EXHAUSTED" }, 409)).toEqual({
      title: "이용권 없음",
      message: "기업 분석 이용권이 없어요. 판매가 열리면 이용권 페이지에서 구매할 수 있어요.",
      actionLabel: "이용권 확인하기",
      actionHref: "/entitlements",
      trackingType: "credits_exhausted",
    });
    expect(getCompanyAnalyzeError({ error: "COMPANY_ANALYSIS_DISABLED" }, 503)).toMatchObject({
      title: "준비 중",
      trackingType: "disabled",
    });
    expect(getCompanyAnalyzeError({ error: "RESUME_ANALYSIS_NOT_FOUND" }, 404)).toMatchObject({
      title: "연결 오류",
      trackingType: "resume_not_found",
    });
  });

  it("falls back to the shared analyze copy for shared codes and never leaks raw server text", () => {
    const rateLimited = getCompanyAnalyzeError({ error: "RATE_LIMITED", message: "raw provider text" }, 429);
    expect(rateLimited.title).toBe("요청 제한");
    expect(rateLimited.trackingType).toBe("rate_limit");
    expect(JSON.stringify(rateLimited)).not.toContain("raw provider text");

    const irrelevant = getCompanyAnalyzeError({ error: "CONTEXT_IRRELEVANT" }, 400);
    expect(irrelevant.trackingType).toBe("context_irrelevant");

    const unknown = getCompanyAnalyzeError({ error: "SOMETHING_ELSE", message: "secret" }, 500);
    expect(unknown.trackingType).toBe("server_error");
    expect(JSON.stringify(unknown)).not.toContain("secret");
  });
});
```

- [ ] **Step 2: 실패하는 테스트 — 폼 소스**

`client/src/pages/CompanyAnalyze.source.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CompanyAnalyze.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("CompanyAnalyze page", () => {
  it("posts to the company route with an idempotency key and moves to the pending page", () => {
    expect(source).toContain('fetch("/api/analyze/company", {');
    expect(source).toContain('"Idempotency-Key": idempotencyKey');
    expect(source).toContain("navigate(analysisPendingPath(receipt.analysisRequestId))");
    expect(source).toContain('trackAnalysisStart("company_report"');
  });

  it("reuses the shared comboboxes and the company error mapper", () => {
    expect(source).toContain('from "@/components/analyze/CompanyCombobox"');
    expect(source).toContain('from "@/components/analyze/JobRoleCombobox"');
    expect(source).toContain("getCompanyAnalyzeError(errorData, response.status)");
  });

  it("keeps identifiers out of browser storage and the URL body", () => {
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("userId=");
  });

  it("limits the pasted posting to 4,000 characters and lists only résumé projects for linking", () => {
    expect(source).toContain("MAX_POSTING_CHARS = 4000");
    expect(source).toContain('project.kind !== "COMPANY"');
  });

  it("is routed at /company-analysis after /analysis-pending", () => {
    expect(appSource).toContain('path={"/company-analysis"} component={CompanyAnalyze}');
    expect(appSource.indexOf('path={"/analysis-pending"}')).toBeLessThan(appSource.indexOf('path={"/company-analysis"}'));
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm exec vitest run client/src/pages/companyAnalyzeErrors.test.ts client/src/pages/CompanyAnalyze.source.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: 구현 — `companyAnalyzeErrors.ts`**

```ts
import { getAnalyzeErrorMessage, getAnalyzeErrorTitle } from "./Analyze";

export interface CompanyAnalyzeErrorView {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  /** analytics trackAnalysisFailed 의 error_type */
  trackingType: string;
}

function errorCodeOf(errorData: unknown): string | null {
  if (errorData && typeof errorData === "object" && typeof (errorData as { error?: unknown }).error === "string") {
    return (errorData as { error: string }).error;
  }
  return null;
}

/**
 * POST /api/analyze/company 실패 응답을 모달 문구로 바꾼다.
 * 기업 분석 전용 코드만 여기서 다루고, 나머지는 자소서 분석과 같은 문구(Analyze.tsx)를 쓴다.
 * 서버 원문(message)은 절대 그대로 보여주지 않는다.
 */
export function getCompanyAnalyzeError(errorData: unknown, status: number): CompanyAnalyzeErrorView {
  const code = errorCodeOf(errorData);
  if (code === "COMPANY_CREDITS_EXHAUSTED") {
    return {
      title: "이용권 없음",
      message: "기업 분석 이용권이 없어요. 판매가 열리면 이용권 페이지에서 구매할 수 있어요.",
      actionLabel: "이용권 확인하기",
      actionHref: "/entitlements",
      trackingType: "credits_exhausted",
    };
  }
  if (code === "COMPANY_ANALYSIS_DISABLED") {
    return {
      title: "준비 중",
      message: "기업 분석 리포트는 아직 준비 중이에요. 열리면 알려 드릴게요.",
      trackingType: "disabled",
    };
  }
  if (code === "RESUME_ANALYSIS_NOT_FOUND") {
    return {
      title: "연결 오류",
      message: "연결하려는 자소서 분석을 찾을 수 없어요. 연결을 해제하고 다시 시도해 주세요.",
      trackingType: "resume_not_found",
    };
  }

  const title = getAnalyzeErrorTitle(errorData, status);
  const trackingType = title === "요청 제한"
    ? "rate_limit"
    : code === "CONTEXT_IRRELEVANT"
      ? "context_irrelevant"
      : code === "ANALYSIS_CONCURRENCY_LIMITED"
        ? "analysis_concurrency_limited"
        : "server_error";
  return {
    title: code === "CONTEXT_IRRELEVANT" ? "기업 확인 필요" : title,
    message: code === "CONTEXT_IRRELEVANT"
      ? "입력한 기업을 공개 자료에서 확인하지 못했어요. 정확한 회사명으로 다시 시도해 주세요."
      : getAnalyzeErrorMessage(errorData),
    trackingType,
  };
}
```

`Analyze.tsx`가 `getAnalyzeErrorMessage`/`getAnalyzeErrorTitle`를 이미 `export`하는지 확인(기존 `analyzeErrorMessage.test.ts`가 import하므로 export 상태다).

- [ ] **Step 5: 구현 — `CompanyAnalyze.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Building2, FileText, Link2, Loader2 } from "lucide-react";

import AuthButton from "@/components/AuthButton";
import Logo from "@/components/Logo";
import CompanyCombobox from "@/components/analyze/CompanyCombobox";
import JobRoleCombobox from "@/components/analyze/JobRoleCombobox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getAuthorizationHeader } from "@/lib/apiAuth";
import { trackAnalysisFailed, trackAnalysisStart } from "@/lib/analytics";
import { analysisPendingPath, parseAnalysisReceipt } from "@/lib/analysisRequest";
import { fetchEntitlementSummary, type EntitlementSummary } from "@/lib/entitlements";
import { supabase } from "@/lib/supabase";
import type { ProjectSummary } from "@/types/my";
import { getCompanyAnalyzeError, type CompanyAnalyzeErrorView } from "./companyAnalyzeErrors";

// 서버 normalizeCompanyRequest 와 같은 상한.
const MAX_POSTING_CHARS = 4000;
const MAX_NAME_CHARS = 100;

function readQueryParam(name: string): string {
  if (typeof window === "undefined") return "";
  const value = new URLSearchParams(window.location.search).get(name);
  return typeof value === "string" ? value.slice(0, MAX_NAME_CHARS) : "";
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function CompanyAnalyze() {
  const [, navigate] = useLocation();
  const { isLoading: authLoading, isAuthenticated } = useRequireAuth({ redirectPath: "/company-analysis" });

  const [company, setCompany] = useState(() => readQueryParam("company"));
  const [jobKeyword, setJobKeyword] = useState(() => readQueryParam("jobKeyword"));
  const [postingText, setPostingText] = useState("");
  const [resumeAnalysisId, setResumeAnalysisId] = useState(() => readQueryParam("resumeAnalysisId"));
  const [previousResumes, setPreviousResumes] = useState<ProjectSummary[]>([]);
  const [summary, setSummary] = useState<EntitlementSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<CompanyAnalyzeErrorView | null>(null);
  // 같은 입력 재시도는 같은 키, 입력이 바뀌면 새 키(자소서 분석과 동일 규칙).
  const requestRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const next = await fetchEntitlementSummary(token);
          if (!cancelled) setSummary(next);
        }
      } catch {
        // 잔여 표시는 편의 정보다. 실패해도 폼은 쓸 수 있고 서버가 최종 판단한다.
      }
      try {
        const response = await fetch("/api/projects", { headers: await getAuthorizationHeader() });
        if (!response.ok) return;
        const projects: ProjectSummary[] = await response.json();
        if (!cancelled) {
          setPreviousResumes(projects.filter(project => project.kind !== "COMPANY" && project.latest_analysis_id));
        }
      } catch {
        // 연결 목록은 선택 사항이다.
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated]);

  const canSubmit = company.trim().length > 0 && jobKeyword.trim().length > 0
    && postingText.length <= MAX_POSTING_CHARS && !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsLoading(true);

    const payload: Record<string, string> = {
      company: company.trim().slice(0, MAX_NAME_CHARS),
      jobKeyword: jobKeyword.trim().slice(0, MAX_NAME_CHARS),
    };
    if (postingText.trim()) payload.postingText = postingText.trim();
    if (resumeAnalysisId) payload.resumeAnalysisId = resumeAnalysisId;

    const fingerprint = JSON.stringify(payload);
    const previous = requestRef.current;
    const idempotencyKey = previous?.fingerprint === fingerprint ? previous.idempotencyKey : crypto.randomUUID();
    requestRef.current = { fingerprint, idempotencyKey };
    trackAnalysisStart("company_report", postingText.length);

    try {
      const response = await fetch("/api/analyze/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthorizationHeader()),
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.status !== 202 && response.status !== 200) {
        let errorData: unknown;
        try { errorData = await response.json(); } catch { /* 본문 없음 */ }
        const view = getCompanyAnalyzeError(errorData, response.status);
        trackAnalysisFailed("company_report", view.trackingType);
        setErrorModal(view);
        return;
      }

      let receipt;
      try {
        receipt = parseAnalysisReceipt(await response.json());
      } catch {
        trackAnalysisFailed("company_report", "parse_error");
        setErrorModal({ title: "접수 확인 실패", message: "접수 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.", trackingType: "parse_error" });
        return;
      }
      requestRef.current = null;
      navigate(analysisPendingPath(receipt.analysisRequestId));
    } catch {
      trackAnalysisFailed("company_report", "server_error");
      setErrorModal({ title: "연결 불안정", message: "네트워크가 불안정해요. 잠시 후 다시 시도해 주세요.", trackingType: "server_error" });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return <main className="min-h-screen bg-[#0A0A0A]" aria-busy="true" />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-28">
      {/* ════════ GNB ════════ */}
      <motion.nav
        className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-lg border-b border-white/5"
        initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}
      >
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="p-2 hover:bg-white/10 rounded-lg transition-colors" aria-label="Go back">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center cursor-pointer" onClick={() => navigate("/")}>
              <Logo className="h-6 w-auto" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="text-[13px] text-gray-300 hover:text-white hover:bg-white/10 font-medium h-8 px-3 rounded-md transition-colors duration-200"
              onClick={() => navigate("/my")}
            >
              내 지원서
            </button>
            <AuthButton />
          </div>
        </div>
      </motion.nav>

      {/* ════════ MAIN FORM ════════ */}
      <motion.section className="py-12 md:py-20" variants={containerVariants} initial="hidden" animate="visible">
        <div className="container max-w-3xl mx-auto px-4">
          <motion.div className="text-center mb-12" variants={itemVariants}>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">기업 분석 리포트</h1>
            <p className="text-zinc-500 text-base md:text-lg leading-relaxed max-w-xl mx-auto break-keep">
              회사와 직무를 고르면, 돈 버는 구조부터 맡고 싶은 사업 후보까지 지원자의 시선으로 정리해 드려요.
            </p>
          </motion.div>

          {summary && (
            <motion.div variants={itemVariants} className="mb-6 flex flex-wrap items-center justify-center gap-2 text-[13px]">
              <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-zinc-300">
                기업 분석 이용권 {summary.companyRemaining}회
              </span>
              {!summary.companyAnalysisEnabled && (
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-amber-200">
                  준비 중인 기능이에요. 관리자 확인 후 열립니다.
                </span>
              )}
              {summary.companyAnalysisEnabled && summary.companyRemaining === 0 && (
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-amber-200">
                  보유한 기업 분석 이용권이 없어요.
                </span>
              )}
            </motion.div>
          )}

          <motion.div variants={itemVariants} className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-7">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-400/20 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <h2 className="text-base font-semibold text-white">회사와 직무</h2>
              <span className="text-[11px] text-cyan-300 bg-cyan-400/[0.08] px-2 py-0.5 rounded-full">필수</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-2.5 uppercase tracking-wider">회사</label>
              <CompanyCombobox value={company} onChange={setCompany} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wider">직무</label>
              <JobRoleCombobox value={jobKeyword} onChange={setJobKeyword} />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-7">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-zinc-300" />
              </div>
              <h2 className="text-base font-semibold text-white">채용공고 붙여넣기</h2>
              <span className="text-[11px] text-zinc-600 bg-white/[0.06] px-2 py-0.5 rounded-full">선택</span>
            </div>
            <div>
              <Textarea
                value={postingText}
                onChange={event => setPostingText(event.target.value.slice(0, MAX_POSTING_CHARS))}
                placeholder="수행직무·자격요건을 붙여 넣으면 '이 직무의 자리' 섹션이 채용공고 문장을 해석해 드려요."
                className="min-h-[160px] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-600 rounded-xl text-[15px] focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-2 text-right text-xs text-zinc-600 tabular-nums">{postingText.length.toLocaleString()} / {MAX_POSTING_CHARS.toLocaleString()}</p>
            </div>
          </motion.div>

          {previousResumes.length > 0 && (
            <motion.div variants={itemVariants} className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <Link2 className="w-3.5 h-3.5 text-zinc-300" />
                </div>
                <h2 className="text-base font-semibold text-white">내 자소서 분석과 연결</h2>
                <span className="text-[11px] text-zinc-600 bg-white/[0.06] px-2 py-0.5 rounded-full">선택</span>
              </div>
              <select
                value={resumeAnalysisId}
                onChange={event => setResumeAnalysisId(event.target.value)}
                className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-[15px] text-white focus:border-blue-500/40 focus:outline-none"
                aria-label="연결할 자소서 분석"
              >
                <option value="" className="bg-[#141414]">연결하지 않기</option>
                {previousResumes.map(project => (
                  <option key={project.id} value={project.latest_analysis_id ?? ""} className="bg-[#141414]">
                    {(project.company_name || project.title) + (project.job_role ? ` · ${project.job_role}` : "")}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-600">연결하면 리포트 안에서 자소서 분석으로 바로 이동할 수 있어요.</p>
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* ════════ BOTTOM BAR ════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0A]/90 backdrop-blur-xl">
        <div className="container max-w-3xl mx-auto px-4 flex flex-col">
          <div className="h-[72px] flex items-center justify-between gap-4">
            <p className="text-xs text-zinc-500 break-keep">검색과 정리에 1분 정도 걸려요. 실패하면 이용권은 차감되지 않아요.</p>
            <Button
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-white px-6 py-3 text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-cyan-500/25 transition-all disabled:opacity-40 disabled:shadow-none whitespace-nowrap flex-shrink-0"
            >
              {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />접수 중...</>) : (<>기업 분석 시작</>)}
            </Button>
          </div>
        </div>
      </div>

      {/* ════════ ERROR MODAL ════════ */}
      <AnimatePresence>
        {errorModal && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setErrorModal(null)}
          >
            <motion.div
              className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{errorModal.title}</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">{errorModal.message}</p>
              {errorModal.actionHref && errorModal.actionLabel && (
                <Button
                  onClick={() => { const href = errorModal.actionHref; setErrorModal(null); if (href) navigate(href); }}
                  className="w-full mb-2 bg-white hover:bg-zinc-200 text-black rounded-xl h-11 text-sm font-semibold transition-colors"
                >
                  {errorModal.actionLabel}
                </Button>
              )}
              <Button
                onClick={() => setErrorModal(null)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-11 text-sm font-medium transition-colors"
              >
                확인
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 6: 라우트**

`client/src/App.tsx`: `import CompanyAnalyze from "./pages/CompanyAnalyze";` 추가, `Router`에서 `/analysis-pending` 줄 **뒤**, `/report-new` 줄 뒤에:

```tsx
      <Route path={"/company-analysis"} component={CompanyAnalyze} />
```

(`/company-report`는 Task 6에서 바로 아래에 추가한다.)

- [ ] **Step 7: 통과 + 타입 체크**

Run: `pnpm exec vitest run client/src/pages/companyAnalyzeErrors.test.ts client/src/pages/CompanyAnalyze.source.test.ts client/src/pages/analysisPending.test.ts client/src/pages/analyzeErrorMessage.test.ts && pnpm check`
Expected: PASS, tsc 0 오류.

- [ ] **Step 8: 커밋(승인 시)**

```bash
git add client/src/pages/companyAnalyzeErrors.ts client/src/pages/companyAnalyzeErrors.test.ts client/src/pages/CompanyAnalyze.tsx client/src/pages/CompanyAnalyze.source.test.ts client/src/App.tsx
git commit -m "feat(client): add the company analysis request form at /company-analysis"
```

---

### Task 5: `AnalysisPending` — `kind` 분기

**Files:**
- Modify: `client/src/pages/AnalysisPending.tsx`
- Test: `client/src/pages/analysisPending.test.ts`

**Interfaces:**
- Consumes: `AnalysisRequestStatus.kind`(Task 2).
- Produces: SUCCEEDED 시 `kind === "COMPANY"`면 `/company-report?analysisId=…`, 아니면 `/report-new?analysisId=…`. analytics 타입 `"company_report"` / `"cover_letter"`. 실패·대기 문구와 "새 분석 시작" 목적지가 kind를 따른다.

- [ ] **Step 1: 실패하는 테스트**

`client/src/pages/analysisPending.test.ts`에 추가:

```ts
  it("routes company reports to /company-report and tracks them as company_report", () => {
    expect(source).toContain("/company-report?analysisId=${encodeURIComponent(status.analysisId)}");
    expect(source).toContain("/report-new?analysisId=${encodeURIComponent(status.analysisId)}");
    expect(source).toContain('status.kind === "COMPANY" ? "company_report" : "cover_letter"');
    expect(source).toContain('navigate(kind === "COMPANY" ? "/company-analysis" : "/analyze")');
  });
```

(기존 금지 문자열 검사 — `ai_response_json`, `localStorage`, `sessionStorage`, `providerResult` — 는 그대로 통과해야 한다.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run client/src/pages/analysisPending.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`AnalysisPending.tsx`:

- import에 `type AnalysisKind` 추가: `import { parseAnalysisRequestStatus, type AnalysisKind } from "@/lib/analysisRequest";`
- 상태 추가(다른 `useState` 옆): `const [kind, setKind] = useState<AnalysisKind>("RESUME");`
- 폴링 성공/실패 분기를 다음으로 교체:

```tsx
        const status = parseAnalysisRequestStatus(await response.json());
        if (!cancelled) setKind(status.kind);
        const analyticsType = status.kind === "COMPANY" ? "company_report" : "cover_letter";
        if (status.status === "SUCCEEDED" && status.analysisId) {
          trackAnalysisComplete(analyticsType, Math.round(performance.now() - mountedAt.current));
          navigate(status.kind === "COMPANY"
            ? `/company-report?analysisId=${encodeURIComponent(status.analysisId)}`
            : `/report-new?analysisId=${encodeURIComponent(status.analysisId)}`);
          return;
        }
        if (status.status === "FAILED") {
          const contextIrrelevant = status.error === "CONTEXT_IRRELEVANT";
          trackAnalysisFailed(analyticsType, contextIrrelevant ? "context_irrelevant" : "server_error");
          if (!cancelled) { setIsContextIrrelevant(contextIrrelevant); setView("failed"); }
          return;
        }
```

- 문구 분기: `checking` 뷰의 제목/본문을 kind별로:

```tsx
  const isCompany = kind === "COMPANY";
  // checking
  <h1 ...>{isCompany ? "기업 분석을 정리하는 중이에요" : "분석 결과를 확인 중이에요"}</h1>
  <p ...>{isCompany
    ? "공개 자료를 검색해 정리하는 데 1분 정도 걸려요. 화면을 닫아도 분석은 계속됩니다."
    : "완료되는 즉시 리포트를 자동으로 열어 드릴게요. 화면을 닫아도 분석은 계속됩니다."}</p>
```

`failed` 뷰의 문맥 이탈 제목/본문:

```tsx
  isContextIrrelevant
    ? (isCompany ? "확인할 수 있는 기업이 아니에요" : "자소서 내용을 확인해 주세요")
    : "분석을 완료하지 못했어요"
  // body
  isContextIrrelevant
    ? (isCompany
        ? "입력한 회사명을 공개 자료에서 찾지 못했어요. 정확한 회사명으로 다시 시도해 주세요."
        : "입력한 내용이 자기소개서로 보기 어려워 분석하지 못했어요. 실제 자소서 문항과 답변으로 다시 시도해 주세요.")
    : "입력 내용은 브라우저에 저장하지 않았습니다. 새 분석을 시작해 주세요."
```

"새 분석 시작" 버튼: `onClick={() => navigate(kind === "COMPANY" ? "/company-analysis" : "/analyze")}`, 라벨 `{isCompany ? "새 기업 분석 시작" : "새 분석 시작"}`.

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run client/src/pages/analysisPending.test.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: 커밋(승인 시)**

```bash
git add client/src/pages/AnalysisPending.tsx client/src/pages/analysisPending.test.ts
git commit -m "feat(client): route company analyses from the pending page to the company report"
```

---

### Task 6: 리포트 화면 `/company-report`

**Files:**
- Create: `client/src/pages/companyReportParts.tsx`
- Create: `client/src/pages/CompanyReport.tsx`
- Create: `client/src/pages/CompanyReport.render.test.tsx`, `client/src/pages/CompanyReport.source.test.ts`
- Modify: `client/src/index.css` (`.report-section-anchor`), `client/src/App.tsx` (`/company-report`)

**Interfaces:**
- Consumes: `CompanyReportData`/`isRenderableCompanyReport`(Task 2), `COMPANY_REPORT_NAV_SECTIONS`/`COMPANY_HERO_ID`, `parseHighlightedText`(`./reportFirstImpression`), `scrollChildIntoHorizontalView`(`./reportLineAnalysis`), `getAuthorizationHeader`, `useAuth`, `AuthButton`, `BrandName`(`ReportResult.tsx`가 쓰는 것과 같은 import 경로를 확인해 그대로 쓴다).
- Produces: 라우트 `/company-report?analysisId=…`. 8섹션 + 부록. 다운로드·인쇄 없음.

- [ ] **Step 1: 실패하는 테스트 — 렌더(jsdom)**

`client/src/pages/CompanyReport.render.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { buildCompanyReportFixture } from "./companyReportFixture";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuth: vi.fn(),
  getAuthorizationHeader: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/company-report", mocks.navigate], Link: ({ children }: { children: unknown }) => children }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/lib/apiAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiAuth")>()),
  getAuthorizationHeader: mocks.getAuthorizationHeader,
}));
vi.mock("@/components/AuthButton", () => ({ default: () => null }));
vi.mock("@/components/Logo", () => ({ default: () => null }));

import CompanyReport from "./CompanyReport";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("CompanyReport", () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue({ user: { id: "u1", email: "a@b.c", name: "지원자" }, isLoading: false, isAuthenticated: true });
    mocks.getAuthorizationHeader.mockResolvedValue({ Authorization: "Bearer token" });
    window.history.replaceState({}, "", "/company-report?analysisId=analysis-1");
    // 스크롤 스파이용 IntersectionObserver 가 jsdom 에 없다.
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("renders the eight sections, the appendix with every source, and the disclaimers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      id: "analysis-1", kind: "COMPANY", ai_response_json: buildCompanyReportFixture(),
      company_name: "현대자동차", job_role: "전략기획",
    })));

    render(<CompanyReport />);

    await waitFor(() => expect(screen.getByText("전동화로 체급을 바꾸는 완성차")).toBeTruthy());
    for (const heading of ["돈 버는 구조", "밀고 있는 사업", "숫자로 보는 회사", "최근 1년의 국면", "이 직무의 자리", "기회와 리스크", "맡고 싶은 사업", "면접 전 체크리스트", "출처와 기준일"]) {
      expect(screen.getAllByText(heading).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("hyundai.com")).toBeTruthy();
    expect(screen.getByText("dart.fss.or.kr")).toBeTruthy();
    expect(screen.getByText(/투자 조언이 아닙니다/)).toBeTruthy();
    expect(screen.getByText(/기준일 2026-09-06/)).toBeTruthy();
    // 검색 제안 칩은 그대로 렌더된다(Google 약관).
    expect(document.querySelector('a[href="https://vertexaisearch.cloud.google.com/x"]')).toBeTruthy();
    // 항목별 각주 칩은 없다(스펙 §7-1).
    expect(screen.queryByText("[1]")).toBeNull();
    // 화면 조회 전용: 다운로드·인쇄 없음.
    expect(screen.queryByText(/저장|다운로드|인쇄|PDF/)).toBeNull();
  });

  it("sends a résumé analysis id to the résumé report instead of rendering it here", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ id: "analysis-2", kind: "RESUME", ai_response_json: { questionTabs: [] } })));

    render(<CompanyReport />);

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/report-new?analysisId=analysis-2"));
  });

  it("shows a readable error when the stored report is not renderable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ id: "analysis-3", kind: "COMPANY", ai_response_json: { brief: {} } })));

    render(<CompanyReport />);

    await waitFor(() => expect(screen.getByText("저장된 기업 분석 리포트 형식이 올바르지 않습니다.")).toBeTruthy());
  });

  it("asks unauthenticated visitors to log in", async () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });
    render(<CompanyReport />);
    expect(screen.getByText("로그인이 필요해요")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 실패하는 테스트 — 소스**

`client/src/pages/CompanyReport.source.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CompanyReport.tsx", import.meta.url), "utf8");
const parts = readFileSync(new URL("./companyReportParts.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("CompanyReport page", () => {
  it("is view-only: no print, download, or share controls", () => {
    for (const forbidden of ["window.print", "isPrinting", "Download", "Printer", "Share2", "navigator.share"]) {
      expect(source).not.toContain(forbidden);
      expect(parts).not.toContain(forbidden);
    }
  });

  it("keeps report data out of browser storage", () => {
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
  });

  it("renders the Google search suggestion chips verbatim and strips markup from model text", () => {
    expect(source).toContain("searchEntryPointHtml");
    expect(source).toContain("dangerouslySetInnerHTML");
    expect(parts).toContain("parseHighlightedText");
  });

  it("uses the shared anchor class instead of extending the résumé id list", () => {
    expect(source).toContain("report-section-anchor");
    expect(css).toMatch(/\.report-section-anchor\s*\{[^}]*scroll-margin-top/);
    expect(source).not.toContain("section-first-impression");
  });

  it("is routed at /company-report right after /company-analysis", () => {
    expect(appSource).toContain('path={"/company-report"} component={CompanyReport}');
    expect(appSource.indexOf('path={"/company-analysis"}')).toBeLessThan(appSource.indexOf('path={"/company-report"}'));
    expect(appSource.indexOf('path={"/company-report"}')).toBeLessThan(appSource.indexOf('path={"/my"}'));
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm exec vitest run client/src/pages/CompanyReport.render.test.tsx client/src/pages/CompanyReport.source.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: CSS**

`client/src/index.css`의 `#section-* { scroll-margin-top: 112px; }` 블록 **바로 아래**에 추가(기존 규칙은 건드리지 않는다):

```css
/* ── Report: 공용 섹션 앵커 여백 — 기업 분석 리포트처럼 id 가 다른 리포트도 같은 값을 쓴다 ── */
.report-section-anchor {
  scroll-margin-top: 112px;
}
@media (min-width: 1280px) {
  .report-section-anchor {
    scroll-margin-top: 80px;
  }
}
```

- [ ] **Step 5: 구현 — `companyReportParts.tsx`**

```tsx
import type { CSSProperties, ReactNode } from "react";

import { parseHighlightedText } from "./reportFirstImpression";

export const COMPANY_REPORT_DISCLAIMER =
  "AI가 공개 자료를 검색해 정리한 브리프입니다. 수치와 날짜는 부록의 출처 원문에서 확인하세요.";
export const INVESTMENT_DISCLAIMER =
  "주가·시가총액·공시 내용은 사실 서술이며 투자 조언이 아닙니다.";
export const SOURCE_NOTE = "출처는 부록 '출처와 기준일'에서 확인할 수 있어요.";

// 자소서 리포트의 마커펜 밑줄과 같은 어휘. 기업 리포트는 한 톤(에메랄드)만 쓴다.
const EMPHASIS_STYLE: CSSProperties = {
  backgroundImage: "linear-gradient(to top, rgba(105,211,177,0.34) 0 6px, transparent 6px)",
  boxDecorationBreak: "clone",
  WebkitBoxDecorationBreak: "clone",
};

/** `**문장**` 을 강조로 그린다. emphasize=false 면 마커만 벗기고 평문으로. 태그는 parseHighlightedText 가 제거한다. */
export function renderCompanyText(text: string | null | undefined, emphasize = false): ReactNode[] {
  return parseHighlightedText(text ?? "").map((segment, index) => (
    emphasize && segment.kind === "bold"
      ? <strong key={`${segment.text}-${index}`} className="rounded-[2px] font-semibold text-zinc-100" style={EMPHASIS_STYLE}>{segment.text}</strong>
      : <span key={`${segment.text}-${index}`}>{segment.text}</span>
  ));
}

export function CompanySectionNumber({ value }: { value: string }) {
  return <span className="mr-3.5 font-semibold tabular-nums text-zinc-700">{value}</span>;
}

export function CompanySectionHeading({ index, title, deck }: { index: string; title: string; deck?: string }) {
  return (
    <>
      <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-6 tracking-tight">
        <CompanySectionNumber value={index} />{title}
      </h3>
      {deck ? <p className="text-base text-zinc-400 mb-12 max-w-2xl leading-[1.75]">{renderCompanyText(deck)}</p> : null}
    </>
  );
}

/** 섹션 끝의 출처 안내 한 줄(스펙 §7-1: 항목별 각주 칩 대신). */
export function SourceNote() {
  return <p className="mt-10 text-xs text-zinc-600">{SOURCE_NOTE}</p>;
}

export function PhaseBadge({ label }: { label: string }) {
  return <span className="inline-block rounded-md border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] text-zinc-400">{label}</span>;
}

/** 직무 연관도(직접/간접/무관). 직접만 하늘색, 간접은 회색, 무관은 그리지 않는다. */
export function RelevanceBadge({ relevance }: { relevance: string }) {
  const level = relevance.startsWith("직접") ? "direct" : relevance.startsWith("간접") ? "indirect" : "none";
  if (level === "none") return null;
  return (
    <span className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-semibold ${
      level === "direct"
        ? "border border-sky-300/20 bg-sky-300/[0.08] text-sky-300"
        : "border border-white/[0.07] bg-white/[0.04] text-zinc-400"
    }`}>
      {level === "direct" ? "직무와 직접 연결" : "직무와 간접 연결"}
    </span>
  );
}

export interface TimelineEntry {
  when: string;
  title: string;
  body: ReactNode;
  tail?: ReactNode;
}

/** 좌측 날짜 레일 세로 타임라인(04 국면, 05 직무 소식). */
export function Timeline({ entries, dense = false }: { entries: TimelineEntry[]; dense?: boolean }) {
  return (
    <ol className="relative border-l border-white/[0.08] pl-6 space-y-8">
      {entries.map((entry, index) => (
        <li key={`${entry.when}-${index}`} className="relative">
          <span aria-hidden="true" className="absolute -left-[29px] top-1.5 size-[9px] rounded-full border border-white/[0.2] bg-[#09090B]" />
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 tabular-nums">{entry.when}</p>
          <p className={`${dense ? "text-[15px]" : "text-[17px]"} font-semibold leading-[1.45] tracking-[-0.01em] text-zinc-50`}>{entry.title}</p>
          <div className={`mt-2 ${dense ? "text-[14px]" : "text-[15px]"} leading-[1.85] text-zinc-400`}>{entry.body}</div>
          {entry.tail ? <div className="mt-2 text-[14px] leading-[1.8] text-zinc-300">{entry.tail}</div> : null}
        </li>
      ))}
    </ol>
  );
}

export function HeadlineCard({ headline, text, tone }: { headline: string; text: string; tone: "opportunity" | "risk" }) {
  const dot = tone === "opportunity"
    ? "bg-emerald-400/85 shadow-[0_0_8px_rgba(52,211,153,0.35)]"
    : "bg-rose-400/70 shadow-[0_0_8px_rgba(251,113,133,0.25)]";
  return (
    <div className="mt-7 border-t border-white/[0.05] pt-7 first:mt-0 first:border-t-0 first:pt-0">
      <p className="mb-2.5 flex items-center gap-2.5 text-[17px] font-semibold leading-[1.45] tracking-[-0.01em] text-zinc-50">
        <span aria-hidden="true" className={`mx-[3px] inline-block size-[7px] shrink-0 rounded-full ${dot}`} />
        {headline}
      </p>
      <p className="pl-[23px] text-[15px] leading-[1.85] text-zinc-400">{renderCompanyText(text, true)}</p>
    </div>
  );
}
```

- [ ] **Step 6: 구현 — `CompanyReport.tsx`**

`ReportResult.tsx`가 `BrandName`을 어디서 import하는지 확인해(`grep -n "BrandName" client/src/pages/ReportResult.tsx`) 같은 경로를 쓴다. 아래는 `@/components/BrandName`이라 가정하고 썼다 — 실제 경로로 맞춘다.

```tsx
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ExternalLink, X } from "lucide-react";

import AuthButton from "@/components/AuthButton";
import BrandName from "@/components/BrandName";
import { useAuth } from "@/contexts/AuthContext";
import { AuthenticationRequiredError, getAuthorizationHeader } from "@/lib/apiAuth";
import { isRenderableCompanyReport, type CompanyReportData } from "@/types/companyReport";
import { COMPANY_HERO_ID, COMPANY_REPORT_NAV_SECTIONS } from "./companyReportNavigation";
import {
  COMPANY_REPORT_DISCLAIMER,
  CompanySectionHeading,
  HeadlineCard,
  INVESTMENT_DISCLAIMER,
  PhaseBadge,
  RelevanceBadge,
  SourceNote,
  Timeline,
  renderCompanyText,
} from "./companyReportParts";
import { scrollChildIntoHorizontalView } from "./reportLineAnalysis";

// ── 목차 ───────────────────────────────────────────────────────────────────────

function MiniNavigator({ activeSection }: { activeSection: string }) {
  return (
    <nav className="report-nav hidden xl:block" aria-label="리포트 목차">
      <div className="report-nav-list">
        {COMPANY_REPORT_NAV_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`report-nav-item ${activeSection === section.id ? "active" : ""}`}
            aria-current={activeSection === section.id ? "location" : undefined}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span className="report-nav-index">{section.indexLabel}.</span>
            <span>{section.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

function SectionChipBar({ activeSection }: { activeSection: string }) {
  const barRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-section="${activeSection}"]`) ?? null;
    scrollChildIntoHorizontalView(bar, chip);
  }, [activeSection]);

  return (
    <nav ref={barRef} className="xl:hidden mx-auto flex max-w-4xl gap-2 overflow-x-auto hide-scrollbar whitespace-nowrap px-6 pb-3 md:px-8" aria-label="리포트 목차">
      {COMPANY_REPORT_NAV_SECTIONS.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            data-section={section.id}
            aria-current={isActive ? "location" : undefined}
            className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors ${
              isActive ? "border-emerald-300/[0.22] bg-emerald-300/[0.08] text-emerald-100/80" : "border-white/[0.07] bg-white/[0.03] text-zinc-500"
            }`}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span className={`text-[11px] font-semibold tabular-nums ${isActive ? "text-emerald-100/80" : "text-zinc-600"}`}>{section.indexLabel}</span>
            <span>{section.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

// ── 데이터 로딩 ──────────────────────────────────────────────────────────────

interface LoadedReport {
  analysisId: string;
  company: string;
  jobRole: string;
  report: CompanyReportData;
}

function AuthenticatedCompanyReport() {
  const [, navigate] = useLocation();
  const requestedAnalysisId = new URLSearchParams(window.location.search).get("analysisId");
  const [loaded, setLoaded] = useState<LoadedReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestedAnalysisId) {
      setError("기업 분석 리포트를 찾을 수 없습니다.");
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setLoaded(null); setError(null); setIsLoading(true);
        const response = await fetch(`/api/analysis/${encodeURIComponent(requestedAnalysisId)}`, {
          headers: await getAuthorizationHeader(),
        });
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(payload?.message || payload?.error || "기업 분석 리포트를 불러오지 못했습니다.");
        }
        // 자소서 분석 id 로 들어오면 자소서 리포트로 보낸다.
        if (payload?.kind === "RESUME") {
          navigate(`/report-new?analysisId=${encodeURIComponent(payload.id ?? requestedAnalysisId)}`);
          return;
        }
        if (!isRenderableCompanyReport(payload?.ai_response_json)) {
          throw new Error("저장된 기업 분석 리포트 형식이 올바르지 않습니다.");
        }
        setLoaded({
          analysisId: payload.id ?? requestedAnalysisId,
          company: payload.company_name ?? "",
          jobRole: payload.job_role ?? "",
          report: payload.ai_response_json,
        });
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof AuthenticationRequiredError
          ? "로그인이 만료되었어요. 다시 로그인한 뒤 리포트를 열어 주세요."
          : caught instanceof Error ? caught.message : "기업 분석 리포트를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [navigate, requestedAnalysisId]);

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center text-sm text-zinc-400">기업 분석 리포트를 불러오는 중이에요.</main>;
  }
  if (error || !loaded) {
    return <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center text-sm text-red-400">{error ?? "기업 분석 리포트를 불러오지 못했습니다."}</main>;
  }
  return <CompanyReportContent {...loaded} />;
}

// ── 본문 ──────────────────────────────────────────────────────────────────────

function CompanyReportContent({ company, jobRole, report }: LoadedReport) {
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState(COMPANY_REPORT_NAV_SECTIONS[0].id);
  const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(0);
  const asOf = report.reportMeta?.asOf || report.brief.asOf || "";
  const numbers = report.financialSnapshot;
  const role = report.roleInContext;

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    COMPANY_REPORT_NAV_SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id);
      if (!element) return;
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(section.id); },
        { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
      );
      observer.observe(element);
      observers.push(observer);
    });
    return () => observers.forEach((observer) => observer.disconnect());
  }, []);

  const sectionClass = "py-24 section-divider report-section-anchor";

  return (
    <main className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-indigo-500/20">
      <MiniNavigator activeSection={activeSection} />

      <div className="sticky top-0 z-50 w-full bg-[#09090B]/95 backdrop-blur-md border-b border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-6 md:px-8 pt-4 pb-3 sm:pt-6 sm:pb-4 flex items-center justify-between">
          <button onClick={() => window.history.back()} className="inline-flex items-center gap-2.5 text-sm text-zinc-500 hover:text-white transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>뒤로</span>
          </button>
          <div className="flex items-center gap-2">
            <button className="text-[13px] text-gray-300 hover:text-white hover:bg-white/10 font-medium h-8 px-3 rounded-md transition-colors duration-200" onClick={() => navigate("/my")}>
              내 지원서
            </button>
            <AuthButton />
          </div>
        </div>
        <SectionChipBar activeSection={activeSection} />
      </div>

      <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10 pt-4">
        {/* 표지 */}
        <header id={COMPANY_HERO_ID} className="pt-8 pb-[6.5rem] section-divider">
          <div className="relative min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0B0B0E] px-5 py-5 sm:px-8 sm:py-7 md:px-10 md:py-9">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.09),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_48%)]" />
            <div className="pointer-events-none absolute inset-px rounded-[15px] border border-white/[0.035]" />
            <div className="relative flex min-w-0 flex-col gap-2 border-b border-white/[0.06] pb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
              <BrandName className="h-3.5 self-start" />
              <span className="min-w-0 break-words sm:text-right">Company Brief · {company}{jobRole ? ` · ${jobRole}` : ""}</span>
            </div>
            <div className="relative min-w-0 py-12 text-center sm:py-14 md:py-[4.25rem]">
              <p className="mb-5 text-[15px] sm:text-base text-zinc-300">{company}는</p>
              <h1 className="mx-auto max-w-3xl text-[2.08rem] sm:text-[3.15rem] md:text-[4.05rem] font-semibold leading-[1.04] tracking-tight text-white">
                {report.brief.oneLiner}
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-[16px] sm:text-[19px] leading-[1.8] text-zinc-300 text-balance">
                {renderCompanyText(report.brief.positionInIndustry)}
              </p>
            </div>
            <div className="relative flex min-w-0 flex-wrap justify-center gap-2.5 pb-6">
              {report.brief.keywords.map((keyword) => (
                <span key={keyword} className="max-w-full rounded-full border border-white/[0.12] bg-white/[0.045] px-3.5 py-2 text-xs font-semibold text-zinc-300">{keyword}</span>
              ))}
            </div>
            <p className="relative text-center text-[11px] uppercase tracking-[0.14em] text-zinc-600">
              기준일 {asOf} · 출처 {report.sources.length}건
            </p>
          </div>
        </header>

        {/* 01 돈 버는 구조 */}
        <section id="company-business" className={sectionClass}>
          <CompanySectionHeading index="01" title="돈 버는 구조" deck={report.businessMap.summary} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {report.businessMap.segments.map((segment) => (
              <div key={segment.name} className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[17px] font-semibold text-zinc-50">{segment.name}</p>
                  {segment.phase ? <PhaseBadge label={segment.phase} /> : null}
                </div>
                <p className="text-[15px] leading-[1.8] text-zinc-400">{renderCompanyText(segment.whatItDoes)}</p>
                {segment.weight ? <p className="mt-3 text-[13px] text-zinc-500">{renderCompanyText(segment.weight)}</p> : null}
              </div>
            ))}
          </div>
          {report.businessMap.customersAndCompetitors ? (
            <p className="mt-10 text-[15px] leading-[1.85] text-zinc-300 max-w-2xl">{renderCompanyText(report.businessMap.customersAndCompetitors)}</p>
          ) : null}
          <SourceNote />
        </section>

        {/* 02 밀고 있는 사업 */}
        <section id="company-focus" className={sectionClass}>
          <CompanySectionHeading index="02" title="밀고 있는 사업" />
          {report.focusBusinesses.statedDirection ? (
            <blockquote className="mb-12 border-l-2 border-white/[0.12] pl-5 text-[15px] leading-[1.85] text-zinc-400">
              {renderCompanyText(report.focusBusinesses.statedDirection)}
            </blockquote>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {report.focusBusinesses.items.map((item) => (
              <div key={item.name} className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="text-[17px] font-semibold text-zinc-50">{item.name}</p>
                  <RelevanceBadge relevance={item.relevanceToRole} />
                </div>
                <p className="text-[15px] leading-[1.8] text-zinc-300">{renderCompanyText(item.whatChanged)}</p>
                <p className="mt-3 text-[14px] leading-[1.8] text-zinc-400">{renderCompanyText(item.evidence)}</p>
                <p className="mt-3 text-[14px] leading-[1.8] text-zinc-500">{renderCompanyText(item.whyNow)}</p>
              </div>
            ))}
          </div>
          {report.focusBusinesses.translatedTalentKeywords.length > 0 ? (
            <div className="mt-12 rounded-xl border border-white/[0.05] bg-white/[0.03] p-6 sm:p-8">
              <p className="mb-5 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">인재상 문구를 사업 언어로</p>
              <ul className="space-y-3">
                {report.focusBusinesses.translatedTalentKeywords.map((pair) => (
                  <li key={pair.stated} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_24px_minmax(0,2fr)] gap-2 text-[15px] leading-[1.7]">
                    <span className="text-zinc-500">{pair.stated}</span>
                    <span aria-hidden="true" className="hidden sm:block text-zinc-700">→</span>
                    <span className="text-zinc-200">{renderCompanyText(pair.meaning)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <SourceNote />
        </section>

        {/* 03 숫자로 보는 회사 */}
        <section id="company-numbers" className={sectionClass}>
          <CompanySectionHeading index="03" title="숫자로 보는 회사" />
          {numbers.keyFigures.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {numbers.keyFigures.slice(0, 4).map((figure) => (
                <div key={`${figure.label}-${figure.period}`} className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-5">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 mb-2">{figure.label}</p>
                  <p className="text-[22px] font-semibold tabular-nums text-zinc-50 leading-tight">{figure.value}</p>
                  <p className="mt-2 text-[12px] text-zinc-600">{figure.period}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-3">매출</p>
              <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(numbers.revenueTrend)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-3">이익</p>
              <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(numbers.profitTrend)}</p>
            </div>
          </div>
          {numbers.listed ? (
            <div className="mt-10 rounded-xl border border-white/[0.05] bg-white/[0.03] p-6 sm:p-8">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">시장과 공시{numbers.market ? ` · ${numbers.market}` : ""}</p>
              {numbers.marketView ? <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(numbers.marketView)}</p> : null}
              {numbers.recentDisclosures.length > 0 ? (
                <ul className="mt-5 space-y-2">
                  {numbers.recentDisclosures.map((disclosure) => (
                    <li key={`${disclosure.when}-${disclosure.title}`} className="flex items-start gap-3 text-[14px] leading-[1.7] text-zinc-400">
                      <span className="shrink-0 tabular-nums text-zinc-600">{disclosure.when}</span>
                      <span>{disclosure.title}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-6 text-xs text-zinc-600">{INVESTMENT_DISCLAIMER}</p>
            </div>
          ) : numbers.fundingNote ? (
            <div className="mt-10 rounded-xl border border-white/[0.05] bg-white/[0.03] p-6 sm:p-8">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">투자와 기업가치</p>
              <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(numbers.fundingNote)}</p>
            </div>
          ) : null}
          {numbers.forApplicant ? (
            <p className="mt-10 text-[15px] leading-[1.85] text-zinc-200 max-w-2xl">{renderCompanyText(numbers.forApplicant, true)}</p>
          ) : null}
          <SourceNote />
        </section>

        {/* 04 최근 1년의 국면 */}
        <section id="company-issues" className={sectionClass}>
          <CompanySectionHeading index="04" title="최근 1년의 국면" />
          <Timeline
            entries={report.currentIssues.map((issue) => ({
              when: issue.when,
              title: issue.title,
              body: (
                <>
                  <span>{renderCompanyText(issue.fact)}</span>{" "}
                  <span className="text-zinc-300">{renderCompanyText(issue.whyItMatters)}</span>
                </>
              ),
              tail: renderCompanyText(issue.forApplicant, true),
            }))}
          />
          <SourceNote />
        </section>

        {/* 05 이 직무의 자리 */}
        <section id="company-role" className={sectionClass}>
          <CompanySectionHeading index="05" title={`이 직무의 자리${jobRole ? ` · ${jobRole}` : ""}`} deck={role.whereItSits} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-4">이 직무가 지금 푸는 문제</p>
              <ul className="space-y-3">
                {role.problemsItSolves.map((problem) => (
                  <li key={problem} className="flex items-start gap-2.5 text-[15px] leading-[1.7] text-zinc-200">
                    <span className="mt-[9px] size-[5px] shrink-0 rounded-full bg-zinc-600" />{renderCompanyText(problem)}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-4">지금 뽑는 이유(가설)</p>
              <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(role.whyHiringNow)}</p>
            </div>
          </div>
          {role.postingReading ? (
            <div className="mb-12 rounded-xl border border-white/[0.05] bg-white/[0.03] p-6 sm:p-8">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">채용공고 읽기</p>
              <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(role.postingReading)}</p>
            </div>
          ) : null}
          {role.recentNewsForRole.length > 0 ? (
            <>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-6">이 직무와 연결된 최신 소식</p>
              <Timeline
                dense
                entries={role.recentNewsForRole.map((news) => ({
                  when: news.when,
                  title: news.title,
                  body: renderCompanyText(news.fact),
                  tail: renderCompanyText(news.whyForRole),
                }))}
              />
            </>
          ) : null}
          <SourceNote />
        </section>

        {/* 06 기회와 리스크 */}
        <section id="company-risks" className={sectionClass}>
          <CompanySectionHeading index="06" title="기회와 리스크" deck="지원자의 시선으로 골랐어요. 면접에서 '우리 회사의 숙제가 뭐라고 보나요'에 답할 재료입니다." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-14">
            <div>
              <p className="mb-6 flex items-center gap-2 text-[15px] font-bold text-emerald-300/90"><Check className="w-4 h-4 text-emerald-400/60" />기회</p>
              {report.opportunitiesAndRisks.opportunities.map((item) => (
                <HeadlineCard key={item.headline} headline={item.headline} text={item.text} tone="opportunity" />
              ))}
            </div>
            <div>
              <p className="mb-6 flex items-center gap-2 text-[15px] font-bold text-rose-300/80"><X className="w-4 h-4 text-rose-400/50" />리스크</p>
              {report.opportunitiesAndRisks.risks.map((item) => (
                <HeadlineCard key={item.headline} headline={item.headline} text={item.text} tone="risk" />
              ))}
            </div>
          </div>
          <SourceNote />
        </section>

        {/* 07 맡고 싶은 사업 */}
        <section id="company-candidates" className={sectionClass}>
          <CompanySectionHeading index="07" title="맡고 싶은 사업" deck="자소서에 쓸 만한 사업과 각도입니다. 문장이 아니라 방향이니, 본인 경험으로 채워 주세요." />
          <div className="grid grid-cols-1 gap-5">
            {report.businessCandidates.map((candidate, index) => (
              <div key={candidate.name} className="rounded-xl border border-sky-300/20 bg-sky-300/[0.05] p-6 sm:p-8">
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-[28px] font-extrabold leading-none tracking-[0.08em] text-sky-300/70">{String(index + 1).padStart(2, "0")}</span>
                  <p className="text-[19px] font-semibold text-zinc-50">{candidate.name}</p>
                </div>
                <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(candidate.whyForThisRole)}</p>
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-sky-300/80 mb-2 font-semibold">잡을 각도</p>
                    <p className="text-[14px] leading-[1.8] text-zinc-300">{renderCompanyText(candidate.angle)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 mb-2 font-semibold">연결하면 좋은 경험</p>
                    <p className="text-[14px] leading-[1.8] text-zinc-400">{renderCompanyText(candidate.experienceToPrepare)}</p>
                  </div>
                </div>
                {candidate.seedSentence ? (
                  <blockquote className="mt-6 border-l-2 border-sky-300/30 pl-4 text-[15px] italic leading-[1.8] text-zinc-200">
                    {renderCompanyText(candidate.seedSentence)}
                  </blockquote>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={() => navigate(`/analyze?company=${encodeURIComponent(company)}&jobKeyword=${encodeURIComponent(jobRole)}`)}
              className="w-full sm:w-auto px-6 py-3.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
            >
              <span>이 각도로 쓴 자소서, 채용 담당자 시선으로 확인하기</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            {report.reportMeta?.linkedResumeAnalysisId ? (
              <button
                onClick={() => navigate(`/report-new?analysisId=${encodeURIComponent(report.reportMeta?.linkedResumeAnalysisId ?? "")}`)}
                className="w-full sm:w-auto px-6 py-3.5 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition-colors"
              >
                연결된 자소서 분석 보기
              </button>
            ) : null}
          </div>
        </section>

        {/* 08 면접 전 체크리스트 */}
        <section id="company-interview" className={sectionClass}>
          <CompanySectionHeading index="08" title="면접 전 체크리스트" />
          <div className="space-y-0">
            {report.interviewPrep.questions.map((item, index) => (
              <div key={`${index}-${item.question}`} className="border-b border-white/[0.04] last:border-0">
                <button onClick={() => setOpenQuestionIndex(openQuestionIndex === index ? null : index)} className="w-full py-6 flex items-start gap-5 text-left group">
                  <span className="text-xs uppercase tracking-[0.12em] text-zinc-500 mt-1 min-w-[50px] font-medium">Q{index + 1}</span>
                  <span className="flex-1 text-[17px] text-zinc-300 group-hover:text-white transition-colors leading-[1.6]">{renderCompanyText(item.question)}</span>
                  <ChevronDown className={`w-5 h-5 text-zinc-600 transition-transform mt-0.5 ${openQuestionIndex === index ? "rotate-180" : ""}`} />
                </button>
                {openQuestionIndex === index ? (
                  <div className="pb-8 pl-[70px]">
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 mb-3 font-medium">답변 방향</p>
                    <p className="text-[15px] text-zinc-400 leading-[1.8]">{renderCompanyText(item.direction, true)}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {report.interviewPrep.primarySources.length > 0 ? (
            <div className="mt-12">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-4">더 읽어볼 1차 자료</p>
              <ul className="space-y-2">
                {report.interviewPrep.primarySources.map((primary) => (
                  <li key={`${primary.label}-${primary.url}`}>
                    <a href={primary.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[15px] text-zinc-300 hover:text-white">
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-600" />{primary.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* 09 부록: 출처와 기준일 */}
        <section id="company-sources" className="pt-24 pb-20 report-section-anchor">
          <CompanySectionHeading index="09" title="출처와 기준일" />
          <p className="text-[14px] leading-[1.8] text-zinc-400 mb-2">기준일 {asOf}. {COMPANY_REPORT_DISCLAIMER}</p>
          <p className="text-xs text-zinc-600 mb-10">링크는 검색 제공자의 리다이렉트 주소라 시간이 지나면 열리지 않을 수 있어요. 제목과 발행처로 원문을 찾아 주세요.</p>
          <ol className="space-y-3">
            {report.sources.map((source) => (
              <li key={source.id} className="grid grid-cols-[32px_1fr] gap-3 text-[15px] leading-[1.7]">
                <span className="tabular-nums text-zinc-600">{source.id}.</span>
                <span className="min-w-0">
                  <span className="text-zinc-200">{source.title}</span>
                  {source.publisher && source.publisher !== source.title ? <span className="text-zinc-500"> · {source.publisher}</span> : null}
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-white">
                    <ExternalLink className="w-3 h-3" />열기
                  </a>
                </span>
              </li>
            ))}
          </ol>
          {report.reportMeta?.searchEntryPointHtml ? (
            // Google 검색 그라운딩 약관: 검색 제안 칩을 그대로 표시한다. 스크립트가 없는 마크업임을 프로브로 확인했다.
            <div className="mt-12 rounded-xl border border-white/[0.06] bg-white p-3 text-zinc-900" dangerouslySetInnerHTML={{ __html: report.reportMeta.searchEntryPointHtml }} />
          ) : null}
        </section>

        <footer className="pt-16 pb-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-zinc-600">
            <p>Pre:View 2026. All rights reserved.</p>
            <button onClick={() => navigate("/company-analysis")} className="underline-offset-4 hover:underline">다른 회사 분석하기</button>
          </div>
        </footer>
      </article>
    </main>
  );
}

export default function CompanyReport() {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center text-sm text-zinc-400">로그인 정보를 확인하는 중이에요.</main>;
  }
  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center">
        <section className="max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8">
          <h1 className="text-lg font-semibold text-white">로그인이 필요해요</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">로그인 후 기업 분석 리포트를 확인할 수 있어요.</p>
          <a href={`/login?redirect=${encodeURIComponent("/company-report")}`} className="mt-6 inline-flex rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-900">로그인하기</a>
        </section>
      </main>
    );
  }
  return <AuthenticatedCompanyReport />;
}
```

- [ ] **Step 7: 라우트**

`client/src/App.tsx`: `import CompanyReport from "./pages/CompanyReport";`, `/company-analysis` 줄 바로 아래에 `<Route path={"/company-report"} component={CompanyReport} />`.

- [ ] **Step 8: 통과 + 타입 체크**

Run: `pnpm exec vitest run client/src/pages/CompanyReport.render.test.tsx client/src/pages/CompanyReport.source.test.ts client/src/pages/ReportResult.mobile.test.ts client/src/pages/reportNavigation.test.ts client/src/pages/CompanyAnalyze.source.test.ts && pnpm check`
Expected: PASS, tsc 0 오류. 렌더 테스트가 `BrandName` 경로 때문에 실패하면 `ReportResult.tsx`의 import 경로로 맞춘다(테스트를 고치지 않는다).

- [ ] **Step 9: 커밋(승인 시)**

```bash
git add client/src/pages/companyReportParts.tsx client/src/pages/CompanyReport.tsx client/src/pages/CompanyReport.render.test.tsx client/src/pages/CompanyReport.source.test.ts client/src/index.css client/src/App.tsx
git commit -m "feat(client): render the company analysis report at /company-report"
```

---

### Task 7: 내 지원서 — `kind` 배지·목적지, 이용권 잔여 행

**Files:**
- Modify: `client/src/components/my/ProjectCard.tsx`, `client/src/pages/MyProjects.tsx`, `client/src/pages/MyEntitlements.tsx`
- Test: `client/src/pages/MyProjects.persistence.test.ts`(기존, 확장), `client/src/components/my/ProjectCard.kind.test.ts`(신규)

**Interfaces:**
- Consumes: `ProjectSummary.kind?`(Task 3), `EntitlementSummary.companyRemaining`.
- Produces: 기업 프로젝트 카드에 `기업 분석` 배지, 메타 줄 "기업 분석 리포트", "작성한 자소서 보기" 숨김; 리포트 보기 → `/company-report`; 이용권 페이지에 "기업 분석 이용권" 행.

- [ ] **Step 1: 실패하는 테스트**

`client/src/components/my/ProjectCard.kind.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ProjectCard.tsx", import.meta.url), "utf8");

describe("ProjectCard kind handling", () => {
  it("labels company projects and hides résumé-only affordances", () => {
    expect(source).toContain('project.kind === "COMPANY"');
    expect(source).toContain("기업 분석 리포트");
    expect(source).toContain("작성한 자소서 보기");
    // 자소서 보기 버튼은 기업 프로젝트에서 그리지 않는다.
    expect(source).toMatch(/isCompany\s*\?\s*null\s*:/);
  });
});
```

`client/src/pages/MyProjects.persistence.test.ts`에 추가:

```ts
  it("opens company reports at /company-report and résumé reports at /report-new", () => {
    expect(source).toContain('project.kind === "COMPANY" ? `/company-report?${query}` : `/report-new?${query}`');
    expect(source).toContain("analysisId=${encodeURIComponent(project.latest_analysis_id)}");
  });
```

(`source` 변수명은 그 파일이 이미 쓰는 이름을 따른다.)

`client/src/pages/MyEntitlements.tsx`에 대한 소스 테스트가 없으면 `client/src/pages/MyEntitlements.company.test.ts`를 만든다:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./MyEntitlements.tsx", import.meta.url), "utf8");

describe("MyEntitlements company row", () => {
  it("shows the company analysis credit balance as its own row", () => {
    expect(source).toContain("기업 분석 이용권");
    expect(source).toContain("summary.companyRemaining");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run client/src/components/my/ProjectCard.kind.test.ts client/src/pages/MyProjects.persistence.test.ts client/src/pages/MyEntitlements.company.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현 — `ProjectCard.tsx`**

컴포넌트 상단에 `const isCompany = project.kind === "COMPANY";`. import에 `Building2` 추가(lucide). 배지 행의 `샘플` 배지 아래에:

```tsx
            {isCompany && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-400/25 whitespace-nowrap">
                기업 분석
              </span>
            )}
```

메타 줄의 문항 수 항목을:

```tsx
            <div className="flex items-center gap-2">
              {isCompany ? <Building2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              <span>{isCompany ? "기업 분석 리포트" : `${project.question_count ?? project.analysis_count}개 문항`}</span>
            </div>
```

"작성한 자소서 보기" 버튼을 조건부로:

```tsx
            {isCompany ? null : (
              <button
                onClick={(e) => { e.stopPropagation(); onViewQuestions(); }}
                className="w-full flex items-center justify-center gap-1.5 h-10 rounded-lg border border-zinc-700 bg-zinc-800/40 text-[13px] font-medium text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100 transition-all duration-200"
              >
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                <span>작성한 자소서 보기</span>
              </button>
            )}
```

- [ ] **Step 4: 구현 — `MyProjects.tsx`**

`onViewReport`를:

```tsx
                  onViewReport={() => {
                    if (project.latest_analysis_id) {
                      const query = `analysisId=${encodeURIComponent(project.latest_analysis_id)}`;
                      navigate(project.kind === "COMPANY" ? `/company-report?${query}` : `/report-new?${query}`);
                    } else {
                      setLoadError("저장된 분석 리포트를 찾을 수 없습니다.");
                    }
                  }}
```

- [ ] **Step 5: 구현 — `MyEntitlements.tsx`**

기존 `CreditSummaryRow` 두 개(무료 `summary.freeRemaining`, 프리미엄 `summary.premiumRemaining`) 아래에 같은 컴포넌트로 행을 추가한다:

```tsx
                <CreditSummaryRow
                  title="기업 분석 이용권"
                  description="회사·직무를 넣으면 기업 분석 리포트를 만들어 드려요."
                  remaining={summary.companyRemaining}
                />
```

`CreditSkeleton`의 행 수가 `[1, 2, 3]`으로 고정이면 `[1, 2, 3, 4]`로 늘린다.

- [ ] **Step 6: 통과 + 타입 체크**

Run: `pnpm exec vitest run client/src/components/my client/src/pages/MyProjects.persistence.test.ts client/src/pages/MyEntitlements.company.test.ts && pnpm check`
Expected: PASS.

- [ ] **Step 7: 커밋(승인 시)**

```bash
git add client/src/components/my/ProjectCard.tsx client/src/components/my/ProjectCard.kind.test.ts client/src/pages/MyProjects.tsx client/src/pages/MyProjects.persistence.test.ts client/src/pages/MyEntitlements.tsx client/src/pages/MyEntitlements.company.test.ts
git commit -m "feat(client): show company analyses in my projects and the company credit balance"
```

---

### Task 8: 관리자 — 스위치 토글과 kind 지급

**Files:**
- Modify: `client/src/lib/admin-entitlements.ts`, `client/src/lib/admin-entitlements.test.ts`, `client/src/pages/admin/settings/SettingsPage.tsx`
- Modify: `client/src/lib/admin-credits.ts`, `client/src/components/admin/users/UserCreditManagementCard.tsx`, `client/src/pages/admin/users/UserCredits.ui.test.ts`
- Test: `client/src/lib/admin-credits.test.ts`(없으면 신규)

**Interfaces:**
- Produces: `PremiumSalesSettings { premiumEnabled: boolean; companyAnalysisEnabled: boolean }`, `updateCompanyAnalysisEnabled(enabled: boolean)`; `UserCreditSummary.companyRemaining: number`(응답에 없으면 0); `grantUserCredits({ userId, credits, note?, kind? })`.

- [ ] **Step 1: 실패하는 테스트 — 스위치 라이브러리**

`client/src/lib/admin-entitlements.test.ts`: `resolves.toEqual({ premiumEnabled: true })` 류 기대값에 `companyAnalysisEnabled: false`를 추가하고, 다음 테스트를 추가:

```ts
  it("reads the company analysis switch and patches it independently", async () => {
    mockedFetch().mockResolvedValueOnce(jsonResponse({ premiumEnabled: false, companyAnalysisEnabled: true }));
    await expect(fetchPremiumSalesSettings()).resolves.toEqual({ premiumEnabled: false, companyAnalysisEnabled: true });

    mockedFetch().mockResolvedValueOnce(jsonResponse({ premiumEnabled: false, companyAnalysisEnabled: false }));
    await expect(updateCompanyAnalysisEnabled(false)).resolves.toEqual({ premiumEnabled: false, companyAnalysisEnabled: false });
    expect(mockedFetch()).toHaveBeenLastCalledWith("/api/admin/entitlements", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ companyAnalysisEnabled: false }),
    }));
  });
```

(`mockedFetch`, `jsonResponse` 헬퍼는 그 파일의 기존 이름을 따른다.)

- [ ] **Step 2: 실패하는 테스트 — 크레딧 라이브러리와 UI**

`client/src/lib/admin-credits.test.ts`(없으면 신규; `admin-entitlements.test.ts`의 모킹 패턴을 그대로 복제):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { auth: { getSession: mocks.getSession } } }));

import { fetchUserCredits, grantUserCredits } from "./admin-credits";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const SUMMARY = { premiumEnabled: true, freeRemaining: 0, bonusRemaining: 1, premiumRemaining: 2, remaining: 3 };

describe("admin credits client", () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "session-token" } } });
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the grant kind and reads the company balance", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ summary: { ...SUMMARY, companyRemaining: 4 } }));

    const summary = await grantUserCredits({ userId: "u1", credits: 2, kind: "COMPANY" });

    expect(summary.companyRemaining).toBe(4);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/credits", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ userId: "u1", credits: 2, note: undefined, kind: "COMPANY" }),
    }));
  });

  it("defaults the company balance to 0 for older server responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ summary: SUMMARY, grants: [] }));
    const result = await fetchUserCredits("u1");
    expect(result.summary.companyRemaining).toBe(0);
  });
});
```

`client/src/pages/admin/users/UserCredits.ui.test.ts`에 추가(그 파일의 `read` 헬퍼 사용):

```ts
  it("lets the administrator choose the credit kind and see the company balance", () => {
    const card = read("client/src/components/admin/users/UserCreditManagementCard.tsx");
    expect(card).toContain('value="COMPANY"');
    expect(card).toContain("기업 분석");
    expect(card).toContain("companyRemaining");
    expect(read("client/src/lib/admin-credits.ts")).toContain("kind");
  });
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm exec vitest run client/src/lib/admin-entitlements.test.ts client/src/lib/admin-credits.test.ts client/src/pages/admin/users/UserCredits.ui.test.ts`
Expected: FAIL.

- [ ] **Step 4: 구현 — `admin-entitlements.ts`**

```ts
export interface PremiumSalesSettings {
  premiumEnabled: boolean;
  /** 기업 분석 리포트 생성·판매 스위치. 구버전 서버 응답에 없으면 false. */
  companyAnalysisEnabled: boolean;
}
// ...requestPremiumSalesSettings 의 반환:
  return {
    premiumEnabled: payload.premiumEnabled,
    companyAnalysisEnabled: payload.companyAnalysisEnabled === true,
  };
// ...추가:
export function updateCompanyAnalysisEnabled(companyAnalysisEnabled: boolean): Promise<PremiumSalesSettings> {
  return requestPremiumSalesSettings(
    { method: "PATCH", body: JSON.stringify({ companyAnalysisEnabled }) },
    "기업 분석 스위치를 변경하지 못했습니다.",
  );
}
```

- [ ] **Step 5: 구현 — `SettingsPage.tsx`**

import에 `updateCompanyAnalysisEnabled` 추가. 상태·핸들러(기존 프리미엄 것 옆):

```tsx
  const [companyAnalysisEnabled, setCompanyAnalysisEnabled] = useState<boolean | null>(null);
  const [companySwitchBusy, setCompanySwitchBusy] = useState(false);
  const [companySwitchError, setCompanySwitchError] = useState<string | null>(null);
```

기존 `fetchPremiumSalesSettings().then((result) => setPremiumEnabled(result.premiumEnabled))`를 두 상태 모두 세팅하도록:

```tsx
      .then((result) => {
        setPremiumEnabled(result.premiumEnabled);
        setCompanyAnalysisEnabled(result.companyAnalysisEnabled);
      })
```

핸들러:

```tsx
  const handleCompanyToggle = async (checked: boolean) => {
    setCompanySwitchBusy(true);
    setCompanySwitchError(null);
    try {
      const result = await updateCompanyAnalysisEnabled(checked);
      setCompanyAnalysisEnabled(result.companyAnalysisEnabled);
    } catch (error: unknown) {
      setCompanySwitchError(error instanceof Error ? error.message : "기업 분석 스위치를 변경하지 못했습니다.");
    } finally {
      setCompanySwitchBusy(false);
    }
  };
```

마크업: 프리미엄 `<Card>` **바로 아래, `<fieldset disabled …>` 앞**에 형제 카드:

```tsx
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">기업 분석 리포트</CardTitle>
          <CardDescription className="text-xs">
            켜면 일반 사용자가 기업 분석 리포트를 생성할 수 있습니다. 꺼져 있어도 관리자 계정은 생성할 수 있고,
            이미 지급된 기업 분석 크레딧 잔액은 그대로 보입니다. 토글 즉시 서버에 반영됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3.5 border rounded-lg">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold">
                {companyAnalysisEnabled === null ? "상태 불러오는 중..." : companyAnalysisEnabled ? "열림" : "관리자만"}
              </span>
              {companySwitchError ? <p className="text-xs text-destructive">{companySwitchError}</p> : null}
            </div>
            <Switch
              checked={companyAnalysisEnabled === true}
              disabled={companyAnalysisEnabled === null || companySwitchBusy}
              onCheckedChange={handleCompanyToggle}
            />
          </div>
        </CardContent>
      </Card>
```

- [ ] **Step 6: 구현 — `admin-credits.ts`**

```ts
export type AdminCreditKind = "RESUME" | "COMPANY";

export interface UserCreditSummary {
  premiumEnabled: boolean;
  freeRemaining: number;
  bonusRemaining: number;
  premiumRemaining: number;
  remaining: number;
  /** 기업 분석 크레딧 잔여. 구버전 응답에 없으면 0. */
  companyRemaining: number;
}
```

`parseSummary`: 기존 다섯 필드 검증은 그대로, 반환에 `companyRemaining: typeof value.companyRemaining === "number" && Number.isInteger(value.companyRemaining) && value.companyRemaining >= 0 ? value.companyRemaining : 0,` 추가.

`grantUserCredits`:

```ts
export async function grantUserCredits(input: {
  userId: string;
  credits: number;
  note?: string;
  kind?: AdminCreditKind;
}): Promise<UserCreditSummary> {
  // ...
      body: JSON.stringify({
        userId: input.userId,
        credits: input.credits,
        note: input.note?.trim() ? input.note.trim() : undefined,
        kind: input.kind,
      }),
```

- [ ] **Step 7: 구현 — `UserCreditManagementCard.tsx`**

상태 `const [kind, setKind] = useState<AdminCreditKind>("RESUME");`(import 타입). `handleGrant`의 호출을 `grantUserCredits({ userId, credits: amount, note, kind })`로. 폼 필드 줄의 지급 횟수 옆에:

```tsx
          <div className="w-32">
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="admin-credit-kind">종류</label>
            <select
              id="admin-credit-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as AdminCreditKind)}
              disabled={submitting}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="RESUME">자소서 분석</option>
              <option value="COMPANY">기업 분석</option>
            </select>
          </div>
```

요약 타일 그리드를 `grid-cols-2 sm:grid-cols-4`로 바꾸고 4번째 타일 추가(기존 타일 마크업 복제, 라벨 "기업 분석", 값 `summary.companyRemaining`).

- [ ] **Step 8: 통과 + 타입 체크**

Run: `pnpm exec vitest run client/src/lib/admin-entitlements.test.ts client/src/lib/admin-credits.test.ts client/src/pages/admin/users/UserCredits.ui.test.ts client/src/pages/admin/settings/SettingsPage.test.tsx && pnpm check`
Expected: PASS, tsc 0 오류.

- [ ] **Step 9: 커밋(승인 시)**

```bash
git add client/src/lib/admin-entitlements.ts client/src/lib/admin-entitlements.test.ts client/src/pages/admin/settings/SettingsPage.tsx client/src/lib/admin-credits.ts client/src/lib/admin-credits.test.ts client/src/components/admin/users/UserCreditManagementCard.tsx client/src/pages/admin/users/UserCredits.ui.test.ts
git commit -m "feat(admin): toggle company analysis and grant company credits from the console"
```

---

### Task 9: 전체 검증과 완료 보고

- [ ] **Step 1: 클라이언트 전체 + 서버 대상 테스트**

Run: `GEMINI_API_KEY="" pnpm exec vitest run client/src lib/company-analysis.test.js scripts/vercel-function-limit.test.js`
Expected: PASS(기존에 깨져 있던 `lib/auth.test.js` 4건은 이 명령에 포함되지 않음; 포함된 파일은 전부 PASS).

- [ ] **Step 2: 타입 체크**

Run: `pnpm check`
Expected: 0 오류.

- [ ] **Step 3: 로컬 화면 확인(브라우저 패널, 있으면)**

`pnpm dev`로 `/company-analysis`가 열리고 폼이 그려지는지, `/company-report?analysisId=<실제 기업 분석 id>`가 렌더되는지 확인한다(실제 id는 관리자 지급 크레딧으로 생성한 결과). 못 했으면 못 했다고 보고에 적는다.

- [ ] **Step 4: 완료 보고 형식**

```text
가정: 서버는 1차 플랜 그대로. 샘플·결제·랜딩·업셀 CTA 는 ③④.
변경: 생성 N개 / 수정 N개(목록). 출처는 부록만, 각주 칩 없음. 다운로드·인쇄 없음.
검증: vitest 출력, pnpm check. 브라우저 확인 여부.
남은 위험: BrandName import 경로, 실제 리포트에서 긴 문장의 레이아웃, 모바일 칩 바.
```

---

## Self-Review

- **Spec coverage(§7-2 범위):** `MAX_SOURCES` 20 → Task 1. `/company-analysis` 폼 → Task 4. `/company-report` 8섹션+부록(각주 칩 없음, 검색 제안 칩, 기준일, 고지, 조회 전용) → Task 6. `AnalysisPending` kind 분기 → Task 5. `/my` 배지·목적지 → Task 7. 관리자 토글·kind 지급 → Task 8. `MyEntitlements` 기업 잔여 행 → Task 7. `Analyze` 이전 지원서 필터·프리필 → Task 3. 샘플·결제·랜딩·업셀 CTA는 ③④로 명시 제외(스펙 §7-2와 일치).
- **Placeholder scan:** TBD/TODO 없음. 단 `BrandName` import 경로는 구현 시 `ReportResult.tsx`에서 확인하도록 명시(Task 6 Step 6·8).
- **Type consistency:** `AnalysisKind`는 `analysisRequest.ts` 한 곳에서 export(Task 2) → Task 5 소비. `ProjectSummary.kind?`는 Task 3에서 추가 → Task 4(필터)·Task 7(배지)에서 소비. `CompanyAnalyzeErrorView.trackingType`은 Task 4 정의·소비 일치. `COMPANY_REPORT_NAV_SECTIONS` id 9개(`company-business`…`company-sources`)와 Task 6의 `<section id>` 9개가 일치하고 히어로는 `COMPANY_HERO_ID`. `renderCompanyText(text, emphasize)` 시그니처가 parts 정의와 CompanyReport 사용에서 일치. `UserCreditSummary.companyRemaining`·`AdminCreditKind`는 Task 8 안에서 정의·소비 일치.
