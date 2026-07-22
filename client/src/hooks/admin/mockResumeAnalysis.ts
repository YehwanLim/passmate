import type { AnalysisDetail } from "./useAnalysisDetail";
import type { AnalysisRow } from "./useAnalysesData";

const MOCK_REPORT = {
  companyInsight: {
    summary: "현대자동차는 모빌리티 서비스 관점에서 데이터 기반 실행력과 도메인 이해를 함께 봅니다.",
    talentKeywords: ["데이터 기반 문제 해결", "서비스 기획", "모빌리티 이해"],
    hiringSignals: ["정량 지표 개선 경험", "사용자 문제 정의", "비즈니스 맥락 연결"],
    rejectionTriggers: ["범용적인 지원 동기", "성과와 회사 사업의 연결 부족"],
    cultureSignals: ["빠른 실험", "글로벌 고객 이해", "실행 중심 협업"],
  },
  firstImpression: {
    summaryOneLiner: "데이터 기반 실행력은 좋지만 현대자동차의 모빌리티 맥락 연결은 더 선명해야 합니다.",
    persona: "문제를 수치로 정의하고 실험으로 개선하는 서비스 기획자",
    hashtags: ["#데이터기반", "#서비스기획", "#모빌리티보완"],
  },
  strengths: [
    "3,000건의 행동 데이터를 직접 수집하고 분석한 경험은 실행력을 보여줍니다.",
    "이탈률을 낮춘 결과가 구체적이어서 문제 해결 과정이 설득력 있게 읽힙니다.",
    "추천 로직 개선과 실험 경험은 서비스 PM 직무와 연결됩니다.",
  ],
  gaps: [
    "현대자동차의 커넥티드 서비스나 차량 데이터 맥락과의 연결이 부족합니다.",
    "성과 지표가 좋아도 회사 사업에 어떤 방식으로 기여할지 아직 추상적입니다.",
  ],
  pmComment:
    "경험 자체는 좋습니다. 다만 이 경험이 왜 현대자동차에서 더 큰 가치가 되는지 한 번 더 밀어붙여야 합니다. 차량 데이터, 글로벌 모빌리티 서비스, 커넥티드 카 같은 맥락을 문장 안에 직접 넣으면 훨씬 강해집니다.",
};

export const MOCK_ADMIN_ANALYSIS_ROWS: AnalysisRow[] = [
  {
    id: "mock-analysis-1",
    status: "SUCCESS",
    error_code: null,
    model_name: "gemini-2.5-flash-lite",
    model_provider: "gemini",
    response_time_ms: 1840,
    total_chars: 1058,
    created_at: "2026-05-05T14:32:00Z",
    total_tokens: 4820,
    total_cost: 0.0031,
    user_email: "mock.user@example.com",
    user_name: "목업 사용자",
    project_title: "현대자동차 서비스 PM 지원",
    project_company: "현대자동차",
    project_job_keyword: "서비스 PM",
  },
  {
    id: "mock-analysis-2",
    status: "SUCCESS",
    error_code: null,
    model_name: "gemini-2.5-flash-lite",
    model_provider: "gemini",
    response_time_ms: 2130,
    total_chars: 294,
    created_at: "2026-05-05T14:35:00Z",
    total_tokens: 3910,
    total_cost: 0.0024,
    user_email: "mock.user@example.com",
    user_name: "목업 사용자",
    project_title: "현대자동차 서비스 PM 지원",
    project_company: "현대자동차",
    project_job_keyword: "서비스 PM",
  },
];

export const MOCK_ADMIN_ANALYSIS_DETAIL: AnalysisDetail = {
  id: "mock-analysis-1",
  project_id: "mock-proj-1",
  status: "SUCCESS",
  error_code: null,
  error_message: null,
  question_text: "직무 경험을 중심으로 본인을 어필해주세요.",
  input_text:
    "3,000건의 데이터로 사용자 맞춤 추천을 개선하다\n\n교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영한 경험이 있습니다. 런칭 초기, 유저들이 메인 화면에서 탐색하다가 이탈하는 비율이 매우 높다는 문제를 발견했습니다. 이를 해결하기 위해 직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다. 유저의 클릭 패턴과 체류 시간을 분석한 결과, 개인화가 부족하다는 점을 파악했습니다.\n\n이를 해결하기 위해 로직을 개선하고 A/B 테스트를 진행했습니다. 결과적으로 메인 화면 이탈률을 35%에서 18%로 낮출 수 있었으며, 일간 활성 사용자 수(DAU)도 20% 증가했습니다. 이러한 데이터 기반의 문제 해결 경험을 살려 현대자동차에서도 글로벌 고객들에게 최적화된 모빌리티 경험을 제공하는 데 기여하고 싶습니다.",
  total_chars: 1058,
  ai_response_json: MOCK_REPORT,
  ai_score: null,
  model_name: "gemini-2.5-flash-lite",
  model_provider: "gemini",
  prompt_version: "mock",
  response_time_ms: 1840,
  created_at: "2026-05-05T14:32:00Z",
  user: {
    id: "mock-user-1",
    email: "mock.user@example.com",
    name: "목업 사용자",
  },
  project: {
    id: "mock-proj-1",
    title: "현대자동차 서비스 PM 지원",
    company: "현대자동차",
    job_keyword: "서비스 PM",
  },
  project_analyses: [
    {
      id: "mock-analysis-2",
      status: "SUCCESS",
      question_text: "팀 프로젝트나 협업 과정에서 발생한 갈등을 극복하고 성과를 이끌어낸 경험을 설명해 주세요.",
      input_text:
        "학교 프로젝트에서 서비스 기획을 맡아 개발팀, 디자인팀과 협업했습니다. 당시 저희 팀은 일정 지연과 소통 부족이라는 문제를 겪고 있었습니다. 저는 기획자로서 이 문제를 해결하기 위해 적극적으로 나섰습니다. 프로젝트를 진행하며 많은 것을 배웠고 좋은 결과를 얻었습니다. 다양한 팀원들과 협업하며 서로의 입장을 이해하는 법을 배웠습니다. 결국 지속적인 회의와 일정 관리를 통해 프로젝트를 기한 내에 마칠 수 있었습니다.",
      total_chars: 294,
      ai_response_json: {
        overview: "협업 경험은 있으나 갈등의 원인과 본인의 구체적 조율 방식이 더 선명해야 합니다.",
        feedback: "문제 해결 과정이 다소 일반적으로 표현되어 면접에서 추가 질문을 받을 수 있습니다.",
      },
      ai_score: null,
      created_at: "2026-05-05T14:35:00Z",
    },
    {
      id: "mock-analysis-1",
      status: "SUCCESS",
      question_text: "직무 경험을 중심으로 본인을 어필해주세요.",
      input_text:
        "3,000건의 데이터로 사용자 맞춤 추천을 개선하다\n\n교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영한 경험이 있습니다. 런칭 초기, 유저들이 메인 화면에서 탐색하다가 이탈하는 비율이 매우 높다는 문제를 발견했습니다. 이를 해결하기 위해 직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다. 유저의 클릭 패턴과 체류 시간을 분석한 결과, 개인화가 부족하다는 점을 파악했습니다.\n\n이를 해결하기 위해 로직을 개선하고 A/B 테스트를 진행했습니다. 결과적으로 메인 화면 이탈률을 35%에서 18%로 낮출 수 있었으며, 일간 활성 사용자 수(DAU)도 20% 증가했습니다. 이러한 데이터 기반의 문제 해결 경험을 살려 현대자동차에서도 글로벌 고객들에게 최적화된 모빌리티 경험을 제공하는 데 기여하고 싶습니다.",
      total_chars: 1058,
      ai_response_json: MOCK_REPORT,
      ai_score: null,
      created_at: "2026-05-05T14:32:00Z",
    },
  ],
  prompt_template: null,
  token_usages: [
    {
      id: "mock-token-1",
      call_type: "resume-analysis",
      prompt_tokens: 3020,
      completion_tokens: 1800,
      total_tokens: 4820,
      cost: 0.0031,
      latency_ms: 1840,
      is_success: true,
    },
  ],
};
