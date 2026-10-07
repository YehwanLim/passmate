import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight, FileText, Pause, PenLine, Play } from "lucide-react";

/* ─────────────────────────────────────────────────────────
   HeroWorkflowDemo — 랜딩 히어로 오른쪽의 "움직이는 작업실" 시연.
   10-06 시안(디자인 캔버스 Hero-Play)을 그대로 옮겼다. 실제 화면 흐름만 보여준다(지어낸 UI 금지):
     1 경험으로 초안 받기 — 작업실 문항에서 "내 경험으로 초안 쓰기" → 미리보기 → 이 초안으로 채우기
     2 채우고 진단받기   — [실제 수치] 빈칸 채우기·문장 덧붙이기 → 진단받기 → 리포트 요약 → 고칠 점 2 → 문장 코멘트
     3 합격까지 한눈에   — 경험 관리 → 자소서 초안 → 자소서 분석 → 합격까지 막대
   시간은 장면마다 t(ms) 하나로 흘러가고, 화면의 모든 상태는 t 에서 계산한다.
   프리렌더 HTML 은 첫 장면 t=0(빈 답변 칸)으로 구워진다 — opacity 0 에서 시작하는 요소가 없다.
   마우스를 올리면 멈추고, 일시정지 버튼·탭으로 직접 넘길 수 있다. 움직임 줄이기 설정이면 처음부터 멈춰 둔다.
   ───────────────────────────────────────────────────────── */

const SCENE_DURATIONS = [10600, 16600, 11200] as const;
const SCENE_LABELS = ["경험으로 초안 받기", "채우고 진단받기", "합격까지 한눈에"] as const;
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
const FIX_CLICK = REPORT + 3700;
const SENT = FIX_CLICK + 300;
const BLANK_LABEL = "[실제 수치]";
const BASE_CHAR_COUNT = 505 - BLANK_LABEL.length;

/* 장면 3: 3단계 */
const EXP = "동아리 축제 예산을 반으로 줄인 한 학기";
const EXP_START = 500;
const EXP_MS = 60;
const EXP_END = EXP_START + EXP.length * EXP_MS;
const EXP_SAVE = EXP_END + 300;
const STEP2 = EXP_SAVE + 500;
const DRAFT_LINE = "직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다.";
const DRAFT_START = STEP2 + 300;
const DRAFT_MS = 38;
const DRAFT_END = DRAFT_START + DRAFT_LINE.length * DRAFT_MS;
const STEP3 = DRAFT_END + 400;
const BAR = STEP3 + 2000;

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

/** 작업실 지원서 머리(회사·직무·마감) + 문항 탭. 장면 1·2 가 같은 화면이라 공유한다. */
function ApplicationHead({ saveLabel }: { saveLabel: string }) {
  return (
    <>
      <div className="flex flex-none items-center justify-between px-[22px] pt-4">
        <span className="flex items-center gap-[7px] text-[13px] text-ink-4">
          <FileIcon />
          <b className="font-bold text-ink">현대자동차 서비스 기획</b>
          <span className="font-bold text-danger">D-5</span>
        </span>
        <span className="text-[12px] text-ink-4">{saveLabel}</span>
      </div>
      <div className="flex flex-none gap-[18px] border-b border-line-soft px-[22px] pt-3 text-[13px]">
        <span className="pb-[9px] text-ink-4">문항 1</span>
        <span className="pb-[9px] font-bold text-ink shadow-[inset_0_-2px_0_#191F28]">문항 2</span>
        <span className="pb-[9px] text-ink-5">+ 문항 추가</span>
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
      <div className="flex flex-none gap-2 px-[22px] pt-3.5">
        <div className="flex-1 rounded-[12px] bg-fill-soft px-3 py-2.5 text-[13px] leading-[1.55] text-ink-2">{QUESTION}</div>
        <div className="flex w-[76px] flex-none items-center justify-center rounded-[12px] bg-fill-soft text-[13px] text-ink-2">
          1,000자
        </div>
      </div>
      <div className="flex flex-none items-center gap-2.5 px-[22px] pt-3">
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
      <div className="flex min-h-0 flex-1 flex-col px-[22px] pb-[18px] pt-3">
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
                      <span className="mt-0.5 block text-[11px] text-ink-5">출처 · {EXPERIENCE_TITLE}</span>
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

const FIX_ITEMS = [
  { n: 1, title: "차량 서비스로 이어지는 다리", where: "문항 2 · 마지막 문장" },
  { n: 2, title: "개인화 부족의 판단 근거", where: "문항 2 · 둘째 문단" },
  { n: 3, title: "이탈률 개선의 비교 기준", where: "문항 2 · 결과 문장" },
];
const GOOD_ITEMS = ["로그 3,000건으로 좁힌 원인", "개발자와 합의한 성공 기준", "틀린 가설까지 남긴 실험 기록"];

function NumberDot({ n, tone = "strong", size = 18 }: { n: number; tone?: "strong" | "soft"; size?: number }) {
  return (
    <span
      className="mt-px inline-flex flex-none items-center justify-center rounded-full text-[10.5px] font-extrabold text-white"
      style={{ width: size, height: size, background: tone === "strong" ? "#B97800" : "#D9B25C" }}
    >
      {n}
    </span>
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
  const tabActive = "font-bold text-ink shadow-[inset_0_-2px_0_#191F28]";

  if (t < DIAG_CLICK + 250) {
    return (
      <>
        <ApplicationHead saveLabel={typing ? "저장 중" : "저장됨"} />
        <div className="flex min-h-0 flex-1 flex-col px-[22px] pt-3">
          <span className="mb-2 flex-none text-[12.5px] leading-[1.5] text-ink-3">{QUESTION} (1,000자 이내)</span>
          <p
            className="m-0 flex-1 overflow-hidden rounded-[14px] border px-3.5 py-3 text-[13px] leading-[1.78] text-ink transition-colors duration-150"
            style={{ borderColor: typing ? "#0064FF" : "#E5E8EB" }}
          >
            <b className="font-bold">[감이 아니라 로그로 찾은 이탈의 이유]</b>
            <br />
            교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영했습니다. 서비스 오픈 후 두 달이 지나도
            재방문율이 기대에 미치지 못했고, 감이 아니라 데이터로 원인을 찾아야 한다고 판단했습니다.
            <br />
            직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다. 화면별 로그를 정리해 사용자가 어느 단계에서 오래
            머무르고 어디에서 떠나는지 흐름으로 기록했습니다. <span>{insText}</span>
            {between(INS_START, INS_END + 150) && <span className="hero-caret" />}
            <br />
            가설을 세운 뒤에는 팀원들과 우선순위를 정해 개선 항목을 두 가지로 좁혔습니다. 분석 결과를 바탕으로 추천 콘텐츠의
            노출 순서를 바꾸고, 개발자와 실험 기간 및 성공 기준을 합의했습니다. 2주 단위로 실험을 반복했고, 가설이 틀렸을
            때도 원인을 기록해 다음 실험의 기준으로 삼았습니다.
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
        <div className="mt-2.5 flex flex-none items-center justify-between border-t border-line-soft px-[22px] pb-4 pt-3">
          <span className="text-[12px] text-ink-4">자소서 진단 1회 남음</span>
          <span
            className="relative inline-flex h-[42px] items-center gap-[7px] rounded-[11px] bg-brand px-[18px] text-[13.5px] font-bold text-white transition-transform duration-[120ms]"
            style={{ transform: between(DIAG_CLICK, DIAG_CLICK + 160) ? "scale(0.95)" : "scale(1)" }}
          >
            이 지원서로 진단받기
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

  const onSummary = t < SENT;
  return (
    <div className="hero-msg-in flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center justify-between px-[22px] pt-4">
        <span className="flex items-center gap-[7px] text-[13px] text-ink-4">
          <b className="font-bold text-ink">자소서 진단 리포트</b>
          <span className="hidden @xl:inline">현대자동차 서비스 기획</span>
        </span>
        <span className="text-[12px] text-ink-4">김민지님 · 문항 2개</span>
      </div>
      <div className="flex flex-none gap-[18px] overflow-hidden whitespace-nowrap border-b border-line-soft px-[22px] pt-3 text-[13px]">
        <span className={`pb-[9px] ${onSummary ? tabActive : "text-ink-4"}`}>요약</span>
        <span className={`pb-[9px] ${!onSummary ? tabActive : "text-ink-4"}`}>문장별 코멘트</span>
        <span className="pb-[9px] text-ink-4">예상 질문 5</span>
        <span className="pb-[9px] text-ink-4">공고 적합도</span>
        <span className="pb-[9px] text-ink-4">다음 단계</span>
      </div>
      {onSummary ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 px-[22px] pb-3 pt-4">
          <div className="flex flex-none flex-col gap-1.5">
            <span className="text-[12.5px] text-ink-4">채용 담당자에게 이렇게 읽혀요</span>
            <span className="text-[22px] font-bold leading-[1.35] tracking-[-0.03em] text-navy @xl:text-[24px]">
              사용자가 떠나는 지점을
              <br />
              데이터로 좁히는 기획자
            </span>
            <span className="text-[13px] leading-[1.6] text-ink-3">
              로그 3,000건과 2주 단위 실험이 무기인 자소서, 이제 그 시선이 차 안의 고객에게 닿으면 완성됩니다.
            </span>
          </div>
          <div className="grid flex-none grid-cols-2 gap-[22px]">
            <div className="flex flex-col">
              <span className="pb-2 text-[12px] font-bold text-ok">잘 읽히는 점 3</span>
              {GOOD_ITEMS.map(
                (item, index) =>
                  at(REPORT + 500 + index * 200) && (
                    <div
                      key={item}
                      className="hero-msg-in flex gap-[9px] border-t border-line-soft py-2.5 text-[13px] font-semibold leading-[1.5] text-ink"
                    >
                      <span className="mt-px inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-ok-soft">
                        <Check aria-hidden="true" className="h-2.5 w-2.5 text-ok" strokeWidth={3.4} />
                      </span>
                      {item}
                    </div>
                  )
              )}
            </div>
            <div className="flex flex-col">
              <span className="pb-2 text-[12px] font-bold text-[#9A6200]">고칠 점 3</span>
              {FIX_ITEMS.map(
                (item, index) =>
                  at(REPORT + 1300 + index * 200) && (
                    <div
                      key={item.n}
                      className="hero-msg-in relative -mx-2 flex gap-[9px] rounded-[10px] border-t border-line-soft px-2 py-2.5 transition-[background,transform] duration-150"
                      style={
                        item.n === 2
                          ? {
                              background: between(FIX_CLICK - 400, SENT) ? "#F9FAFB" : "transparent",
                              transform: between(FIX_CLICK, FIX_CLICK + 160) ? "scale(0.95)" : "scale(1)",
                            }
                          : undefined
                      }
                    >
                      <NumberDot n={item.n} />
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className="text-[13px] font-bold leading-[1.5] text-ink">{item.title}</span>
                        <span className="text-[12px] text-ink-4">{item.where}</span>
                      </div>
                      <ChevronRight aria-hidden="true" className="mt-[3px] h-3.5 w-3.5 flex-none text-[#B0B8C1]" strokeWidth={2.2} />
                      {item.n === 2 && between(FIX_CLICK - 650, SENT) && (
                        <FakeCursor left="58%" top="52%" ripple={between(FIX_CLICK, SENT)} />
                      )}
                    </div>
                  )
              )}
            </div>
          </div>
          {at(REPORT + 2100) && (
            <div className="hero-msg-in hidden flex-none grid-cols-[minmax(0,1fr)_14px_minmax(0,1fr)] items-start gap-3 rounded-[14px] bg-fill-soft px-4 py-3.5 @xl:grid">
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-bold text-ink-4">지금 읽히는 모습</span>
                <span className="text-[12.5px] leading-[1.6] text-ink-3">
                  앱을 잘 만드는 사람으로 읽히고, 차량 서비스와의 연결은 지원동기의 한 장면에 머뭅니다.
                </span>
              </div>
              <span className="mt-5 text-[13px] text-ink-5">→</span>
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-bold text-navy">면접관이 기대하는 방향</span>
                <span className="text-[12.5px] font-semibold leading-[1.6] text-ink">
                  차량과 앱 사이의 고객 여정을 데이터로 읽고 개선 순서를 정하는 기획자
                </span>
              </div>
            </div>
          )}
          {at(REPORT + 2500) && (
            <p className="hero-msg-in mt-auto hidden border-t border-line-soft pt-3 text-[12.5px] leading-[1.6] text-ink-4 @xl:block">
              탭을 넘기면 <b className="font-semibold text-ink-2">예상 면접 질문 5개</b>,{" "}
              <b className="font-semibold text-ink-2">공고 요건 4개 적합도</b>,{" "}
              <b className="font-semibold text-ink-2">고칠 순서 4단계</b>, 실무자 코멘트까지 이어져요.
            </p>
          )}
        </div>
      ) : (
        <div className="hero-msg-in grid min-h-0 flex-1 gap-[18px] px-[22px] pb-4 pt-[18px] @xl:grid-cols-[minmax(0,1fr)_236px]">
          <div className="hidden min-w-0 flex-col gap-2.5 @xl:flex">
            <span className="text-[12.5px] font-bold leading-[1.5] text-ink">
              <span className="font-semibold text-ink-5">문항 02 </span>
              {QUESTION}
            </span>
            <p className="m-0 text-[13px] leading-[1.85] text-ink-4">
              <b className="font-bold text-ink-2">[감이 아니라 로그로 찾은 이탈의 이유]</b>
              <br />
              교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영했습니다. 서비스 오픈 후 두 달이
              지나도 재방문율이 기대에 미치지 못했고, 감이 아니라 데이터로 원인을 찾아야 한다고 판단했습니다.
              <br />
              <span className="bg-[#EAF7F0] text-ink">직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다.</span>{" "}
              화면별 로그를 정리해 사용자가 어디에서 떠나는지 흐름으로 기록했습니다.{" "}
              <span className="bg-[#FFE9A3] text-ink shadow-[inset_0_-2px_0_#E0A100]">
                <InlineNumber n={2} strong />
                유저의 클릭 패턴과 체류 시간을 분석한 결과, 개인화가 부족하다는 점을 파악했습니다.
              </span>
              <br />
              가설을 세운 뒤에는 개선 항목을 두 가지로 좁혔습니다.{" "}
              <span className="bg-[#EAF7F0] text-ink">개발자와 실험 기간 및 성공 기준을 합의했습니다.</span> 2주 단위로 실험을
              반복했습니다.
              <br />
              <span className="bg-[#FFF8E1] text-ink-3">
                <InlineNumber n={3} />
                그 결과 메인 화면 이탈률을 35%에서 18%로 낮췄고, 일간 활성 사용자 수를 20% 늘렸습니다.
              </span>{" "}
              <span className="bg-[#FFF8E1] text-ink-3">
                <InlineNumber n={1} />이 경험을 통해 문제를 정의하는 기준이 명확해야 팀 전체가 같은 방향으로 움직인다는 것을
                배웠습니다.
              </span>
            </p>
            <span className="mt-auto flex gap-3.5 text-[12px] text-ink-4">
              <span className="inline-flex items-center gap-[5px]">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-[#D3F0E0]" />잘 읽히는 문장
              </span>
              <span className="inline-flex items-center gap-[5px]">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-[#FFE9A3]" />고칠 문장
              </span>
            </span>
          </div>
          <div className="flex min-h-0 flex-col gap-2.5 @xl:border-l @xl:border-line-soft @xl:pl-[18px]">
            <div className="flex flex-col gap-2.5 rounded-[14px] border border-line px-3.5 py-[13px]">
              <span className="flex items-center gap-[7px] text-[13px] font-bold text-ink">
                <NumberDot n={2} />
                개인화 부족의 판단 근거
              </span>
              {at(SENT + 600) && (
                <p className="hero-msg-in m-0 text-[12.5px] leading-[1.65] text-ink-2">
                  클릭 패턴에서 개인화 부족이라는 결론으로 가는 중간 단계가 빠져 있어요.
                </p>
              )}
              {at(SENT + 1400) && (
                <div className="hero-msg-in flex flex-col gap-1 rounded-[10px] bg-fill px-[11px] py-2.5">
                  <span className="text-[11.5px] font-bold text-navy">예상 면접 질문</span>
                  <span className="text-[13px] font-bold leading-[1.5] text-navy">
                    <span className="text-brand">Q.</span> 개인화 부족이 원인이라고 판단한 근거는 무엇입니까?
                  </span>
                </div>
              )}
              {at(SENT + 2300) && (
                <div className="hero-msg-in flex flex-col gap-[3px]">
                  <span className="text-[11.5px] font-semibold text-ink-4">이렇게 바꿔 보세요</span>
                  <span className="text-[12.5px] font-semibold leading-[1.6] text-ink">
                    추천 목록을 세 번 이상 넘긴 사용자의 이탈이 가장 높아, 추천이 취향과 맞지 않는다고 판단했습니다.
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col">
              {[FIX_ITEMS[0], FIX_ITEMS[2]].map(item => (
                <div
                  key={item.n}
                  className="flex items-center gap-2 border-t border-line-soft py-2.5 text-[12.5px] text-ink-3"
                >
                  <NumberDot n={item.n} size={16} />
                  <span className="flex-1">{item.title}</span>
                  <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 flex-none text-[#B0B8C1]" strokeWidth={2.2} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineNumber({ n, strong = false }: { n: number; strong?: boolean }) {
  return (
    <b
      className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full align-[1px] text-[10px] text-white"
      style={{ background: strong ? "#B97800" : "#D9B25C" }}
    >
      {n}
    </b>
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
  const expTyped = typed(EXP, t, EXP_START, EXP_MS);
  const interviewOn = at(BAR + 900);

  return (
    <div className="hero-scene-in flex min-h-0 flex-1 flex-col justify-center px-4 pb-6 pt-3 @xl:px-6 @xl:pb-[26px]">
      <div className="flex flex-col">
        <StepRow n={1} active lineAbove={null} lineBelow={line1} title="경험 관리" desc="흩어진 경험을 한 줄 이름으로 정리해요">
          <div className="flex flex-col gap-[7px]">
            <div className="flex flex-col gap-0.5 rounded-[12px] bg-fill-soft px-3 py-2">
              <span className="text-[12.5px] font-bold text-ink-2">{EXPERIENCE_TITLE}</span>
              <span className="text-[11px] text-ink-4">교내 앱 동아리 · 데이터분석</span>
            </div>
            <div className="hidden flex-col gap-0.5 rounded-[12px] bg-fill-soft px-3 py-2 @xl:flex">
              <span className="text-[12.5px] font-bold text-ink-2">손님 불만을 단골로 바꾼 3개월</span>
              <span className="text-[11px] text-ink-4">2024.03~05 · 고객 응대</span>
            </div>
            {t < EXP_SAVE ? (
              <div
                className="flex h-[47px] items-center rounded-[12px] px-3 text-[12.5px] font-bold text-ink-2"
                style={{
                  border: `1.5px ${t >= EXP_START ? "solid" : "dashed"} ${t >= EXP_START ? "#0064FF" : "#D1D6DB"}`,
                }}
              >
                {t < EXP_START && <span className="font-medium text-ink-5">+ 이 경험을 한 줄로 부르면</span>}
                <span>{expTyped}</span>
                {between(EXP_START, EXP_SAVE) && <span className="hero-caret" />}
              </div>
            ) : (
              <div className="hero-msg-in flex h-[47px] flex-col justify-center gap-0.5 rounded-[12px] bg-fill-soft px-3">
                <span className="text-[12.5px] font-bold text-ink-2">{EXP}</span>
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

      <div
        className="ml-[42px] mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[18px] bg-surface px-5 py-3.5 transition-opacity duration-300"
        style={{ opacity: at(BAR) ? 1 : 0.45 }}
      >
        <span className="text-[14px] font-extrabold tracking-[-0.02em] text-navy">합격까지</span>
        <span className="hidden h-[18px] w-px bg-line @xl:block" />
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
          {at(BAR + 300) ? (
            <span className="hero-msg-in inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-ok-soft text-ok">
              <Check aria-hidden="true" className="h-[11px] w-[11px]" strokeWidth={3.2} />
            </span>
          ) : (
            <span className="h-[18px] w-[18px] flex-none rounded-full border-2 border-[#D1D6DB]" />
          )}
          서류 제출
        </span>
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-ink-5" strokeWidth={2.4} />
        <span
          className="inline-flex items-center gap-1.5 text-[13px]"
          style={{ fontWeight: interviewOn ? 700 : 600, color: interviewOn ? "#004EC7" : "#6B7684" }}
        >
          <span
            className="inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-2 transition-colors duration-300"
            style={{ borderColor: interviewOn ? "#0064FF" : "#D1D6DB" }}
          >
            {interviewOn && <span className="hero-msg-in h-2 w-2 rounded-full bg-brand" />}
          </span>
          면접 준비(예상 질문)
        </span>
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-ink-5" strokeWidth={2.4} />
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-4">
          <span className="h-[18px] w-[18px] flex-none rounded-full border-2 border-[#D1D6DB]" />
          합격
        </span>
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
