export type SuccessfulCompany = {
  id: string;
  name: string;
  wordmark: string;
};

export type AcceptanceTestimonial = {
  id: string;
  rating: 5;
  quote: string;
  company: string;
  role: string;
  period: string;
};

export const SUCCESSFUL_COMPANY_COUNT = 127;

export const SUCCESSFUL_COMPANIES: readonly SuccessfulCompany[] = [
  { id: "cj", name: "CJ", wordmark: "CJ" },
  { id: "kakao", name: "카카오", wordmark: "kakao" },
  { id: "naver", name: "NAVER", wordmark: "NAVER" },
  { id: "lg", name: "LG", wordmark: "LG" },
  { id: "nexon", name: "넥슨", wordmark: "NEXON" },
  { id: "nc", name: "NC", wordmark: "NC" },
  { id: "netmarble", name: "넷마블", wordmark: "netmarble" },
  {
    id: "posco-international",
    name: "포스코인터내셔널",
    wordmark: "POSCO INTERNATIONAL",
  },
  { id: "hyundai", name: "현대자동차", wordmark: "HYUNDAI" },
  { id: "sk-chemicals", name: "SK 화학", wordmark: "SK chemistry" },
  {
    id: "hyundai-autoever",
    name: "현대오토에버",
    wordmark: "HYUNDAI AUTOEVER",
  },
  { id: "orion", name: "오리온", wordmark: "ORION" },
  { id: "samsung", name: "삼성전자", wordmark: "SAMSUNG" },
];

export const ACCEPTANCE_TESTIMONIALS: readonly AcceptanceTestimonial[] = [
  {
    id: "samsung-pm-2026-h1",
    rating: 5,
    quote:
      "항상 서류에서 떨어졌는데 PreView 피드백을 받고 삼성전자 서류에 합격했습니다.",
    company: "삼성전자",
    role: "Product Manager",
    period: "2026 상반기",
  },
  {
    id: "naver-data-2026-h1",
    rating: 5,
    quote:
      "제 경험의 강점과 부족한 연결 지점을 정확히 짚어줘서 수정 방향이 선명해졌어요.",
    company: "NAVER",
    role: "Data Analyst",
    period: "2026 상반기",
  },
  {
    id: "hyundai-autoever-engineer-2026-h1",
    rating: 5,
    quote:
      "직무 기준으로 경험을 다시 정리하니, 자소서에 꼭 남겨야 할 장면이 보였습니다.",
    company: "현대오토에버",
    role: "Software Engineer",
    period: "2026 상반기",
  },
  {
    id: "kakao-planner-2026-h1",
    rating: 5,
    quote:
      "면접에서 이어질 질문까지 대비한 덕분에 자소서를 훨씬 자신 있게 제출했습니다.",
    company: "카카오",
    role: "Service Planner",
    period: "2026 상반기",
  },
];
