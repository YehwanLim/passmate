export const UI_LABELS = {
  // Navigation & Actions
  BACK: "뒤로 가기",
  API_TEST: "API 테스트",

  // Act 1: First Impression
  FIRST_IMPRESSION_TITLE: (userName: string) => `현직자 시선에서 본 ${userName}님의 첫인상입니다.`,
  APPLICANT_PROFILE: "지원자 프로필",

  // Act 1.5: Company Insight
  COMPANY_ANALYSIS: "기업 분석",
  HIRING_CRITERIA: (company: string) => `${company} 합격 기준`,
  TALENT_PROFILE: "인재상",
  ACCEPTANCE_CRITERIA: "합격 기준",
  REJECTION_TRIGGERS: "탈락 요인",
  CULTURE_SIGNALS: "조직 문화 특징",

  // Act 2: Core Diagnosis
  CORE_DIAGNOSIS: "핵심 진단",
  STRENGTHS_AND_GAPS: (company: string) => `${company} 기준 핵심 강점 및 보완점`,
  STRENGTHS: "강점",
  GAPS: "보완점",
  STRATEGIC_POSITIONING: "전략적 포지셔닝",
  POSITION_CURRENT: "현재 위치",
  POSITION_TARGET: "목표 위치",
  POSITION_GAP: "차이점",
  POSITION_STRATEGY: "극복 전략",

  // Act 3: Line-by-line Analysis
  DETAILED_DIAGNOSIS: "상세 진단",
  LINE_BY_LINE_ANALYSIS: "문장별 심층 분석",
  FEEDBACK: "피드백",
  VIEW_MODE_FOCUS: "집중 모드",
  VIEW_MODE_LIST: "목록 모드",
  SUBTITLE_DIAGNOSIS: "소제목 진단",
  CLICK_HIGHLIGHT_GUIDE: "우측에서 하이라이트된 문장을 클릭하여 피드백을 확인하세요.",
  ORIGINAL_SENTENCE: "원본 문장",
  AI_DIAGNOSIS: "AI 진단",
  INTERVIEW_ATTACK_POINT: "면접 예상 질문",
  IMPROVED_SENTENCE: "개선안",
  VERDICT: "개선된 문장",
  DETAIL_VIEW: "상세 보기",
  ORIGINAL_TEXT_PANEL: "지원서 원문",
  QUESTION: "문항",

  // Act 4: Interview Drill
  INTERVIEW_DRILL: "면접 대비 훈련",
  INTERVIEW_DRILL_TITLE: "면접관은 반드시 이 부분을 파고듭니다.",
  INTERVIEW_DRILL_DESC: "제출 전, 아래 질문들에 대해 방어할 수 있는지 스스로 점검해보세요.",
  FOLLOW_UP_QUESTIONS: "꼬리 질문",
  MODEL_ANSWER: "모범 답변",

  // Act 5: Action Plan
  ACTION_PLAN: "실행 계획",
  ACTION_PLAN_TITLE: "합격률을 높이기 위한 즉각적 액션",
  EXPECTED_IMPACT: "기대 효과",

  // Act 6: PM Comment
  PM_VERDICT: "실무자의 시선",
  PM_VERDICT_TITLE: "실무 PM의 냉정한 한마디.",
  JUST_NOW: "방금 전",

  // Premium Upsell
  PREMIUM: "프리미엄",
  PREMIUM_NEXT_STEPS: "프리미엄 넥스트 스텝",
  PREMIUM_DESC: "AI 분석을 넘어, 실제 합격자 데이터와 전문가의 코칭으로 완성도를 높이세요.",
  PAST_QUESTIONS: "기출 면접 질문",
  PAST_QUESTIONS_DESC: "수만 건의 데이터를 기반으로 실제 합격자들이 받았던 기출 면접 질문을 확인하세요.",
  GO_TO: "바로가기",
  EXPERT_REVIEW: "1:1 전문가 리뷰",
  EXPERT_REVIEW_DESC: "10년 차 현업 멘토의 밀착 피드백으로 자소서의 완성도를 극대화하세요.",
  APPLY_PREMIUM: "프리미엄 신청",

  // Next Steps
  WHATS_NEXT: "다음 단계",
  EDIT_RESUME: "이 자소서 수정하기",
  ANALYZE_NEW: "새로운 자소서 분석하기",
  SAVE_REPORT: "리포트 저장하기",

  // Footer
  FOOTER_DISCLAIMER: "본 리포트는 AI 모델에 의해 생성되었으며 참고용으로만 활용하시기 바랍니다.",

  // Modal
  ANALYSIS_LOGIC: "분석 로직",
  DIAGNOSIS_DETAIL: "진단 상세",
  ORIGINAL_ANALYSIS: "원본 분석",

  // Feedback (만족도)
  FEEDBACK_TITLE: "이 리포트, 실제로 도움이 됐나요?",
  FEEDBACK_SUBTITLE: "더 나은 분석을 위해 의견을 남겨주세요.",
  FEEDBACK_THUMBS_UP: "도움됐어요",
  FEEDBACK_THUMBS_DOWN: "아쉬워요",
  FEEDBACK_REASON_TITLE: "어떤 부분이 아쉬웠나요?",
  FEEDBACK_REASONS: [
    "피드백이 너무 일반적이에요",
    "내 자소서와 맞지 않는 분석이에요",
    "개선안이 도움이 안 돼요",
    "기업 분석이 부정확해요",
    "기타",
  ] as string[],
  FEEDBACK_SUBMIT: "의견 보내기",
  FEEDBACK_THANKS_TITLE: "소중한 의견 감사합니다",
  FEEDBACK_THANKS_DESC: "더 나은 리포트를 위해 활용하겠습니다.",
  FEEDBACK_ALREADY_VOTED: "이미 의견을 보내주셨어요",
  FEEDBACK_ERROR: "의견 전송에 실패했어요. 잠시 후 다시 시도해주세요.",

  // API Test Messages
  API_TEST_SENDING: "API 테스트 요청 중...",
  API_TEST_SUCCESS: "API 연결 성공",
  API_TEST_FAILED: "API 연결 실패: ",
  API_TEST_NETWORK_ERROR: "네트워크 오류가 발생했습니다.",

  // Error & Edge Case Messages
  CHAR_MINIMUM_WARNING: "입력된 내용이 적어 피드백이 뻔할 수 있어요. 그래도 진행할까요?",
  CHAR_OVER_LIMIT: "글자 수 제한(6,000자)을 초과했어요. 내용을 줄여야 다음 단계로 넘어갈 수 있어요.",
  DUPLICATE_DETECTED: "중복된 문장이 여러번 감지되었어요. 문항별로 다른 내용이 입력되었는지 한 번 더 확인해주세요.",
  NETWORK_ERROR: "앗, 서버와 연결이 불안정해요. 작성하신 내용은 안전하게 보관 중이니 잠시 후 다시 시도해 주세요.",
  JSON_PARSE_ERROR: "AI가 결과를 정리하다 실수했어요. 다시 시도해주세요.",
  RATE_LIMIT_ERROR: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  CONTEXT_IRRELEVANT: "자기소개서와 무관한 내용이 감지되었어요. 자소서 내용을 입력해 주세요.",
  DRAFT_RESTORED: "이전에 작성 중이던 내용을 복원했어요.",
  ANALYSIS_FAILED: "분석에 실패했습니다. 다시 시도해주세요.",

  // Loading Status Steps
  LOADING_STEP_1: "자소서 내용을 꼼꼼하게 읽어보는 중이에요...",
  LOADING_STEP_2: "합격 포인트와 아쉬운 점을 분석하고 있어요...",
  LOADING_STEP_3: "거의 다 왔어요! 리포트를 정리하고 있어요...",
};
