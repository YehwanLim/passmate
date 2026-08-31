// 받침 유무에 따라 은/는을 고른다. 한글이 아닌 글자로 끝나면(영문 사명 등) '는'으로 둔다.
function topicParticle(word: string): "은" | "는" {
  const lastChar = word.trim().charAt(word.trim().length - 1)
  const code = lastChar.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return "는"
  return (code - 0xac00) % 28 === 0 ? "는" : "은"
}

export const UI_LABELS = {
  // Navigation & Actions
  BACK: "뒤로 가기",
  API_TEST: "API 테스트",

  // Act 1: First Impression
  FIRST_IMPRESSION_TITLE: (userName: string) => `현직자 시선에서 본 ${userName}님의 첫인상입니다.`,
  APPLICANT_PROFILE: "지원자 프로필",

  // Act 1.5: Company Insight
  HIRING_CRITERIA: (company: string) => `${company}${topicParticle(company)} 이런 지원자를 찾고 있어요`,
  TALENT_PROFILE: "인재상",
  ACCEPTANCE_CRITERIA: "합격 기준",
  REJECTION_TRIGGERS: "탈락 요인",
  CULTURE_SIGNALS: "조직 문화 특징",

  // Act 2: Core Diagnosis
  STRENGTHS_AND_GAPS: (company: string) => `이 자소서는 이렇게 읽히고 있어요`,
  STRENGTHS: "강점",
  GAPS: "보완점",
  STRATEGIC_POSITIONING: "합격까지의 거리",
  POSITION_CURRENT: "지금 읽히는 모습",
  POSITION_TARGET: "면접관이 기대하는 방향",
  POSITION_GAP: "지금 가장 아쉬운 부분",
  POSITION_STRATEGY: "이렇게 좁히세요",

  // Act 3: Line-by-line Analysis
  LINE_BY_LINE_ANALYSIS: "문장별로 더 다듬어볼 수 있어요",
  AI_COMMENTARY: "문장별 코멘트",
  OVERVIEW: "총평",
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
  INTERVIEWER_PERSPECTIVE: "면접관 관점",
  QUESTION_INTENT: "출제 의도",
  SENTENCE_DIAGNOSIS: "문장 진단",
  FEEDBACK_TYPE_PRAISE: "좋은 문장",
  FEEDBACK_TYPE_IMPROVEMENT: "보완 제안",

  // Act 4: Interview Drill
  INTERVIEW_DRILL_TITLE: "면접에서는 이런 질문이 나올 수 있어요",
  INTERVIEW_DRILL_DESC: "제출 전, 아래 질문들에 대해 방어할 수 있는지 스스로 점검해보세요.",
  FOLLOW_UP_QUESTIONS: "꼬리 질문",
  MODEL_ANSWER: "모범 답변",

  // Act 5: Action Plan
  ACTION_PLAN_TITLE: "이 부분부터 보완해보면 좋아요",
  EXPECTED_IMPACT: "기대 효과",

  // Act 6: PM Comment
  PM_VERDICT_TITLE: "실무자 입장에서는 이런 부분이 보였어요",
  JUST_NOW: "방금 전",

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

  // Feedback (리포트 만족도 설문)
  // 문항 키·점수 범위·주관식 최소 길이의 정본은 서버(lib/feedback-survey.js)다.
  // 여기 값은 화면 문구를 맞추기 위한 사본이며, 두 쪽이 어긋나면
  // feedbackSurvey.singleSource.test.ts 가 실패한다.
  FEEDBACK_TITLE: "이 리포트, 얼마나 도움이 됐나요?",
  FEEDBACK_SUBTITLE:
    "3개 문항과 짧은 의견을 남겨주시면 분석 1회를 더 드려요. 계정당 한 번입니다.",
  FEEDBACK_SCORE_MIN: 1,
  FEEDBACK_SCORE_MAX: 10,
  FEEDBACK_SCORE_LOW_HINT: "전혀 아니다",
  FEEDBACK_SCORE_HIGH_HINT: "매우 그렇다",
  FEEDBACK_SURVEY_QUESTIONS: [
    { key: "reflection", question: "리포트에 나의 자소서 내용이 잘 반영되었나요?" },
    { key: "improvement", question: "실제로 자소서를 고치는 데 도움이 되었나요?" },
    { key: "recommend", question: "취업 준비 중인 친구에게 추천하시겠나요?" },
  ] as ReadonlyArray<{ key: string; question: string }>,
  FEEDBACK_MIN_COMMENT_LENGTH: 50,
  FEEDBACK_COMMENT_TITLE: "가장 아쉬웠던 점을 알려주세요",
  FEEDBACK_COMMENT_PLACEHOLDER:
    "어떤 부분이 기대와 달랐는지, 무엇이 더 있었으면 했는지 적어주세요. 구체적일수록 다음 리포트가 좋아집니다.",
  FEEDBACK_SUBMIT: "설문 마치고 1회 받기",
  FEEDBACK_SUBMITTING: "보내는 중...",
  FEEDBACK_PROGRESS_HINT: "3문항 중 {answered}문항 응답",
  FEEDBACK_THANKS_TITLE: "소중한 의견 감사합니다",
  FEEDBACK_THANKS_DESC: "더 나은 리포트를 위해 활용하겠습니다.",
  FEEDBACK_REWARD_GRANTED_TITLE: "분석 1회를 넣어드렸어요",
  FEEDBACK_REWARD_GRANTED_DESC: "남겨주신 의견은 다음 리포트 개선에 그대로 씁니다.",
  FEEDBACK_ALREADY_REWARDED:
    "의견 잘 받았습니다. 추가 분석 1회는 계정당 한 번이라 이번에는 지급되지 않았어요.",
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
  MODEL_OVERLOADED_ERROR: "AI 모델 사용량이 잠시 몰렸어요. 작성하신 내용은 안전하게 보관 중이니 잠시 후 다시 시도해 주세요.",
  RATE_LIMIT_ERROR: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  CONTEXT_IRRELEVANT: "자기소개서와 무관한 내용이 감지되었어요. 자소서 내용을 입력해 주세요.",
  DRAFT_RESTORED: "이전에 작성 중이던 내용을 복원했어요.",
  ANALYSIS_FAILED: "분석에 실패했습니다. 다시 시도해주세요.",

  // Loading Status Steps
  LOADING_STEP_1: "자소서 내용을 꼼꼼하게 읽어보는 중이에요...",
  LOADING_STEP_2: "합격 포인트와 아쉬운 점을 분석하고 있어요...",
  LOADING_STEP_3: "거의 다 왔어요! 리포트를 정리하고 있어요...",
};
