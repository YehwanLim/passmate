// =============================================================================
// 기업 맞춤형 채용 인사이트 리포트 — 타입 정의
// =============================================================================

/** 기업 인사이트 (채용 판단 기준 중심) */
export interface CompanyInsight {
  /** 이 회사가 사람을 뽑는 방식 한줄 정의 */
  summary: string
  /** 인재상 키워드 (3~5개) */
  talentKeywords: string[]
  /** 실제 합격 판단 기준 */
  hiringSignals: string[]
  /** 이 회사에서 떨어지는 전형적인 이유 */
  rejectionTriggers: string[]
  /** 조직 문화 시그널 */
  cultureSignals: string[]
}

/** 전략적 포지셔닝 */
export interface Positioning {
  /** 지금 포지션 (냉정하게) */
  current: string
  /** 합격자 포지션 */
  target: string
  /** 차이 */
  gap: string
  /** 어떻게 올라갈지 */
  strategy: string
}

/** 면접 드릴 (꼬리질문 포함) */
export interface InterviewQA {
  question: string
  /** 꼬리 질문 depth 2 */
  followUps: string[]
  modelAnswer: string
}

/** 액션 플랜 */
export interface ActionItem {
  title: string
  description: string
  /** 이걸 하면 뭐가 달라지는지 */
  expectedImpact: string
}

/** 피드백 카드 (면접 공격 포인트 연결) */
export interface FeedbackCard {
  type: "praise" | "improvement"
  original: string
  praisePoint?: string
  feedback?: string
  /** 다차원 심층 분석 (논리 구조, 면접관 관점, 채용 기준 적합도 등) */
  detailedAnalysis?: string
  suggestion?: string
  /** 면접에서 이 문장 때문에 어떻게 공격당하는지 */
  interviewLink?: {
    question: string
    /** 왜 이걸 묻는지 */
    intent: string
  }
}

/** 문항 탭 */
export interface QuestionTab {
  id: number
  title: string
  prompt: string
  subtitleDiagnosis: {
    exists: boolean
    original: string
    feedback: string
    suggestion: string
  }
  fullAnswer: string
  overview: string
  feedbackCards: FeedbackCard[]
}

/** 채용담당자가 기억할 모습 항목 */
export interface HiringMemoryEntry {
  mark: "✓" | "△"
  text: string
}

/** 첫인상 */
export interface FirstImpression {
  /** persona 인상의 근거가 되는 실제 경험 한 문장 */
  summaryOneLiner: string
  persona: string
  hashtags: string[]
  /** ✓ 3개 + △ 1개. 구버전 리포트에는 없음 */
  hiringMemory?: HiringMemoryEntry[]
  /** 경험 흐름 서술 1~2문장. 구버전 리포트에는 없음 */
  profileNote?: string
}

/** 강점/보완점 항목. 구버전 리포트는 문자열, 신버전은 headline+text 객체 */
export interface DiagnosisEntry {
  headline: string
  text: string
}

/** 공고 요구사항 하나가 자소서에 드러나는 정도 */
export type RequirementMatchStatus = "드러남" | "약함" | "언급 없음";

export interface RequirementMatch {
  requirement: string
  /** 모델이 세 값 밖의 문자열을 내면 화면은 중립 톤으로 그린다 */
  status: RequirementMatchStatus | string
  evidence?: string
  advice?: string
}

/** 공고 적합도 — 채용공고를 붙여 분석했을 때만 생성된다 */
export interface PostingFit {
  headline: string
  verdict: string
  requirementMatches: RequirementMatch[]
  missingKeywords?: string[]
  questionAdvice?: Array<{ questionIndex: number; advice: string }>
}

/** 최종 리포트 데이터 */
export interface ReportData {
  companyInsight: CompanyInsight
  firstImpression: FirstImpression
  /** 회사 기준 강점 */
  strengths: Array<string | DiagnosisEntry>
  /** 회사 기준 부족한 부분 */
  gaps: Array<string | DiagnosisEntry>
  /** 전략적 포지셔닝 */
  positioning: Positioning
  questionTabs: QuestionTab[]
  interviewQA: InterviewQA[]
  /** 유동적 개수 */
  actionPlan: ActionItem[]
  /** 실무 PM의 냉정한 한줄 */
  pmComment: string
  /** 공고 적합도. 구버전 리포트·공고 없는 리포트에는 없음 */
  postingFit?: PostingFit | null
}
