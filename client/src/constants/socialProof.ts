export type SuccessfulCompany = {
  id: string;
  name: string;
  wordmark: string;
  logoSrc: `/company-logos/${string}.svg`;
  logoAlt: `${string} 로고`;
};

export type SocialProofMetric = {
  id: "accepted-companies" | "analyzed-cover-letters";
  value: number;
  suffix: "+";
  label: "합격 기업" | "분석 완료 자소서";
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

export const SOCIAL_PROOF_METRICS: readonly SocialProofMetric[] = [
  {
    id: "accepted-companies",
    value: SUCCESSFUL_COMPANY_COUNT,
    suffix: "+",
    label: "합격 기업",
  },
  {
    id: "analyzed-cover-letters",
    value: 2000,
    suffix: "+",
    label: "분석 완료 자소서",
  },
];

export const SUCCESSFUL_COMPANIES: readonly SuccessfulCompany[] = [
  {
    id: "cj",
    name: "CJ",
    wordmark: "CJ",
    logoSrc: "/company-logos/cj.svg",
    logoAlt: "CJ 로고",
  },
  {
    id: "kakao",
    name: "카카오",
    wordmark: "kakao",
    logoSrc: "/company-logos/kakao.svg",
    logoAlt: "카카오 로고",
  },
  {
    id: "naver",
    name: "NAVER",
    wordmark: "NAVER",
    logoSrc: "/company-logos/naver.svg",
    logoAlt: "NAVER 로고",
  },
  {
    id: "lg",
    name: "LG",
    wordmark: "LG",
    logoSrc: "/company-logos/lg.svg",
    logoAlt: "LG 로고",
  },
  {
    id: "nexon",
    name: "넥슨",
    wordmark: "NEXON",
    logoSrc: "/company-logos/nexon.svg",
    logoAlt: "넥슨 로고",
  },
  {
    id: "ncsoft",
    name: "NC",
    wordmark: "NCSOFT",
    logoSrc: "/company-logos/ncsoft.svg",
    logoAlt: "NCSOFT 로고",
  },
  {
    id: "netmarble",
    name: "넷마블",
    wordmark: "netmarble",
    logoSrc: "/company-logos/netmarble.svg",
    logoAlt: "넷마블 로고",
  },
  {
    id: "posco-international",
    name: "포스코인터내셔널",
    wordmark: "POSCO INTERNATIONAL",
    logoSrc: "/company-logos/posco-international.svg",
    logoAlt: "포스코인터내셔널 로고",
  },
  {
    id: "hyundai-motor",
    name: "현대자동차",
    wordmark: "HYUNDAI",
    logoSrc: "/company-logos/hyundai-motor.svg",
    logoAlt: "현대자동차 로고",
  },
  {
    id: "sk-chemicals",
    name: "SK케미칼",
    wordmark: "SK chemicals",
    logoSrc: "/company-logos/sk-chemicals.svg",
    logoAlt: "SK케미칼 로고",
  },
  {
    id: "hyundai-autoever",
    name: "현대오토에버",
    wordmark: "HYUNDAI AUTOEVER",
    logoSrc: "/company-logos/hyundai-autoever.svg",
    logoAlt: "현대오토에버 로고",
  },
  {
    id: "orion",
    name: "오리온",
    wordmark: "ORION",
    logoSrc: "/company-logos/orion.svg",
    logoAlt: "오리온 로고",
  },
  {
    id: "samsung-electronics",
    name: "삼성전자",
    wordmark: "SAMSUNG",
    logoSrc: "/company-logos/samsung-electronics.svg",
    logoAlt: "삼성전자 로고",
  },
  {
    id: "lg-display",
    name: "LG디스플레이",
    wordmark: "LG Display",
    logoSrc: "/company-logos/lg-display.svg",
    logoAlt: "LG디스플레이 로고",
  },
  {
    id: "sk-telecom",
    name: "SK텔레콤",
    wordmark: "SK telecom",
    logoSrc: "/company-logos/sk-telecom.svg",
    logoAlt: "SK텔레콤 로고",
  },
  {
    id: "nhn-commerce",
    name: "NHN커머스",
    wordmark: "NHN COMMERCE",
    logoSrc: "/company-logos/nhn-commerce.svg",
    logoAlt: "NHN커머스 로고",
  },
  {
    id: "samyang-group",
    name: "삼양그룹",
    wordmark: "SAMYANG",
    logoSrc: "/company-logos/samyang-group.svg",
    logoAlt: "삼양그룹 로고",
  },
  {
    id: "cj-olive-networks",
    name: "CJ올리브네트웍스",
    wordmark: "CJ OliveNetworks",
    logoSrc: "/company-logos/cj-olive-networks.svg",
    logoAlt: "CJ올리브네트웍스 로고",
  },
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
