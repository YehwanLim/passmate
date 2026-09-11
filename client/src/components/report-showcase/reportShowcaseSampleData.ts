// 랜딩 리포트 미리보기용 샘플 카피. 실제 리포트 구조(첫인상 → 진단 → 문장 → 예상 질문)를 그대로 따른다.
// 히어로 카드(HeroReportCard)도 같은 데이터를 재사용한다.

export type PreviewScene = {
  id: string;
  indexLabel: string;
  tab: string;
  eyebrow: string;
  title: string;
  // 구 "이렇게 읽습니다" 섹션의 단계별 읽기 기준을 장면 위에 얹는다.
  lens: string;
};

export const REPORT_PREVIEW_SCENES: PreviewScene[] = [
  {
    id: "impression",
    indexLabel: "01",
    tab: "첫인상",
    eyebrow: "First Read",
    title: "데이터 기반 실행형 PM",
    lens: "먼저, 어떤 사람으로 기억되는지 봅니다",
  },
  {
    id: "diagnosis",
    indexLabel: "02",
    tab: "핵심 진단",
    eyebrow: "Core Diagnosis",
    title: "강점은 뚜렷하지만 회사 맥락이 약합니다",
    lens: "경험이 회사 기준과 만나는지 봅니다",
  },
  {
    id: "line",
    indexLabel: "03",
    tab: "문장 피드백",
    eyebrow: "Line-by-line",
    title: "원문 옆에서 문장별 피드백을 바로 확인합니다",
    lens: "문장마다 근거가 충분한지 봅니다",
  },
  {
    id: "interview",
    indexLabel: "04",
    tab: "예상 질문",
    eyebrow: "Interview Drill",
    title: "면접에서 이어질 질문까지 미리 점검합니다",
    lens: "면접에서 방어 가능한지 봅니다",
  },
];

export const reportKeywords = [
  "데이터분석",
  "가설검증",
  "고객 중심",
  "빠른 실행력",
  "협업",
];

export const hiringMemoryItems = [
  { mark: "✓", text: "논리적으로 일할 것 같다" },
  { mark: "✓", text: "실행력이 좋아 보인다" },
  { mark: "✓", text: "숫자로 결과를 설명할 수 있다" },
  { mark: "△", text: "모빌리티 맥락은 더 필요하다" },
];

export const mentorCommentPreviews = [
  {
    title: "첫인상",
    numberClassName: "text-[#A7A8FF]",
    text: "데이터를 근거로 문제를 찾고 실행까지 옮기는 사람으로 읽힙니다.",
  },
  {
    title: "보완하면 좋을 점",
    numberClassName: "text-[#D9B94B]",
    text: "성과를 모빌리티 고객 여정과 연결하는 한 문장이 더 필요합니다.",
  },
  {
    title: "면접 체크포인트",
    numberClassName: "text-[#69D5B1]",
    text: "고객군 정의와 판단 기준을 꼬리 질문에도 설명할 수 있어야 합니다.",
  },
];

export const strengths = [
  "3,000건 이상의 행동 데이터를 직접 수집하고 분석한 점이 실행력을 보여줍니다.",
  "A/B 테스트와 이탈률 개선 수치가 함께 제시되어 성과가 선명합니다.",
  "문제를 발견한 뒤 기획과 운영까지 연결한 경험이 서비스 기획 직무와 잘 맞습니다.",
];

export const gaps = [
  "개선한 지표가 현대자동차의 커넥티드 서비스와 어떻게 연결되는지 더 보여줘야 합니다.",
  "분석 기준과 세그먼트 정의가 빠져 있어 면접에서 추가 질문을 받을 수 있습니다.",
  "협업 과정에서 본인이 어떤 기준으로 의사결정을 이끌었는지 한 장면이 더 필요합니다.",
];

export const diagnosisPriorities = [
  "커넥티드 서비스의 고객 여정과 개선 경험을 한 문장으로 연결합니다.",
  "핵심 고객군의 정의와 이탈 신호를 구체적으로 적어 분석의 신뢰를 높입니다.",
  "개발·디자인과의 의견 차이를 조정한 본인만의 판단 과정을 보강합니다.",
];

// 실제 리포트처럼 원문은 이어지는 글로 보여주고,
// 피드백이 달린 문장에만 하이라이트를 얹는다.
export const previewAnswer = [
  {
    text: "교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영했습니다.",
    type: "neutral",
  },
  {
    text: "서비스 오픈 후 두 달이 지나도 재방문율이 기대에 미치지 못했고, 감이 아니라 데이터로 원인을 찾아야 한다고 판단했습니다.",
    type: "neutral",
  },
  {
    text: "직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다.",
    type: "praise",
    mark: "03",
  },
  {
    text: "화면별 로그를 정리해 사용자가 어느 단계에서 오래 머무르고 어디에서 떠나는지 흐름으로 기록했습니다.",
    type: "neutral",
  },
  {
    text: "유저의 클릭 패턴과 체류 시간을 분석한 결과, 개인화가 부족하다는 점을 파악했습니다.",
    type: "improvement",
    mark: "05",
  },
  {
    text: "가설을 세운 뒤에는 팀원들과 우선순위를 정해 개선 항목을 두 가지로 좁혔습니다.",
    type: "neutral",
  },
  {
    text: "분석 결과를 바탕으로 추천 콘텐츠의 노출 순서를 바꾸고, 개발자와 실험 기간 및 성공 기준을 합의했습니다.",
    type: "praise",
    mark: "07",
  },
  {
    text: "2주 단위로 실험을 반복했고, 가설이 틀렸을 때도 원인을 기록해 다음 실험의 기준으로 삼았습니다.",
    type: "neutral",
  },
  {
    text: "메인 화면 이탈률을 35%에서 18%로 낮췄고, 일간 활성 사용자 수를 20% 늘렸습니다.",
    type: "improvement",
    mark: "09",
  },
  {
    text: "이 경험을 통해 문제를 정의하는 기준이 명확해야 팀 전체가 같은 방향으로 움직인다는 것을 배웠습니다.",
    type: "neutral",
  },
] as const;

export const interviewQuestions = [
  {
    question:
      "현대자동차의 모빌리티 서비스를 개선한다면 어떤 데이터를 가장 먼저 볼 것 같나요?",
    followUps: [
      "왜 그 데이터가 가장 중요하다고 생각하나요?",
      "해당 데이터를 수집하려면 어떤 기획이 필요할까요?",
    ],
    answerFocus:
      "차량 연동 기능의 진입률, 기능별 이탈 구간, 재사용 빈도를 고객 여정 순서대로 설명해 보세요.",
  },
  {
    question: "글로벌 고객 타겟팅 시 지역별 특성은 어떻게 파악할 계획인가요?",
    followUps: ["현지 조사가 어렵다면 어떤 데이터를 활용할 수 있을까요?"],
    answerFocus:
      "국가별 이용 시간대, 차량 등급, 기능 사용 빈도를 비교해 가설을 세우는 순서를 설명해 보세요.",
  },
  {
    question:
      "추천 노출 순서를 바꿀 때 어떤 지표가 좋아져야 성공이라고 판단했나요?",
    followUps: ["단기 클릭률이 올라도 장기 만족도를 어떻게 확인할 건가요?"],
    answerFocus:
      "첫 화면 이탈률과 7일 재방문율을 함께 보고, 실험군·대조군의 차이를 판단 근거로 제시하세요.",
  },
];

export const actionItems = [
  "마무리 문장에 커넥티드 서비스 맥락 추가",
  "데이터 분석 기준과 세그먼트 정의 보강",
  "협업 문항에서 본인 의사결정 과정 구체화",
  "예상 질문별로 판단 근거와 대안까지 한 문장씩 준비",
];
