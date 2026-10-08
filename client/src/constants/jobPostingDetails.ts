import type { JobPostingListing } from "./jobPostings";

/**
 * 공고 한 장(/jobs/:slug) 본문과 분석 폼 채우기에 쓰는 내용. 공고 페이지·분석 폼·지원서 화면(모두 지연 청크)만 import 한다.
 * 홈 번들에 싣지 않는다 — 목록용 최소 필드는 constants/jobPostings.ts.
 *
 * 문장은 블로그 공고 글(.agents/blog-job-posts/drafts, 공식 채용 페이지로 확인한 것)에서 옮긴다. 줄바꿈("\n")은 문단 나눔이다.
 * 대기업 공고 대부분은 자소서 문항을 지원서 화면에서만 보여 준다 — 공개된 문항만 questions 에 싣고, 나머지는 tips(직무별 쓰는 법)로 쓴다.
 */
export type JobPostingQuestion = {
  prompt: string;
  /** 글자 수 제한. 공고에 없으면 null */
  charLimit: number | null;
  /** 무엇을 묻나 */
  ask: string;
  /** 이렇게 써 보세요 */
  how: string;
};

export type JobPostingDetail = {
  /** 검색 설명(160자 이하) */
  description: string;
  keywords: string;
  /** 제목 아래 한 문단: 이번 공고에서 제일 눈에 띄는 점 */
  highlight: string;
  facts: readonly { label: string; value: string }[];
  /** 문항 출처("신세계백화점·이마트, 2026 하반기 기준"). 문항이 없으면 null */
  questionsNote: string | null;
  questions: readonly JobPostingQuestion[];
  /** 직무별로 이렇게 써 보세요 */
  tips: readonly { title: string; body: string }[];
  /** 지원 전에 확인할 것 */
  checks: readonly string[];
  /** 공식 채용 페이지 */
  source: { label: string; url: string };
};

export const JOB_POSTING_DETAILS: Readonly<Record<string, JobPostingDetail>> = {
  "shinsegae-2027": {
    description:
      "신세계그룹 2027 신입 공채(이마트·신세계백화점·스타벅스 등 10개사) 접수 일정·지원 자격·전형과 자소서 3문항이 무엇을 묻는지 정리했어요. 10월 12일(월) 18시 마감.",
    keywords: "신세계그룹 채용, 신세계 2027 신입, 이마트 채용, 신세계백화점 채용, 신세계 자소서 문항",
    highlight:
      "이번 공채에서 제일 눈에 띄는 건 인턴십이 없다는 점이에요. 작년부터 최종 면접 뒤 한 달짜리 인턴십을 없애서, 면접만 통과하면 바로 입사가 확정돼요. 그룹 내 관계사 중복 지원은 안 돼요.",
    facts: [
      { label: "접수 기간", value: "2026.9.18(금) ~ 10.12(월) 18:00" },
      {
        label: "참여 계열사",
        value:
          "이마트, 신세계(백화점), 신세계프라퍼티, SCK컴퍼니(스타벅스), 신세계인터내셔날, 신세계디에프(면세점), 신세계아이앤씨, 신세계푸드, 신세계센트럴, 신세계라이브쇼핑",
      },
      { label: "지원 자격", value: "학사 이상 기졸업 또는 2027년 8월 이전 졸업(예정), 2027년 1월 또는 7월 입사 가능" },
      { label: "전형 절차", value: "서류전형 → 면접(1~3차) → 채용검진 → 입사 (서류 합격자 대상 AI 역량평가 가능)" },
      { label: "일정", value: "서류 합격 발표 10월 말 · 면접 11~12월 · 입사 2027년 1월(졸업 시기에 따라 7월)" },
      { label: "직군", value: "계열사마다 달라요. 이마트는 MD(상품 기획·운영, 해외 소싱)와 경영지원(재무·개발·마케팅·인사·물류·IT) 중 하나를 골라 지원해요." },
    ],
    questionsNote: "신세계백화점·이마트, 2026 하반기 기준. 신세계인터내셔날 등 일부 계열사는 문항이 달라요.",
    questions: [
      {
        prompt: "당사에 지원한 이유와 입사를 위해 어떤 노력을 하였는지 구체적으로 기술하시오.",
        charLimit: 1000,
        ask: "질문이 두 개예요. \"왜 우리 회사인가\"와 \"그래서 무엇을 했는가\". 읽는 사람은 앞의 답보다 뒤의 답을 더 오래 봐요. 노력은 지어낼 수 없으니까요.",
        how: "첫 문장은 \"왜\"의 결론 한 줄로 시작하세요. 비중은 노력 6할, 이유 3할, 입사 후 하고 싶은 일 1할이 안전해요. 노력은 시간순으로 2~3개만, \"언제, 무엇을, 그래서 무엇을 알게 됐는지\"를 한 세트로 쓰세요.",
      },
      {
        prompt:
          "지원한 직군에서 구체적으로 하고 싶은 일과 본인이 그 일을 남들보다 잘할 수 있는 차별화된 능력과 경험을 기술하시오.",
        charLimit: null,
        ask: "직군을 얼마나 이해했는지, 그 이해가 내 경험과 이어지는지를 봐요. \"하고 싶은 일\"이 구체적일수록 뒤의 \"차별화된 능력\"이 설득력을 가져요.",
        how: "하고 싶은 일은 직군 안에서 하나로 좁히세요. 그 일에 필요한 능력 하나를 정하고, 그 능력이 드러난 경험 하나를 깊게 쓰세요. 비중은 하고 싶은 일 3할, 경험 6할, 입사 후 연결 1할.",
      },
      {
        prompt: "학업 외 가장 열정적이고 도전적으로 몰입하여 성과를 창출했거나 목표를 달성한 경험을 기술하시오.",
        charLimit: null,
        ask: "\"학업 외\"라고 못 박았어요. 성과의 크기보다 목표를 어떻게 잡았고, 막혔을 때 무엇을 바꿨는지를 봐요.",
        how: "첫 문장에 목표와 결과를 숫자로 한 줄. 그다음 가장 어려웠던 지점 하나를 골라 그때의 판단을 쓰세요. 마지막 두 문장은 그 경험이 지원 직군에서 어떻게 쓰이는지로 닫으세요.",
      },
    ],
    tips: [],
    checks: [
      "관계사 중복 지원이 안 되니 계열사 선택이 곧 전략이에요.",
      "마감 당일 접속이 몰릴 수 있다고 공고에 적혀 있어요. 하루 전 제출을 권해요.",
      "이마트는 STAFF(매장 근무) 경력이 있으면 서류에서 우대해요. 경력사항란에 꼭 적으세요.",
      "지원서의 어학·자격 사항은 정확히. 사실과 다르면 합격이 취소돼요.",
    ],
    source: { label: "신세계그룹 채용 홈페이지", url: "https://job.shinsegae.com" },
  },
};

/**
 * 서버 공고 요약(POST /api/analyze/posting)에 보낼 본문. 분석 폼 '접수 중인 공고' 탭이 고른 공고를 이 글로 읽힌다.
 * 공고 원문 대신 우리가 확인해 옮긴 사실(핵심 정보·직무별 쓰는 법)을 보낸다.
 */
export function postingTextOf(listing: JobPostingListing, detail: JobPostingDetail): string {
  return [
    listing.title,
    listing.subtitle,
    ...detail.facts.map(fact => `${fact.label}: ${fact.value}`),
    ...detail.questions.map(question => `자소서 문항: ${question.prompt}`),
    ...detail.tips.map(tip => `${tip.title}: ${tip.body}`),
  ].join("\n");
}
