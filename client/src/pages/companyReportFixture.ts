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
