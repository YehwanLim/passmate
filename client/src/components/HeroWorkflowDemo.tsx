import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, FileText, FileUp, Pause, PenLine, Play, Pointer } from "lucide-react";

/* ─────────────────────────────────────────────────────────
   HeroWorkflowDemo — 랜딩 히어로 오른쪽의 "움직이는 작업실" 시연.
   10-06 시안(디자인 캔버스 Hero-Play)을 옮겼다. 실제 화면 흐름만 보여준다(지어낸 UI 금지):
     1 내 경험으로 초안 쓰기 — 작업실 문항에서 "내 경험으로 초안 쓰기" → 미리보기 → 이 초안으로 채우기
     2 완성하고 진단받기   — [실제 수치] 빈칸 채우기·문장 덧붙이기 → 자소서 분석하기 → 리포트 01 첫인상 → 문장별 코멘트
     3 합격까지 한 번에     — 이력서·자소서로 경험 채우기 → 자소서 초안 → 자소서 분석(예상 질문)
   리포트 장면의 문장·번호는 예시 리포트(resumeReportSample 문항 2)와 같다. 시연 번들이 가벼워야 해서 데이터를 import 하지 않고 옮겨 적었다.
   시간은 장면마다 t(ms) 하나로 흘러가고, 화면의 모든 상태는 t 에서 계산한다.
   프리렌더 HTML 은 첫 장면 t=0(빈 답변 칸)으로 구워진다 — opacity 0 에서 시작하는 요소가 없다.
   마우스를 올리면 멈추고, 일시정지 버튼·탭으로 직접 넘길 수 있다. 움직임 줄이기 설정이면 처음부터 멈춰 둔다.
   ───────────────────────────────────────────────────────── */

const SCENE_LABELS = ["내 경험으로 초안 쓰기", "완성하고 진단받기", "합격까지 한 번에"] as const;
const TICK_MS = 50;
/** 시연은 이 높이·최소 폭으로 짜여 있다. 칸이 최소 폭보다 좁으면(폰) 줄바꿈으로 무너뜨리지 않고 통째로 축소한다.
 *  안쪽 배치는 화면 폭이 아니라 시연 칸 폭(@container, @xl = 576px)으로 바꾼다 — 축소된 폰에서도 같은 기준. */
const DEMO_HEIGHT = 680;
const DEMO_MIN_WIDTH = 460;
// SSR 에는 레이아웃 효과가 없다 — 경고 없이 서버에선 useEffect 로 대신한다.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const ACCENT_RING = "rgba(0, 100, 255, 0.18)";
const ACCENT_RIPPLE = "rgba(0, 100, 255, 0.28)";
const CARD_SHADOW = "shadow-[0_12px_40px_rgba(18,32,90,0.08)]";
const STEP_SHADOW = "shadow-[0_8px_24px_rgba(18,32,90,0.06)]";

/* 장면 1: 작업실에서 "내 경험으로 초안 쓰기" → 미리보기 → 채우기 */
const DRAFT_CLICK = 900;
const LOAD_END = 3200;
const APPLY_CLICK = 7300;

/* 장면 2: 빈칸 채우기·문장 덧붙이기 → 진단받기 → 리포트 */
const BLANK_CLICK = 900;
const BLANK_START = 1150;
const BLANK_MS = 110;
const BLANK_VAL = "18%";
const INSERTED =
  "유저의 클릭 패턴과 체류 시간을 분석한 결과, 개인화가 부족하다는 점을 파악했습니다.";
const INS_START = 1900;
const INS_MS = 55;
const INS_END = INS_START + INSERTED.length * INS_MS;
const DIAG_CLICK = INS_END + 700;
const REPORT = DIAG_CLICK + 1700;
/** 리포트 01 첫인상을 읽힌 뒤, 목차의 "문장별 코멘트"를 누른다. */
const NAV_CLICK = REPORT + 4000;
const LINE = NAV_CLICK + 250;
/** 문장별 코멘트에선 1번 문장이 기본으로 골라져 있다(실제 리포트와 같다). 그다음 2번 문장을 누른다. */
const HL_CLICK = LINE + 1600;
const DIAGNOSE_END = HL_CLICK + 4600;
const BLANK_LABEL = "[실제 수치]";
const BASE_CHAR_COUNT = 505 - BLANK_LABEL.length;

/* 장면 3: 3단계 */
/* 장면 3: 이력서·자소서로 경험 채우기(내 경험 탭의 가져오기, 예시 카드는 workspaceCopy 고정 예시) → 초안 → 분석 */
const IMPORT_CLICK = 900;
const IMPORT_FOUND = IMPORT_CLICK + 1900;
const STEP2 = IMPORT_FOUND + 1400;
const DRAFT_LINE = "직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다.";
const DRAFT_START = STEP2 + 300;
const DRAFT_MS = 38;
const DRAFT_END = DRAFT_START + DRAFT_LINE.length * DRAFT_MS;
const STEP3 = DRAFT_END + 400;
const JOURNEY_END = STEP3 + 4000;

const SCENE_DURATIONS = [10600, DIAGNOSE_END, JOURNEY_END] as const;

const EXPERIENCE_TITLE = "로그 3,000건으로 이탈 원인 찾기";
const QUESTION = "목표를 달성하기 위해 데이터를 활용해 문제를 해결한 경험을 구체적으로 작성해 주세요.";

function typed(text: string, t: number, start: number, msPerChar: number) {
  if (t < start) return "";
  return text.slice(0, Math.min(text.length, Math.floor((t - start) / msPerChar)));
}

/** 가짜 마우스 커서. 버튼 위 left/top(%) 자리로 미끄러져 들어오고, ripple 이 켜지면 눌린 물결을 그린다. */
function FakeCursor({ left, top, ripple }: { left: string; top: string; ripple: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="hero-cursor pointer-events-none absolute z-[3] h-[22px] w-[22px]"
      style={{ left, top }}
    >
      {ripple && (
        <span
          className="hero-ripple absolute left-[-13px] top-[-15px] h-[34px] w-[34px] rounded-full"
          style={{ background: ACCENT_RIPPLE }}
        />
      )}
      <svg className="relative" width="22" height="22" viewBox="0 0 24 24">
        <path
          d="M4 2.5l15 8.4-6.6 1.7-3.1 6.4z"
          fill="#191F28"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Spinner({ size, border }: { size: number; border: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block flex-none animate-spin rounded-full border-brand"
      style={{
        width: size,
        height: size,
        borderWidth: border,
        borderColor: ACCENT_RING,
        borderTopColor: "#0064FF",
      }}
    />
  );
}

function Blank({ children = BLANK_LABEL }: { children?: ReactNode }) {
  return (
    <span className="relative rounded-[4px] bg-blank-soft px-1 py-px font-bold text-blank">
      {children}
    </span>
  );
}

function FileIcon() {
  return <FileText aria-hidden="true" className="h-[15px] w-[15px] flex-none text-ink-5" strokeWidth={2} />;
}

/** 작업실 지원서 머리(회사·직무·마감) + 문항 탭 + 문항 원문. 장면 1·2 가 같은 화면이라 공유한다.
 *  글줄이 빽빽해 보이지 않게 줄 사이를 띄우고, 문항은 상자 대신 제목처럼 둔다(글자 수 한도는 그 아래 작은 글씨). */
function ApplicationHead({ saveLabel, showLimit = true }: { saveLabel: string; showLimit?: boolean }) {
  return (
    <>
      <div className="flex flex-none items-center justify-between px-[22px] pt-5">
        <span className="flex items-center gap-2 text-[14px]">
          <FileIcon />
          <b className="font-bold text-ink">현대자동차 서비스 기획</b>
          <span className="text-[12px] font-bold text-danger">D-5</span>
        </span>
        <span className="text-[12px] text-ink-5">{saveLabel}</span>
      </div>
      <div className="mt-3 flex flex-none gap-5 border-b border-line-soft px-[22px] text-[13px]">
        <span className="pb-2.5 text-ink-4">문항 1</span>
        <span className="pb-2.5 font-bold text-ink shadow-[inset_0_-2px_0_#191F28]">문항 2</span>
      </div>
      <div className="flex-none px-[22px] pt-4">
        <p className="text-[14px] font-semibold leading-[1.6] text-ink">{QUESTION}</p>
        {showLimit && <p className="mt-1 text-[12px] text-ink-4">1,000자 이내</p>}
      </div>
    </>
  );
}

function SceneDraft({ t }: { t: number }) {
  const between = (a: number, z: number) => t >= a && t < z;
  const pressed = between(DRAFT_CLICK, DRAFT_CLICK + 160);
  const applyPressed = between(APPLY_CLICK, APPLY_CLICK + 160);
  const showEmpty = t < DRAFT_CLICK + 150;
  const showLoading = between(DRAFT_CLICK + 150, LOAD_END);
  const showPreview = between(LOAD_END, APPLY_CLICK + 150);
  const showApplied = t >= APPLY_CLICK + 150;

  return (
    <>
      <ApplicationHead saveLabel={between(APPLY_CLICK + 150, APPLY_CLICK + 1000) ? "저장 중" : "저장됨"} />
      <div className="flex flex-none items-center gap-2.5 px-[22px] pt-4">
        <span
          className="relative inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-brand bg-surface px-[13px] text-[13px] font-bold text-brand-ink transition-transform duration-[120ms]"
          style={{
            transform: pressed ? "scale(0.95)" : "scale(1)",
            opacity: between(DRAFT_CLICK + 150, LOAD_END) ? 0.5 : 1,
          }}
        >
          <PenLine aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
          내 경험으로 초안 쓰기
          {between(DRAFT_CLICK - 500, DRAFT_CLICK + 400) && (
            <FakeCursor left="70%" top="50%" ripple={between(DRAFT_CLICK, DRAFT_CLICK + 420)} />
          )}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-[22px] pb-[18px] pt-4">
        {showEmpty && (
          <div className="flex-1 rounded-[14px] border border-line p-3.5 text-[13.5px] text-ink-5">
            답변을 직접 써 보세요. 쓰는 동안 자동으로 저장돼요.
          </div>
        )}
        {showLoading && (
          <div className="hero-msg-in flex flex-1 flex-col gap-3 rounded-[16px] bg-fill-soft p-4">
            <span className="flex items-center gap-2 text-[13px] text-ink-3">
              <Spinner size={14} border={2} />
              경험을 고르고 초안을 쓰고 있어요… (10초 정도)
            </span>
            <span className="h-2.5 w-[92%] rounded-[5px] bg-[#EDEFF2]" />
            <span className="h-2.5 w-[78%] rounded-[5px] bg-[#EDEFF2]" />
            <span className="h-2.5 w-[85%] rounded-[5px] bg-[#EDEFF2]" />
          </div>
        )}
        {showPreview && (
          <div className="hero-msg-in flex min-h-0 flex-1 flex-col gap-2 rounded-[16px] bg-fill-soft p-3 [&>*]:flex-none">
            <div className="flex flex-col gap-0.5 rounded-[12px] bg-surface px-3 py-2.5">
              <span className="text-[11px] font-bold text-ink-4">고른 경험</span>
              <span className="text-[13.5px] font-bold text-ink">{EXPERIENCE_TITLE}</span>
              <span className="hidden text-[12px] text-ink-4 @xl:block">문항이 묻는 ‘데이터로 문제를 푼 과정’이 그대로 남아 있어요</span>
            </div>
            <div className="flex flex-col gap-[9px] rounded-[12px] bg-surface px-3 py-2.5">
              <span className="text-[11px] font-bold text-ink-4">초안</span>
              {[
                { at: LOAD_END + 400, text: <>교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영했습니다.</> },
                { at: LOAD_END + 900, text: <>직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다.</> },
                {
                  at: LOAD_END + 1400,
                  text: (
                    <>
                      그 결과 메인 화면 이탈률을 35%에서 <Blank />로 낮췄습니다.
                    </>
                  ),
                },
              ].map(
                (line, index) =>
                  t >= line.at && (
                    <p key={index} className="hero-msg-in text-[13.5px] leading-[1.6] text-ink">
                      {line.text}
                      {/* 좁은 칸(폰)은 높이가 모자라 출처를 마지막 문장에만 단다(세 문장 모두 같은 경험). */}
                      <span className={`mt-0.5 text-[11px] text-ink-5 ${index === 2 ? "block" : "hidden @xl:block"}`}>
                        출처 · {EXPERIENCE_TITLE}
                      </span>
                    </p>
                  )
              )}
            </div>
            {t >= LOAD_END + 2000 && (
              <span className="hero-msg-in px-0.5 text-[12px] text-blank">
                노란 칸은 경험에 없던 내용이에요. 실제 내용으로 채워 주세요.
              </span>
            )}
            {t >= LOAD_END + 2400 && (
              <div className="hero-msg-in mt-auto flex items-center gap-1.5">
                <span className="text-[12px] text-ink-4">121자</span>
                <span className="flex-1" />
                <span className="hidden h-[34px] items-center px-2.5 text-[12.5px] text-ink-4 @xl:inline-flex">닫기</span>
                <span className="inline-flex h-[34px] items-center rounded-[9px] border border-line bg-surface px-[11px] text-[12.5px] font-semibold text-ink-2">
                  다른 경험으로 다시
                </span>
                <span
                  className="relative inline-flex h-[34px] items-center rounded-[9px] bg-brand px-3 text-[12.5px] font-bold text-white transition-transform duration-[120ms]"
                  style={{ transform: applyPressed ? "scale(0.95)" : "scale(1)" }}
                >
                  이 초안으로 채우기
                  {between(APPLY_CLICK - 550, APPLY_CLICK + 150) && (
                    <FakeCursor left="62%" top="45%" ripple={between(APPLY_CLICK, APPLY_CLICK + 150)} />
                  )}
                </span>
              </div>
            )}
          </div>
        )}
        {showApplied && (
          <div className="hero-msg-in flex flex-1 flex-col gap-2">
            <span className="text-[12px] text-ink-3">초안에 쓴 경험: {EXPERIENCE_TITLE}</span>
            <div className="flex-1 rounded-[14px] border border-brand p-3.5 text-[13.5px] leading-[1.8] text-ink">
              교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영했습니다. 직접 3,000건 이상의 유저
              행동 데이터를 수집하고 분석했습니다. 그 결과 메인 화면 이탈률을 35%에서 <Blank />로 낮췄습니다.
            </div>
            <span className="self-end text-[12px] text-ink-4">공백 포함 121자 · 제외 94자 / 1,000자</span>
          </div>
        )}
      </div>
    </>
  );
}

/* 리포트 장면 — 예시 리포트(resumeReportSample)의 첫인상·문항 2 문장 진단을 옮겨 적었다. */
const REPORT_NAV = ["01 첫인상", "02 합격 기준", "03 핵심 진단", "04 문장별 코멘트", "05 예상 질문"] as const;
const LINE_NAV_INDEX = 3;
const PROFILE_KEYWORDS = ["이탈분석", "실험설계", "서비스기획", "커넥티드서비스"];
const REMEMBERED = ["로그 3,000건을 직접 모은 동아리 기획자", "틀린 가설까지 기록해 다음 실험에 쓴 점", "아버지 차의 원격 공조 이야기"];
type SentenceKind = "praise" | "improvement";
/** 원문에 나오는 순서 = 번호 순서. 오른쪽 코멘트 목록도 같은 순서로 쌓는다(실제 리포트와 같다). */
const SENTENCES: { n: number; kind: SentenceKind; text: string; preview: string; question: string; suggestion?: string }[] = [
  {
    n: 1,
    kind: "praise",
    text: "직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다.",
    preview: "문제를 감이 아닌 데이터로 좁히려 한 첫 행동",
    question: "3,000건의 데이터는 어떤 항목으로, 어떤 방법으로 모았습니까?",
  },
  {
    n: 2,
    kind: "improvement",
    text: INSERTED,
    preview: "클릭 패턴과 체류 시간이 왜 개인화 부족을 뜻하는지 중간 단계가 빠져 있습니다.",
    question: "개인화 부족이 원인이라고 판단한 근거는 무엇이고, 다른 원인은 어떻게 배제했습니까?",
    suggestion: "첫 화면에서 추천 목록을 세 번 이상 넘긴 사용자의 이탈이 가장 높았고, 추천이 취향과 맞지 않는 것이 원인이라고 판단했습니다.",
  },
  {
    n: 3,
    kind: "praise",
    text: "개발자와 실험 기간 및 성공 기준을 합의했습니다.",
    preview: "실험 전에 성공의 기준부터 맞춘 협업",
    question: "성공 기준을 정할 때 개발자와 의견이 달랐던 적이 있습니까?",
  },
  {
    n: 4,
    kind: "improvement",
    text: "그 결과 메인 화면 이탈률을 35%에서 18%로 낮췄고, 일간 활성 사용자 수를 20% 늘렸습니다.",
    preview: "몇 주 동안의 결과인지, 무엇과 비교한 수치인지가 없습니다.",
    question: "이탈률이 줄어든 것이 실험 때문이라고 말할 수 있는 근거는 무엇입니까?",
  },
  {
    n: 5,
    kind: "improvement",
    text: "이 경험을 통해 문제를 정의하는 기준이 명확해야 팀 전체가 같은 방향으로 움직인다는 것을 배웠습니다.",
    preview: "교훈이 일반적이라 현대자동차 서비스 기획과 어떻게 이어지는지 보이지 않습니다.",
    question: "이 경험의 방법을 현대자동차 서비스에 적용한다면 무엇부터 하겠습니까?",
  },
];
const KIND_LABEL: Record<SentenceKind, string> = { praise: "좋은 문장", improvement: "보완 제안" };
/** 리포트 형광펜 색(report.css annotation-hl·commentary-num 과 같은 값). 하나를 고르면 나머지는 옅어진다. */
const HL_COLORS: Record<SentenceKind, { on: string; off: string; badgeOn: string; badgeOff: string; badgeOffText: string; numBg: string; numText: string }> = {
  praise: { on: "#C9EBD8", off: "#EFF9F3", badgeOn: "#0A7B55", badgeOff: "rgba(10, 123, 85, 0.16)", badgeOffText: "#0A7B55", numBg: "#E6F6EE", numText: "#0A7B55" },
  improvement: { on: "#FFE08A", off: "#FFF6D9", badgeOn: "#B97800", badgeOff: "rgba(185, 120, 0, 0.2)", badgeOffText: "#8A5A00", numBg: "#FFF1C2", numText: "#8A5A00" },
};

function Highlight({ n, active, children }: { n: number; active: boolean; children?: ReactNode }) {
  const sentence = SENTENCES[n - 1];
  const color = HL_COLORS[sentence.kind];
  return (
    <span
      className="relative rounded-[4px] px-[3px] py-[2px] transition-[background,color,box-shadow] duration-200 [-webkit-box-decoration-break:clone] [box-decoration-break:clone]"
      style={{
        background: active ? color.on : color.off,
        color: active ? "#191F28" : "#6B7684",
        boxShadow: active && sentence.kind === "improvement" ? "inset 0 -2px 0 #E0A100" : undefined,
      }}
    >
      <b
        className="relative top-[-1px] mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-extrabold transition-colors duration-200"
        style={{ background: active ? color.badgeOn : color.badgeOff, color: active ? "#FFFFFF" : color.badgeOffText }}
      >
        {n}
      </b>
      {sentence.text}
      {children}
    </span>
  );
}

function CommentNum({ kind, n }: { kind: SentenceKind; n: number }) {
  return (
    <span
      className="mt-px inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10.5px] font-extrabold"
      style={{ background: HL_COLORS[kind].numBg, color: HL_COLORS[kind].numText }}
    >
      {n}
    </span>
  );
}

/** 코멘트 본문: 예상 면접 질문 → (보완 제안이면) 개선한 문장. */
function CommentBody({ n, revealAt, t }: { n: number; revealAt: number; t: number }) {
  const sentence = SENTENCES[n - 1];
  return (
    <div className="flex flex-col gap-2.5">
      {t >= revealAt && (
        <div className="hero-msg-in flex flex-col gap-1 rounded-[10px] bg-fill px-[11px] py-2.5">
          <span className="text-[11px] font-bold text-ink-4">예상 면접 질문</span>
          <span className="text-[12.5px] font-bold leading-[1.5] text-navy">
            <span className="text-brand">Q.</span> {sentence.question}
          </span>
        </div>
      )}
      {sentence.suggestion && t >= revealAt + 800 && (
        <div className="hero-msg-in flex flex-col gap-[3px]">
          <span className="text-[11px] font-semibold text-ink-4">개선한 문장</span>
          <span className="text-[12.5px] font-semibold leading-[1.6] text-ink">{sentence.suggestion}</span>
        </div>
      )}
    </div>
  );
}

function SceneDiagnose({ t }: { t: number }) {
  const between = (a: number, z: number) => t >= a && t < z;
  const at = (a: number) => t >= a;
  const insText = typed(INSERTED, t, INS_START, INS_MS);
  const blankText = t < BLANK_START ? "" : typed(BLANK_VAL, t, BLANK_START, BLANK_MS);
  const blankDone = t >= BLANK_START + BLANK_VAL.length * BLANK_MS;
  const typing = (t >= BLANK_START && !blankDone) || between(INS_START, INS_END + 150);
  const charCount = BASE_CHAR_COUNT + insText.length + (t < BLANK_START ? BLANK_LABEL.length : blankText.length);

  if (t < DIAG_CLICK + 250) {
    return (
      <>
        <ApplicationHead saveLabel={typing ? "저장 중" : "저장됨"} showLimit={false} />
        <div className="flex min-h-0 flex-1 flex-col px-[22px] pt-3">
          <p
            className="m-0 flex-1 overflow-hidden rounded-[14px] border px-3.5 py-3 text-[13px] leading-[1.78] text-ink transition-colors duration-150"
            style={{ borderColor: typing ? "#0064FF" : "#E5E8EB" }}
          >
            <b className="font-bold">[감이 아니라 로그로 찾은 이탈의 이유]</b>
            <br />
            {/* 좁은 칸(폰)에선 칸이 낮아 곁가지 문장 몇 개를 접는다 — 빈칸·덧붙인 문장은 그대로 보인다. */}
            교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영했습니다.{" "}
            <span className="hidden @xl:inline">서비스 오픈 후 두 달이 지나도 재방문율이 기대에 미치지 못했고, </span>감이 아니라
            데이터로 원인을 찾아야 한다고 판단했습니다.
            <br />
            직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다. 화면별 로그를 정리해 사용자가 어느 단계에서 오래
            머무르고 어디에서 떠나는지 흐름으로 기록했습니다. <span>{insText}</span>
            {between(INS_START, INS_END + 150) && <span className="hero-caret" />}
            <br />
            가설을 세운 뒤에는 팀원들과 우선순위를 정해 개선 항목을 두 가지로 좁혔습니다.{" "}
            <span className="hidden @xl:inline">분석 결과를 바탕으로 추천 콘텐츠의 노출 순서를 바꾸고, </span>개발자와 실험 기간
            및 성공 기준을 합의했습니다. 2주 단위로 실험을 반복했습니다.
            <span className="hidden @xl:inline"> 가설이 틀렸을 때도 원인을 기록해 다음 실험의 기준으로 삼았습니다.</span>
            <br />
            그 결과 메인 화면 이탈률을 35%에서{" "}
            {t < BLANK_START && (
              <Blank>
                {BLANK_LABEL}
                {between(BLANK_CLICK - 550, BLANK_START) && (
                  <FakeCursor left="60%" top="55%" ripple={between(BLANK_CLICK, BLANK_CLICK + 250)} />
                )}
              </Blank>
            )}
            <span
              className={t >= BLANK_START && t < BLANK_START + 1400 ? "font-bold text-navy" : undefined}
            >
              {blankText}
            </span>
            {t >= BLANK_START && !blankDone && <span className="hero-caret" />}로 낮췄고, 일간 활성 사용자 수를 20%
            늘렸습니다. 이 경험을 통해 문제를 정의하는 기준이 명확해야 팀 전체가 같은 방향으로 움직인다는 것을 배웠습니다.
          </p>
          <span className="mt-1.5 self-end text-[12px] text-ink-4">공백 포함 {charCount}자 / 1,000자</span>
        </div>
        <div className="mt-2.5 flex flex-none items-center justify-end border-t border-line-soft px-[22px] pb-4 pt-3">
          <span
            className="relative inline-flex h-[42px] items-center gap-[7px] rounded-[11px] bg-brand px-[18px] text-[13.5px] font-bold text-white transition-transform duration-[120ms]"
            style={{ transform: between(DIAG_CLICK, DIAG_CLICK + 160) ? "scale(0.95)" : "scale(1)" }}
          >
            자소서 분석하기
            {between(DIAG_CLICK - 550, DIAG_CLICK + 250) && (
              <FakeCursor left="66%" top="30%" ripple={between(DIAG_CLICK, DIAG_CLICK + 250)} />
            )}
          </span>
        </div>
      </>
    );
  }

  if (t < REPORT) {
    const progress = Math.max(0, Math.min(100, ((t - DIAG_CLICK - 250) / (REPORT - DIAG_CLICK - 250)) * 100));
    return (
      <div className="hero-msg-in flex flex-1 flex-col items-center justify-center gap-3.5">
        <Spinner size={34} border={3} />
        <span className="text-[16px] font-bold text-navy">채용 담당자 눈으로 읽고 있어요</span>
        <div className="h-1.5 w-[220px] overflow-hidden rounded-[3px] bg-fill">
          <div className="h-1.5 rounded-[3px] bg-brand" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  const onLine = t >= LINE;
  const focused = t >= HL_CLICK + 150 ? 2 : 1;
  return (
    <div className="hero-msg-in relative flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center justify-between px-[22px] pt-4">
        <span className="flex items-center gap-[7px] text-[13px] text-ink-4">
          <b className="font-bold text-ink">자소서 진단 리포트</b>
          <span className="hidden @xl:inline">현대자동차 서비스 기획</span>
        </span>
        <span className="text-[12px] text-ink-4">김민지님 · 문항 2개</span>
      </div>
      {/* 리포트 목차(폰에서 보이는 칩 줄과 같은 모양). 넘치는 칩은 잘린다. */}
      <div className="flex flex-none gap-1.5 overflow-hidden whitespace-nowrap border-b border-line-soft px-[22px] pb-3 pt-3">
        {REPORT_NAV.map((label, index) => {
          const active = onLine ? index === LINE_NAV_INDEX : index === 0;
          const isTarget = index === LINE_NAV_INDEX;
          return (
            <span
              key={label}
              className="relative inline-flex h-7 flex-none items-center rounded-[8px] px-2.5 text-[12px] transition-[background,color,transform] duration-150"
              style={{
                background: active ? "#EBF3FF" : "#F2F4F6",
                color: active ? "#004EC7" : "#8B95A1",
                fontWeight: active ? 700 : 600,
                transform: isTarget && between(NAV_CLICK, NAV_CLICK + 160) ? "scale(0.95)" : "scale(1)",
              }}
            >
              {label}
              {isTarget && between(NAV_CLICK - 600, NAV_CLICK + 250) && (
                <FakeCursor left="55%" top="30%" ripple={between(NAV_CLICK, NAV_CLICK + 250)} />
              )}
            </span>
          );
        })}
      </div>
      {!onLine ? (
        // 리포트 01 첫인상과 같은 짜임: 위는 이름표 띠(이니셜·읽히는 모습 | 지원자 프로필·키워드),
        // 아래는 채용 담당자가 읽는 순서(3초·10초·30초). 넓은 칸은 세 칸 가로, 좁은 칸은 위아래로 쌓는다.
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-[22px] pb-3 pt-4">
          <div className="grid flex-none items-center gap-4 @xl:grid-cols-[minmax(0,1fr)_200px]">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-navy text-[17px] font-extrabold text-white @xl:h-12 @xl:w-12 @xl:text-[19px]">
                김
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[12px] text-ink-4">김민지님은 채용 담당자에게 이렇게 읽혀요</span>
                <span className="text-[20px] font-bold leading-[1.3] tracking-[-0.03em] text-navy @xl:text-[22px]">
                  사용자가 떠나는 지점을
                  <br />
                  데이터로 좁히는 기획자
                </span>
              </div>
            </div>
            <div className="hidden flex-col gap-1.5 @xl:flex">
              <span className="text-[11px] font-bold text-ink-5">지원자 프로필</span>
              <span className="text-[12px] leading-[1.6] text-ink-2">
                동아리 추천 서비스에서 이탈 원인을 로그로 좁히고 실험으로 고친 경험이 중심에 있어요.
              </span>
              <span className="flex flex-wrap gap-1">
                {PROFILE_KEYWORDS.map(keyword => (
                  <span
                    key={keyword}
                    className="rounded-[8px] border border-line bg-fill-soft px-2 py-[3px] text-[11px] font-semibold text-ink-3"
                  >
                    #{keyword}
                  </span>
                ))}
              </span>
            </div>
          </div>
          <div className="flex min-h-0 flex-col gap-3 border-t border-line-soft pt-3.5">
            <span className="flex-none text-[13px] font-bold text-ink">채용 담당자가 읽는 순서대로</span>
            <div className="grid min-h-0 gap-3 @xl:grid-cols-3 @xl:gap-3.5">
              {at(REPORT + 400) && (
                <div className="hero-msg-in flex flex-col gap-2">
                  <ReadingTime time="3초" label="처음 보이는 것" tone="ok" />
                  <p className="m-0 rounded-[12px] bg-fill-soft px-3.5 py-2.5 text-[13px] font-bold leading-[1.55] text-ink @xl:py-3">
                    로그 3,000건과 2주 단위 실험이 무기인 자소서, 이제 그 시선이 차 안의 고객에게 닿으면 완성됩니다
                  </p>
                </div>
              )}
              {at(REPORT + 1000) && (
                <div className="hero-msg-in flex flex-col gap-2">
                  <ReadingTime time="10초" label="기억에 남는 것" tone="ok" />
                  {REMEMBERED.map(
                    (item, index) =>
                      at(REPORT + 1000 + index * 250) && (
                        <div
                          key={item}
                          className="hero-msg-in flex items-center gap-2.5 rounded-[12px] bg-fill-soft px-3 py-2 text-[13px] font-bold leading-[1.45] text-ink @xl:items-start @xl:px-2.5"
                        >
                          <span className="inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-ok-soft @xl:mt-px">
                            <Check aria-hidden="true" className="h-2.5 w-2.5 text-ok" strokeWidth={3.4} />
                          </span>
                          {item}
                        </div>
                      )
                  )}
                </div>
              )}
              {at(REPORT + 2200) && (
                <div className="hero-msg-in flex flex-col gap-2">
                  <ReadingTime time="30초" label="다 읽고 남는 질문" tone="fix" last />
                  <div className="flex items-center gap-2.5 rounded-[12px] bg-blank-soft px-3 py-2.5 @xl:flex-col @xl:items-start @xl:gap-2 @xl:px-3.5 @xl:py-3">
                    <AlertTriangle aria-hidden="true" className="h-4 w-4 flex-none text-blank" strokeWidth={2.2} />
                    <span className="text-[13px] font-bold leading-[1.45] text-ink @xl:text-[14px]">차량 서비스로 옮겨 올 근거는 아직 얇다</span>
                    <span className="hidden text-[12px] leading-[1.55] text-ink-3 @xl:block">
                      면접에서 먼저 물어볼 수 있는 부분이에요.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="hero-msg-in grid min-h-0 flex-1 gap-[18px] px-[22px] pb-4 pt-4 @xl:grid-cols-[minmax(0,1fr)_236px]">
          <div className="min-w-0 overflow-hidden">
            {/* 좁은 칸에선 시트가 아래를 덮는다 — 실제 폰 리포트처럼 원문을 올려 누른 문장이 시트 위에 남게 한다. */}
            <div
              className={`flex flex-col gap-2.5 transition-transform duration-500 ${
                t >= HL_CLICK + 150 ? "-translate-y-[150px] @xl:translate-y-0" : ""
              }`}
            >
            <span className="text-[12.5px] font-bold leading-[1.5] text-ink">
              <span className="font-semibold text-ink-5">문항 02 </span>
              {QUESTION}
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-ink-4 @xl:hidden">
              <Pointer aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
              표시된 문장을 누르면 코멘트를 볼 수 있어요
            </span>
            <p className="m-0 text-[13px] leading-[1.9] text-ink-5">
              <b className="font-bold">[감이 아니라 로그로 찾은 이탈의 이유]</b>
              <br />
              교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영했습니다. 감이 아니라 데이터로 원인을 찾아야
              한다고 판단했습니다. <Highlight n={1} active={focused === 1} /> 화면별 로그를 정리해 사용자가 어디에서 떠나는지 흐름으로
              기록했습니다.{" "}
              <Highlight n={2} active={focused === 2}>
                {between(HL_CLICK - 600, HL_CLICK + 250) && (
                  <FakeCursor left="40%" top="55%" ripple={between(HL_CLICK, HL_CLICK + 250)} />
                )}
              </Highlight>
              <br />
              가설을 세운 뒤에는 개선 항목을 두 가지로 좁혔습니다. <Highlight n={3} active={false} /> 2주 단위로 실험을 반복했습니다.
              <br />
              <Highlight n={4} active={false} /> <Highlight n={5} active={false} />
            </p>
            </div>
          </div>
          {/* 넓은 칸: 오른쪽 코멘트 목록. 원문 순서(1→5)대로 쌓고, 고른 문장만 펼친다. 칸보다 길면 아래를 흐리게 자른다(실제로는 스크롤). */}
          <div className="hidden min-h-0 flex-col overflow-hidden [mask-image:linear-gradient(to_bottom,#000_88%,transparent)] @xl:flex @xl:border-l @xl:border-line-soft @xl:pl-[18px]">
            <span className="pb-2.5 text-[13px] font-bold text-ink">문장별 코멘트</span>
            {SENTENCES.map(sentence => {
              const open = sentence.n === focused;
              return (
                <div key={sentence.n} className="flex flex-none flex-col gap-2 border-t border-line-soft py-2.5">
                  <div className="flex gap-2">
                    <CommentNum kind={sentence.kind} n={sentence.n} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`text-[11px] font-semibold ${sentence.kind === "praise" ? "text-ok" : "text-blank"}`}>
                        {KIND_LABEL[sentence.kind]}
                      </span>
                      <span className={`text-[12.5px] leading-[1.5] text-ink-2 ${open ? "" : "line-clamp-1"}`}>{sentence.preview}</span>
                    </div>
                    <ChevronDown
                      aria-hidden="true"
                      className={`mt-[3px] h-3.5 w-3.5 flex-none text-[#B0B8C1] transition-transform ${open ? "rotate-180" : ""}`}
                      strokeWidth={2.2}
                    />
                  </div>
                  {open && (
                    <div key={sentence.n} className="hero-msg-in pl-7">
                      <CommentBody n={sentence.n} t={t} revealAt={sentence.n === 1 ? LINE : HL_CLICK + 500} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* 좁은 칸: 실제 폰 리포트처럼 문장을 누르면 아래에서 코멘트 시트가 올라온다. */}
          {t >= HL_CLICK + 150 && (
            <div className="hero-msg-in absolute inset-x-0 bottom-0 flex flex-col gap-2.5 rounded-t-[20px] bg-surface px-[18px] pb-4 pt-3 shadow-[0_-8px_28px_rgba(18,32,90,0.14)] @xl:hidden">
              <span className="mx-auto h-1 w-9 rounded-full bg-line" />
              <div className="flex items-center gap-2">
                <CommentNum kind="improvement" n={2} />
                <span className="text-[12px] font-semibold text-blank">{KIND_LABEL.improvement}</span>
                <span className="ml-auto text-[12px] tabular-nums text-ink-4">2 / {SENTENCES.length}</span>
              </div>
              <p className="m-0 text-[12.5px] leading-[1.6] text-ink-3">“{SENTENCES[1].text}”</p>
              <p className="m-0 text-[12.5px] leading-[1.6] text-ink-2">{SENTENCES[1].preview}</p>
              <CommentBody n={2} t={t} revealAt={HL_CLICK + 500} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 첫인상의 3초·10초·30초 머리. 넓은 칸에서는 실제 리포트처럼 점과 선으로 읽는 순서를 잇는다. */
function ReadingTime({ time, label, tone, last = false }: { time: string; label: string; tone: "ok" | "fix"; last?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden="true" className="hidden items-center @xl:flex">
        <span
          className={`h-3 w-3 flex-none rounded-full ${
            tone === "ok" ? "bg-ok shadow-[0_0_0_4px_var(--color-ok-soft)]" : "bg-[#B97800] shadow-[0_0_0_4px_var(--color-blank-soft)]"
          }`}
        />
        <span className={`ml-2.5 h-0.5 flex-1 ${last ? "" : "bg-line"}`} />
      </div>
      <span className="flex items-baseline gap-1.5">
        <span className="text-[15px] font-extrabold tracking-[-0.02em] text-ink @xl:text-[20px]">{time}</span>
        <span className="text-[12px] font-semibold text-ink-4">{label}</span>
      </span>
    </div>
  );
}

function StepRow({
  n,
  active,
  lineAbove,
  lineBelow,
  title,
  desc,
  children,
  last = false,
}: {
  n: number;
  active: boolean;
  lineAbove: string | null;
  lineBelow: string | null;
  title: string;
  desc: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-[30px_minmax(0,1fr)] gap-x-3 transition-opacity duration-300"
      style={{ opacity: active ? 1 : 0.45 }}
    >
      <div className="flex flex-col items-center">
        <div className="w-0.5 flex-1 transition-colors duration-300" style={{ background: lineAbove ?? "transparent" }} />
        <span
          className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-white transition-colors duration-300"
          style={{ background: active ? "#0064FF" : "#B0B8C1" }}
        >
          {n}
        </span>
        <div className="w-0.5 flex-1 transition-colors duration-300" style={{ background: lineBelow ?? "transparent" }} />
      </div>
      <div className={`flex ${last ? "" : "pb-3"}`}>
        <div
          className={`grid flex-1 grid-cols-[112px_minmax(0,1fr)] items-center gap-3 rounded-[24px] bg-surface py-4 pl-5 pr-4 @xl:grid-cols-[160px_minmax(0,1fr)] @xl:gap-[18px] @xl:py-[18px] @xl:pl-[22px] @xl:pr-[18px] ${STEP_SHADOW}`}
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-[19px] font-bold leading-[1.3] tracking-[-0.03em] text-navy @xl:text-[21px]">{title}</span>
            <span className="text-[13px] leading-[1.55] text-ink-3">{desc}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function SceneJourney({ t }: { t: number }) {
  const at = (a: number) => t >= a;
  const between = (a: number, z: number) => t >= a && t < z;
  const line1 = at(STEP2) ? "#0064FF" : "#D1D6DB";
  const line2 = at(STEP3) ? "#0064FF" : "#D1D6DB";

  return (
    <div className="hero-scene-in flex min-h-0 flex-1 flex-col justify-center px-4 pb-6 pt-3 @xl:px-6 @xl:pb-[26px]">
      <div className="flex flex-col">
        <StepRow n={1} active lineAbove={null} lineBelow={line1} title="내 경험" desc="이력서·자소서를 넣으면 경험 카드로 정리해요">
          <div className="flex flex-col gap-[7px]">
            <div className="flex flex-col gap-0.5 rounded-[12px] bg-fill-soft px-3 py-2">
              <span className="text-[12.5px] font-bold text-ink-2">{EXPERIENCE_TITLE}</span>
              <span className="text-[11px] text-ink-4">교내 앱 동아리 · 데이터분석</span>
            </div>
            <div className="hidden flex-col gap-0.5 rounded-[12px] bg-fill-soft px-3 py-2 @xl:flex">
              <span className="text-[12.5px] font-bold text-ink-2">손님 불만을 단골로 바꾼 3개월</span>
              <span className="text-[11px] text-ink-4">2024.03~05 · 고객 응대</span>
            </div>
            {t < IMPORT_CLICK + 150 ? (
              <span
                className="relative flex h-[47px] items-center gap-1.5 rounded-[12px] border-[1.5px] border-dashed border-[#D1D6DB] px-3 text-[12.5px] font-bold text-brand-ink transition-transform duration-[120ms]"
                style={{ transform: between(IMPORT_CLICK, IMPORT_CLICK + 160) ? "scale(0.97)" : "scale(1)" }}
              >
                <FileUp aria-hidden="true" className="h-3.5 w-3.5 flex-none" strokeWidth={2.2} />
                이력서·자소서로 경험 채우기
                {between(IMPORT_CLICK - 550, IMPORT_CLICK + 150) && (
                  <FakeCursor left="60%" top="45%" ripple={between(IMPORT_CLICK, IMPORT_CLICK + 150)} />
                )}
              </span>
            ) : t < IMPORT_FOUND ? (
              <div className="hero-msg-in flex h-[47px] items-center gap-2 rounded-[12px] bg-fill-soft px-3 text-[12px] text-ink-3">
                <Spinner size={13} border={2} />
                글에서 경험을 찾고 있어요
              </div>
            ) : (
              <div className="hero-msg-in flex h-[47px] flex-col justify-center gap-0.5 rounded-[12px] bg-fill-soft px-3">
                <span className="truncate text-[12.5px] font-bold text-ink-2">주말 대기 줄을 줄인 카페 아르바이트</span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-ok">
                  <Check aria-hidden="true" className="h-[11px] w-[11px]" strokeWidth={3.2} />
                  방금 저장했어요
                </span>
              </div>
            )}
          </div>
        </StepRow>

        <StepRow
          n={2}
          active={at(STEP2)}
          lineAbove={line1}
          lineBelow={line2}
          title="자소서 초안"
          desc="공고 문항에 맞는 경험으로 초안을 잡아 드려요"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-[7px] border-b border-line-soft pb-[7px]">
              <FileText aria-hidden="true" className="h-3.5 w-3.5 flex-none text-ink-5" strokeWidth={2} />
              <span className="text-[12px] font-bold text-ink-2">현대자동차 서비스 기획</span>
              <span className="text-[12px] text-ink-4">2번 문항</span>
            </div>
            <span className="text-[11.5px] text-ink-3">
              쓴 경험 <b className="text-brand-ink">{EXPERIENCE_TITLE}</b>
            </span>
            <div className="min-h-10 rounded-[12px] bg-fill-soft px-3 py-[9px]">
              <span className="text-[12px] leading-[1.6] text-ink-2">{typed(DRAFT_LINE, t, DRAFT_START, DRAFT_MS)}</span>
              {between(DRAFT_START, DRAFT_END + 150) && <span className="hero-caret" />}
            </div>
          </div>
        </StepRow>

        <StepRow
          n={3}
          active={at(STEP3)}
          lineAbove={line2}
          lineBelow={null}
          title="자소서 분석"
          desc="채용 담당자 눈으로 고칠 곳을 짚어 드려요"
          last
        >
          <div className="flex min-h-[92px] flex-col gap-2">
            <span className="text-[12px] leading-[1.65] text-ink-2">
              <span
                className="transition-[background,box-shadow] duration-300"
                style={
                  at(STEP3 + 500)
                    ? { background: "rgba(0, 100, 255, 0.10)", boxShadow: "inset 0 -2px 0 #0064FF" }
                    : undefined
                }
              >
                {INSERTED}
              </span>
            </span>
            {at(STEP3 + 1000) && (
              <div className="hero-msg-in flex flex-col gap-[3px] rounded-[12px] bg-fill-soft px-3 py-[9px]">
                <span className="text-[10.5px] font-bold text-ink-4">예상 면접 질문</span>
                <span className="text-[12px] leading-[1.55] text-navy">
                  <b className="text-brand">Q.</b> 개인화 부족이 원인이라고 판단한 근거는 무엇입니까?
                </span>
              </div>
            )}
          </div>
        </StepRow>
      </div>

    </div>
  );
}

export default function HeroWorkflowDemo({ className = "" }: { className?: string }) {
  const [scene, setScene] = useState(0);
  const [t, setT] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // 칸 폭이 최소 폭보다 좁으면 그 비율만큼 줄인다. 넓으면 그대로(1).
  useIsomorphicLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const update = () => setScale(Math.min(1, element.clientWidth / DEMO_MIN_WIDTH));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 움직임 줄이기 설정이면 처음부터 멈춰 둔다(탭으로는 넘길 수 있다).
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setUserPaused(true);
  }, []);

  // 화면 밖이거나 탭이 숨으면 시계를 멈춘다 — 아래로 스크롤한 뒤에도 20fps 로 다시 그리지 않게.
  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const running = !hovered && !userPaused && visible;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setT(previous => previous + TICK_MS);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (t >= SCENE_DURATIONS[scene]) {
      setScene(current => (current + 1) % SCENE_DURATIONS.length);
      setT(0);
    }
  }, [t, scene]);

  const goTo = (index: number) => {
    setScene(index);
    setT(0);
  };

  const scaled = scale < 1;
  return (
    // min-w-0·overflow-hidden: 축소 전 안쪽 폭(최소 폭)이 바깥 칸을 밀어 넓히면 비율 계산이 1↔축소로 오락가락한다.
    <div ref={rootRef} className={`min-w-0 overflow-hidden ${className}`} style={{ height: DEMO_HEIGHT * scale }}>
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="@container relative flex flex-col overflow-hidden rounded-[28px] bg-fill text-left md:rounded-[32px]"
      style={{
        width: scaled ? DEMO_MIN_WIDTH : "100%",
        height: DEMO_HEIGHT,
        transform: scaled ? `scale(${scale})` : undefined,
        transformOrigin: "top left",
      }}
      aria-label="Pre:View 작업실 사용 흐름 미리보기"
      role="region"
    >
      <div className="grid flex-none grid-cols-[repeat(3,minmax(0,1fr))_30px] items-start gap-3.5 px-4 pb-1 pt-5 @xl:px-[22px]">
        {SCENE_LABELS.map((label, index) => {
          const width = index < scene ? 100 : index === scene ? Math.min(100, (t / SCENE_DURATIONS[scene]) * 100) : 0;
          const current = index === scene;
          return (
            <button
              key={label}
              type="button"
              onClick={() => goTo(index)}
              aria-current={current ? "step" : undefined}
              className="flex flex-col gap-2 text-left"
            >
              <span className="block h-[3px] overflow-hidden rounded-[2px] bg-[#D1D6DB]">
                <span className="block h-[3px] bg-brand" style={{ width: `${width}%` }} />
              </span>
              <span
                className="text-[12px] leading-[1.3] @xl:text-[13px]"
                style={{ color: current ? "#12205A" : "#6B7684", fontWeight: current ? 700 : 600 }}
              >
                {index + 1} {label}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setUserPaused(paused => !paused)}
          aria-label={userPaused ? "재생" : "일시정지"}
          className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-surface text-navy shadow-[0_2px_8px_rgba(18,32,90,0.08)]"
        >
          {userPaused ? (
            <Play aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" />
          ) : (
            <Pause aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" />
          )}
        </button>
      </div>

      {scene === 2 ? (
        <SceneJourney key="journey" t={t} />
      ) : (
        <div key={scene} className="hero-scene-in flex min-h-0 flex-1 flex-col px-3 pb-3.5 pt-2 @xl:px-[18px]">
          <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-surface @xl:rounded-[28px] ${CARD_SHADOW}`}>
            {scene === 0 ? <SceneDraft t={t} /> : <SceneDiagnose t={t} />}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
