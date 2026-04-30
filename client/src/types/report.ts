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

/** 첫인상 */
export interface FirstImpression {
  /** 이 회사 기준 한줄 평가 */
  summaryOneLiner: string
  persona: string
  hashtags: string[]
}

/** 최종 리포트 데이터 */
export interface ReportData {
  companyInsight: CompanyInsight
  firstImpression: FirstImpression
  /** 회사 기준 강점 */
  strengths: string[]
  /** 회사 기준 부족한 부분 */
  gaps: string[]
  /** 전략적 포지셔닝 */
  positioning: Positioning
  questionTabs: QuestionTab[]
  interviewQA: InterviewQA[]
  /** 유동적 개수 */
  actionPlan: ActionItem[]
  /** 실무 PM의 냉정한 한줄 */
  pmComment: string
}
