import { useState, type ReactNode } from "react";
import { Link } from "wouter";

import { BrandName } from "@/components/BrandName";
import { RESUME_REPORT_SAMPLE_PATH } from "@/constants/resumeReportSampleMeta";

/* ─────────────────────────────────────────────────────────
   ChatGptComparisonSection — "ChatGPT로 이미 고쳐봤는데 왜 또?" 에 답하는 섹션.
   히어로 바로 다음에 놓인다. 같은 자소서 문장을 두 곳에 넣고 같은 질문을 던진 화면을 나란히 둔다.

   왼쪽만 화면(채팅)이고 오른쪽은 화면이 아니다. 리포트 UI 는 히어로 카드와 ReportShowcase 가
   이미 두 번 보여주므로, 여기서 카드 헤더·칩 바·푸터까지 그리면 세 번째가 된다.

   말투·디자인 규칙(2026-09-27 카피 반복 수정에서 확정):
   1. 분류 라벨("읽는 범위", "해주는 일")과 대문자 소제목을 쓰지 않는다 — "AI가 정리해준 표" 티가 난다.
   2. ChatGPT 를 못하는 도구로 깎지 않는다. 차이는 실력이 아니라 자리다.
   3. 제목으로 후킹하지 않는다. 방문자 머릿속 질문을 그대로 묻고 바로 답한다.
   4. 강조색은 파랑 하나만. 여러 색 태그는 촌스럽고 정신없다는 이유로 기각됐다.

   프리렌더(scripts/prerender-landing.mjs)가 이 마크업을 HTML 에 굽는다. 첫 탭이 그대로 구워지도록
   초기 상태를 0 으로 두고, opacity 0 에서 시작하는 등장 애니메이션은 쓰지 않는다.
   ───────────────────────────────────────────────────────── */

/** 자소서에서 인용한 대목. 형광펜처럼 글자에만 얹는다(줄이 넘어가도 이어지도록 clone). */
function Quote({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2.5 text-pretty break-keep text-[15px] font-semibold leading-[1.7] text-ink">
      <span className="rounded-[4px] bg-brand-soft px-1 py-0.5 [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">
        {children}
      </span>
    </p>
  );
}

/** ChatGPT 답에서 발을 빼는 표현. 오른쪽 파란 강조와 반대로 회색으로 물러나게 둔다. */
function Hedge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[6px] bg-[#333D4B] px-1.5 py-px text-[#E5E8EB]">
      {children}
    </span>
  );
}

function Say({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3.5 text-pretty break-keep text-[15px] leading-[1.75] text-ink-2 [&_b]:font-bold [&_b]:text-brand-ink">
      {children}
    </p>
  );
}

type ChatTurn = { who: "me" | "ai"; text: ReactNode };

type ComparisonCase = {
  id: string;
  question: string;
  chat: ChatTurn[];
  /** 왼쪽 채팅 아래 한 줄. 결국 무엇이 남지 않았는지. */
  verdict: string;
  headline: ReactNode;
  /** 탭 2 에만 있는 공고 키워드 대조. 앞 셋은 공고에만, 뒤 셋은 자소서에만 있는 말. */
  chips?: { missing: string[]; present: string[] };
  blocks: { quote?: ReactNode; say: ReactNode }[];
  fix: { label: string; text: string };
};

const CASES: ComparisonCase[] = [
  {
    id: "line",
    question: "이 문장 어때?",
    chat: [
      { who: "me", text: "이 문장 어때?" },
      {
        who: "ai",
        text: (
          <>
            “팀원 4명과 사용자 설문을 설계·실행해 앱 만족도를 20%
            향상시켰습니다.”
            <br />
            <br />
            능동형 동사로 바꾸고 성과를 앞세웠습니다. 구체적인 수치를 덧붙이시면
            설득력이 더 높아집니다.
          </>
        ),
      },
      { who: "me", text: "이 정도면 여기 붙을까?" },
      {
        who: "ai",
        text: (
          <>
            채용 결과는 회사의 평가 기준과 지원자 풀에 따라 달라져서{" "}
            <Hedge>확답을 드리기는 어렵습니다.</Hedge>
          </>
        ),
      },
    ],
    verdict: "문장은 매끄러워졌지만, 어디가 문제였는지는 그대로 모릅니다.",
    headline: (
      <>
        어떤 일을 했는지는 보이는데, <b>그 과정이 보이지 않아요.</b>
      </>
    ),
    blocks: [
      {
        quote: "“팀원 4명과 사용자 설문을 진행했고,”",
        say: (
          <>
            이건 좋습니다. 단순 리서치나 예측이 아니라,{" "}
            <b>사용자들과 직접 만나고 그들의 목소리를 들은 건</b> 어쩌면 서비스
            기획 직무에서 가장 중요한 태도일 수 있어요.
          </>
        ),
      },
      {
        quote: "“그 결과 앱 만족도를 20% 높일 수 있었습니다.”",
        say: (
          <>
            여기는 조금 아쉬워요. 설문을 통해{" "}
            <b>어떤 것을 보려고 했고, 무엇을 바꾸기로 정했는지</b>가 안 보여요.
            20%도 어떻게 측정한 숫자인지 보이지 않아서,{" "}
            <b>임팩트 없이 지나칠 수 있어요.</b>
          </>
        ),
      },
    ],
    fix: {
      label: "이렇게 바꿔 보세요",
      text: "“배달 시간 안내가 없다는 응답이 가장 많다는 점을 고려하여, 주문 화면과 주문 현황 UX를 다시 설계하였습니다. 그 결과 MAU가 기존 2,000명에서 20% 상승했고, 앱스토어 만족도도 3개월 만에 4.0점에서 4.3점으로 상승하였습니다.”",
    },
  },
  {
    id: "company",
    question: "이 회사엔 맞게 쓴 걸까?",
    chat: [
      { who: "me", text: "현대자동차 서비스 기획 공고에 맞춰서 고쳐 줘" },
      {
        who: "ai",
        text: (
          <>
            <Hedge>공고 내용을 알려주시면</Hedge> 반영해 드리겠습니다.{" "}
            <Hedge>일반적으로는</Hedge> 직무 관련 경험, 정량적 성과, 인재상과의
            연결을 강조하시면 좋습니다.
          </>
        ),
      },
      { who: "me", text: "그럼 뭘 넣어야 해?" },
      {
        who: "ai",
        text: (
          <>
            1. 직무와 연관된 프로젝트 경험
            <br />
            2. 수치로 표현된 성과
            <br />
            3. 인재상과의 연결
            <br />
            <br />
            <Hedge>공고 전문을 붙여넣어 주시면</Hedge> 더 구체적으로
            도와드릴게요.
          </>
        ),
      },
    ],
    verdict: "공고를 읽어주지 않으니, 결국 내가 대조해야 합니다.",
    headline: (
      <>
        공고에 세 번이나 반복된 단어가, 자소서에는 <b>0번</b> 언급됐어요.
      </>
    ),
    chips: {
      missing: ["모빌리티 사용자 경험", "문제 정의", "데이터 기반 판단"],
      present: ["협업 4회", "커뮤니케이션 2회", "실행력 2회"],
    },
    blocks: [
      {
        say: (
          <>
            위 세 개 키워드는 공고에 여러 번 반복해서 언급된{" "}
            <b>중요한 요구사항</b>이에요. 어느 회사에 내도 크게 다르지 않은
            자소서처럼 보일 수 있다는 의미이고, 인사팀 담당자도 그걸 알아챌 수
            있으니 수정하는 걸 추천드려요.
          </>
        ),
      },
      {
        say: (
          <>
            그런데 ‘데이터 분석’ 역량은 <b>이미 가지고 있습니다.</b> 설문 결과를
            토대로 데이터를 분석하고, 어떻게 개선하고 반영할지 실행에 옮긴
            경험을 이와 엮어서 풀어낼 수 있어요. 이미 역량은 가지고 있는데,{" "}
            <b>자소서에 충분히 드러나지 않았습니다.</b>
          </>
        ),
      },
    ],
    fix: {
      label: "이렇게 바꿔 보세요",
      text: "“설문에서 가장 많이 나온 말은 ‘지금 어디쯤인지 모르겠다’였습니다. 사용자가 기다리는 동안 필요한 정보를 제때 주는 일이, 제가 이동과 관련된 서비스에서 이어가고 싶은 문제입니다.”",
    },
  },
  {
    id: "interview",
    question: "면접에서 뭘 물어볼까?",
    chat: [
      { who: "me", text: "이 자소서로 면접 보면 뭘 물어볼까?" },
      {
        who: "ai",
        text: (
          <>
            <Hedge>일반적으로</Hedge> 아래와 같은 질문이 예상됩니다.
            <br />
            1. 본인의 강점은 무엇인가요?
            <br />
            2. 팀에서 갈등을 겪은 경험이 있나요?
            <br />
            3. 우리 회사에 지원한 이유는 무엇인가요?
          </>
        ),
      },
      { who: "me", text: "이 자소서 때문에 나올 질문은?" },
      {
        who: "ai",
        text: (
          <>
            <Hedge>
              회사의 공고나 인재상, 면접 유형을 알려주시면
            </Hedge>{" "}
            더 구체적으로 정리해 드릴 수 있습니다.
          </>
        ),
      },
    ],
    verdict:
      "누구나 받는 질문이라, 이 자소서 때문에 받을 질문은 빠져 있습니다.",
    headline: (
      <>
        문장에 드러나지 않은 내용은 <b>그대로 면접 질문</b>이 될 수 있어요.
      </>
    ),
    blocks: [
      {
        quote:
          "“팀원 4명과 설문을 진행했다고 쓰셨는데, 그중 본인이 맡은 건 무엇이었나요?”",
        say: (
          <>
            문장에는 <b>어떤 역할을 맡았는지</b> 나와 있지 않아서, 가장 먼저
            궁금할 수 있어요. 해당 역할을 맡으며 어떤 것들을 주로 개선하고
            수행했는지에 대한 답변도 준비해 보세요.
          </>
        ),
      },
      {
        quote: "“만족도 20%는 어떻게 재셨나요?”",
        say: (
          <>
            숫자의 기준이 없으면 <b>데이터에 대한 신뢰도</b>는 당연히 떨어집니다.
            이어서 설문 문항은 어떤 식으로 설계했고, 목표 수치는 무엇이었는지에
            대한 질문도 따라올 수 있어요.
          </>
        ),
      },
    ],
    fix: {
      label: "이렇게 준비하세요",
      text: "맡은 범위와 역할 → 판단한 기준 → 수치적 결과 → 배운 점과 느낀 점 순서로, 60초로 대답하는 연습을 해보세요. 같은 경험이라도 논리적이고 깔끔하게 정리될 수 있어요.",
    },
  },
];

/** 대화가 이어지던 중인 것처럼 위쪽에 얹고, 마스크로 흐린다. */
const CHAT_LEAD: ChatTurn[] = [
  { who: "me", text: "자소서 초안 다 썼어" },
  { who: "ai", text: "좋습니다. 붙여넣어 주시면 문장 단위로 검토해 드릴게요." },
];

export default function ChatGptComparisonSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = CASES[activeIndex];

  return (
    <section className="relative overflow-hidden bg-ink py-24 text-white md:py-[120px]">
      {/* 10월 밝은 디자인에서 유일하게 남긴 어두운 띠. 회색 무대 사이에서 "다른 도구와의 비교"를 끊어 보여준다. */}
      <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[30px] font-extrabold leading-[1.3] tracking-[-0.035em] text-white md:text-[46px]">
            ChatGPT와 뭐가 다를까요?
          </h2>
          <p className="mt-3.5 text-pretty break-keep text-[16px] leading-[1.6] text-[#B0B8C1] md:text-[18px]">
            같은 자소서 문장을 두 곳에 넣고, 똑같이 물어봤습니다.
          </p>
        </div>

        <p className="mx-auto mt-10 max-w-[680px] text-pretty break-keep text-center text-[18px] font-semibold leading-[1.6] tracking-[-0.02em] text-white md:text-[22px]">
          “팀원 4명과 사용자 설문을 진행했고, 그 결과 앱 만족도를 20% 높일 수
          있었습니다.”
        </p>

        {/* 질문 탭. 랜딩에서 탭을 실제로 누르는 사람은 소수라 첫 탭만으로도 메시지가 서야 한다. */}
        <div
          role="tablist"
          aria-label="같은 자소서에 던진 질문"
          className="mt-8 flex flex-wrap justify-center gap-2"
        >
          {CASES.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={`h-[42px] rounded-[10px] px-[18px] text-[15px] transition-colors duration-200 ${
                index === activeIndex
                  ? "bg-white font-bold text-ink"
                  : "bg-[#262C36] font-semibold text-[#B0B8C1] hover:text-white"
              }`}
            >
              {item.question}
            </button>
          ))}
        </div>

        <div className="mt-10 grid items-stretch gap-8 md:grid-cols-[0.78fr_1.22fr] md:gap-10">
          {/* ── 왼쪽: 화면(채팅) ── */}
          <div className="flex flex-col">
            <p className="mb-3 flex min-h-5 items-center text-[14px] font-bold text-ink-5">
              ChatGPT에 물어보면
            </p>

            <div className="flex flex-1 flex-col rounded-[28px] bg-[#262C36] p-5 pt-1.5 md:p-6 md:pt-2">
              <div className="flex-1 [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,rgba(0,0,0,0.25)_26px,#000_92px)] [mask-image:linear-gradient(to_bottom,transparent_0,rgba(0,0,0,0.25)_26px,#000_92px)]">
                {[...CHAT_LEAD, ...active.chat].map((turn, index) =>
                  turn.who === "me" ? (
                    <div
                      key={index}
                      className="mb-2.5 ml-auto max-w-[76%] rounded-[16px_16px_4px_16px] bg-ink-2 px-3.5 py-2.5 text-[14px] leading-[1.6] text-[#E5E8EB]"
                    >
                      {turn.text}
                    </div>
                  ) : (
                    <div
                      key={index}
                      className="mb-2.5 max-w-[92%] text-pretty break-keep rounded-[16px_16px_16px_4px] border border-ink-2 bg-ink px-3.5 py-2.5 text-[14px] leading-[1.6] text-[#B0B8C1]"
                    >
                      {turn.text}
                    </div>
                  )
                )}
              </div>

              <div className="mt-3.5 flex h-[46px] items-center justify-between rounded-full border border-ink-2 bg-ink pl-[18px] pr-1.5 text-[14px] text-ink-5">
                무엇이든 물어보세요
                <span
                  aria-hidden="true"
                  className="grid size-[34px] place-items-center rounded-full bg-ink-3 text-[15px] text-white"
                >
                  ↑
                </span>
              </div>
            </div>

            <div className="mt-[18px] flex min-h-[46px] items-center">
              <p className="text-pretty break-keep text-[14px] leading-[1.5] text-ink-5">
                {active.verdict}
              </p>
            </div>
          </div>

          {/* ── 오른쪽: 화면이 아니라 말 ── */}
          <div className="flex flex-col">
            <p className="mb-3 flex min-h-5 items-center gap-1.5 text-[14px] font-bold text-white">
              <BrandName className="h-[1.15em]" /> 는 이렇게 답합니다
            </p>

            <div className="flex-1 rounded-[28px] bg-surface px-6 pb-2 pt-7 text-ink md:px-10 md:pt-10">
              <p className="mb-5 text-pretty break-keep text-[20px] font-extrabold leading-[1.45] tracking-[-0.03em] text-ink md:text-[24px] [&_b]:font-extrabold [&_b]:text-brand-ink">
                {active.headline}
              </p>

              {active.chips ? (
                <div className="mb-4 flex flex-wrap gap-[7px]">
                  {active.chips.missing.map(chip => (
                    <span
                      key={chip}
                      className="inline-flex h-7 items-center rounded-[8px] bg-brand-soft px-2.5 text-[13px] font-bold text-brand-ink"
                    >
                      {chip}
                    </span>
                  ))}
                  <span aria-hidden="true" className="h-0 basis-full" />
                  {active.chips.present.map(chip => (
                    <span
                      key={chip}
                      className="inline-flex h-7 items-center rounded-[8px] bg-fill px-2.5 text-[13px] font-semibold text-ink-4"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}

              {active.blocks.map((block, index) => (
                <div
                  key={index}
                  className={`pb-0.5 pt-4 ${
                    index > 0 ? "border-t border-line-soft" : ""
                  }`}
                >
                  {block.quote ? <Quote>{block.quote}</Quote> : null}
                  <Say>{block.say}</Say>
                </div>
              ))}

              <div className="mb-6 mt-[18px] text-pretty break-keep rounded-[18px] bg-fill px-[22px] py-5 text-[15px] leading-[1.75] text-ink md:mb-10">
                <span className="mb-2 block text-[13px] font-bold text-ink-3">
                  {active.fix.label}
                </span>
                {active.fix.text}
              </div>
            </div>

            <div className="mt-[18px] flex min-h-[46px] items-center">
              <Link
                href={RESUME_REPORT_SAMPLE_PATH}
                className="group inline-flex items-center gap-[7px] text-[15px] font-bold text-white underline underline-offset-4"
              >
                예시 리포트 전체 보기
                <span
                  aria-hidden="true"
                  className="text-[15px] transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
