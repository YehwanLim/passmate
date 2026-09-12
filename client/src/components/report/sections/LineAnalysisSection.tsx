import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Pointer, X } from "lucide-react";

import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { UI_LABELS } from "@/constants/labels";
import {
  animateScroll,
  getFirstHighlightedCardIndex,
  getNeighborCardIndex,
  resolveCoachPlacement,
  scrollChildIntoHorizontalView,
  tokenizeAnswerParagraph,
} from "@/pages/reportLineAnalysis";
import type { FeedbackCard, QuestionTab } from "@/types/report";
import { SectionNumber } from "../SectionNumber";
import { renderRichText } from "../richText";

const COACH_SEEN_KEY = "preview:report-tap-coach-seen-v2";

// 카드 본문(진단 → 예상 면접 질문 → 개선한 문장). 집중 모드·목록 모드·하단 시트가 같은 마크업을 쓴다.
function FeedbackCardBody({ card }: { card: FeedbackCard }) {
  return (
    <>
      <p className="commentary-body-text mb-4">{renderRichText(card.detailedAnalysis || (card.type === "improvement" ? card.feedback : card.praisePoint) || "")}</p>

      {card.interviewLink && (
        <>
          <p className="commentary-label">예상 면접 질문</p>
          <p className="commentary-headline mb-1.5"><span className="mr-1 font-bold text-sky-300/80">Q.</span>{renderRichText(card.interviewLink.question)}</p>
          <p className="commentary-meta mt-1 mb-4">{UI_LABELS.QUESTION_INTENT}: {renderRichText(card.interviewLink.intent)}</p>
        </>
      )}

      {card.type === "improvement" && card.suggestion && (
        <>
          <p className="commentary-label">개선한 문장</p>
          <p className="commentary-headline">{renderRichText(card.suggestion)}</p>
        </>
      )}
    </>
  );
}

type SortedCard = FeedbackCard & { _origIdx: number };

/**
 * ACT 3 — 문장 분석 작업대. 왼쪽 원문(하이라이트) + 오른쪽 코멘트(집중/목록), lg 미만은 하단 시트.
 * 탭·선택·펼침·시트·안내 말풍선 상태는 전부 이 섹션 안에서만 쓰인다.
 */
export function LineAnalysisSection({
  questionTabs,
  targetCompany,
  displayName,
  isPrinting,
}: {
  questionTabs: QuestionTab[];
  targetCompany: string;
  displayName: string;
  isPrinting: boolean;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [focusedCardIndex, setFocusedCardIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"focus" | "list">("list");

  // lg 미만(1023px 이하)은 문장 분석 2단이 1단으로 접히는 컴팩트 레이아웃. 코멘트는 하단 시트로 연다.
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  // 시트가 보여주는 카드. 이전/다음 전환 중에는 focusedCardIndex보다 150ms 늦게 따라간다.
  const [sheetCardIndex, setSheetCardIndex] = useState<number | null>(null);
  const [sheetPhase, setSheetPhase] = useState<"idle" | "leave-left" | "leave-right" | "enter-left" | "enter-right">("idle");
  const sheetStepTimerRef = useRef<number | null>(null);
  const [coachVisible, setCoachVisible] = useState(false);
  const [coachStyle, setCoachStyle] = useState<CSSProperties>({});
  const coachDismissedRef = useRef(false);
  // 실제로 화면에 띄운 적이 있는지. 띄운 적 없이 문장을 먼저 누른 경우엔 "봤음"을 저장하지 않는다.
  const coachShownRef = useRef(false);
  const coachRef = useRef<HTMLButtonElement>(null);
  const sourceBodyRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const sourceTextRef = useRef<HTMLDivElement>(null);
  const commentaryRef = useRef<HTMLDivElement>(null);
  const commentaryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsCompactLayout(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => () => {
    if (sheetStepTimerRef.current !== null) window.clearTimeout(sheetStepTimerRef.current);
  }, []);

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    setIsSheetOpen(false);
  };

  // 활성 문항 탭이 좁은 화면에서도 보이게 탭 줄만 가로 스크롤한다.
  useEffect(() => {
    const bar = tabBarRef.current;
    scrollChildIntoHorizontalView(bar, bar?.querySelector<HTMLElement>(`[data-tab-index="${activeTab}"]`) ?? null);
  }, [activeTab]);

  // 아무것도 클릭하지 않은 상태에서도 1번 문장이 디폴트로 선택되어 있게 처리
  useEffect(() => {
    const tab = questionTabs[activeTab];
    if (tab?.feedbackCards?.length > 0) {
      const firstIdx = tab.feedbackCards.map((c, i) => ({ i, pos: tab.fullAnswer.indexOf(c.original) }))
        .sort((a, b) => a.pos - b.pos)[0]?.i ?? 0;
      setFocusedCardIndex(firstIdx);
      setExpandedCards(new Set([firstIdx]));
    } else {
      setFocusedCardIndex(null);
      setExpandedCards(new Set());
    }
  }, [activeTab, questionTabs]);

  const currentTab = questionTabs[activeTab];

  // 원문 텍스트 위치 기준으로 번호 재배정 (위에서부터 1, 2, 3...)
  const cardDisplayNumbers = useMemo(() => {
    const fullText = currentTab.fullAnswer;
    const positions = currentTab.feedbackCards.map((card, idx) => ({
      idx, pos: fullText.indexOf(card.original),
    }));
    positions.sort((a, b) => a.pos - b.pos);
    const map: Record<number, number> = {};
    positions.forEach((p, rank) => { map[p.idx] = rank + 1; });
    return map;
  }, [currentTab]);

  // Sort cards by their position in the source text
  const sortedCards = useMemo<SortedCard[]>(() => {
    return [...currentTab.feedbackCards].map((c, i) => ({ ...c, _origIdx: i })).sort((a, b) => {
      const posA = currentTab.fullAnswer.indexOf(a.original);
      const posB = currentTab.fullAnswer.indexOf(b.original);
      return posA - posB;
    });
  }, [currentTab]);

  // Character count for current answer
  const charCount = useMemo(() => {
    return currentTab.fullAnswer.replace(/\n/g, "").length;
  }, [currentTab]);

  // Toggle accordion (multi-expand) and scroll source text to matching sentence
  const handleAccordionToggle = useCallback((cardIdx: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardIdx)) {
        next.delete(cardIdx);
      } else {
        next.add(cardIdx);
      }
      return next;
    });
    setFocusedCardIndex(cardIdx);
  }, []);

  const sortedOrder = useMemo(() => sortedCards.map((c) => c._origIdx), [sortedCards]);
  // 말풍선·링 대상: 실제로 하이라이트가 그려진 첫 카드. (sortedOrder[0]은 원문에서 못 찾은 카드(-1)가 올 수 있다.)
  const firstCardIndex = useMemo(
    () => getFirstHighlightedCardIndex(currentTab.feedbackCards, currentTab.fullAnswer),
    [currentTab],
  );

  // ── 첫 진입 안내 말풍선: 컴팩트 레이아웃에서 원문이 보이면 첫 하이라이트 위에. 계정당 한 번. ──
  useEffect(() => {
    if (!isCompactLayout || coachDismissedRef.current || firstCardIndex === null) return;
    try {
      if (window.localStorage.getItem(COACH_SEEN_KEY) === "1") {
        coachDismissedRef.current = true;
        return;
      }
    } catch {
      // 프라이빗 모드 등에서 저장소 접근이 막히면 그냥 한 번 보여준다.
    }
    // 긴 원문은 본문의 일정 비율이 한 화면에 들어오는 순간이 없으므로,
    // 말풍선이 붙을 첫 하이라이트 자체가 절반 이상 보일 때 띄운다.
    const firstHighlight = document.getElementById(`source-sentence-${firstCardIndex}`);
    if (!firstHighlight) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        coachShownRef.current = true;
        setCoachVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(firstHighlight);
    return () => observer.disconnect();
  }, [isCompactLayout, firstCardIndex]);

  const dismissCoach = useCallback(() => {
    if (coachDismissedRef.current) return;
    coachDismissedRef.current = true;
    setCoachVisible(false);
    // 말풍선을 보기 전에 문장을 먼저 누른 사용자는 이번 방문에서만 숨기고, 다음 방문에 한 번 보여준다.
    if (!coachShownRef.current) return;
    try {
      window.localStorage.setItem(COACH_SEEN_KEY, "1");
    } catch {
      // 저장 실패는 무시한다. 다음 방문에 한 번 더 보일 뿐이다.
    }
  }, []);

  // 말풍선은 원문 폭 안으로 밀어 넣고, 꼬리만 첫 하이라이트의 번호 배지를 가리킨다.
  useLayoutEffect(() => {
    if (!coachVisible || firstCardIndex === null) return;
    const place = () => {
      const highlight = document.getElementById(`source-sentence-${firstCardIndex}`);
      const container = sourceBodyRef.current;
      const bubble = coachRef.current;
      if (!highlight || !container || !bubble) return;
      const line = highlight.getClientRects()[0] ?? highlight.getBoundingClientRect();
      const base = container.getBoundingClientRect();
      const { left, tailX } = resolveCoachPlacement({
        badgeCenter: line.left - base.left + 12,
        containerWidth: base.width,
        bubbleWidth: bubble.offsetWidth,
      });
      setCoachStyle({ left, top: line.top - base.top - 46, ["--coach-tail-x" as string]: `${tailX}px` } as CSSProperties);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [coachVisible, firstCardIndex, activeTab]);

  // ── 하단 시트 ──
  const openSheet = useCallback((cardIdx: number) => {
    setFocusedCardIndex(cardIdx);
    setSheetCardIndex(cardIdx);
    setSheetPhase("idle");
    setIsSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => setIsSheetOpen(false), []);

  // 이전/다음: 원문 하이라이트와 배경 스크롤은 즉시 움직이고, 시트 본문은 방향에 맞춰 밀리며 교차 페이드한다.
  const stepSheet = useCallback((delta: 1 | -1) => {
    if (sheetPhase !== "idle" || focusedCardIndex === null) return;
    const next = getNeighborCardIndex(sortedOrder, focusedCardIndex, delta);
    if (next === null) return;
    setFocusedCardIndex(next);
    const sentence = document.getElementById(`source-sentence-${next}`);
    if (sentence) {
      // 시트가 아래 78vh를 덮으므로 문장을 화면 위쪽 8% 지점에 놓는다.
      const top = window.scrollY + sentence.getBoundingClientRect().top - window.innerHeight * 0.08;
      animateScroll(window, Math.max(0, top));
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSheetCardIndex(next);
      return;
    }
    setSheetPhase(delta > 0 ? "leave-left" : "leave-right");
    sheetStepTimerRef.current = window.setTimeout(() => {
      setSheetCardIndex(next);
      setSheetPhase(delta > 0 ? "enter-right" : "enter-left");
      requestAnimationFrame(() => requestAnimationFrame(() => setSheetPhase("idle")));
    }, 150);
  }, [sheetPhase, focusedCardIndex, sortedOrder]);

  // Click source highlight → expand matching accordion and scroll to it
  const handleSourceHighlightClick = useCallback((cardIdx: number) => {
    dismissCoach();
    if (isCompactLayout) {
      openSheet(cardIdx);
      return;
    }
    setFocusedCardIndex(cardIdx);
    setExpandedCards((prev) => {
      const next = new Set(prev);
      next.add(cardIdx);
      return next;
    });
    // Use setTimeout to allow the accordion to expand before scrolling.
    // 코멘트 패널 내부만 스크롤해서 페이지 전체가 딸려 내려가지 않게 한다.
    setTimeout(() => {
      const el = document.getElementById(`commentary-item-${cardIdx}`);
      if (!el) return;

      const container = commentaryScrollRef.current;
      if (container && container.scrollHeight > container.clientHeight) {
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const target = container.scrollTop
          + (elRect.top - containerRect.top)
          - (container.clientHeight - Math.min(el.clientHeight, container.clientHeight)) / 2;
        container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 50);
  }, [dismissCoach, isCompactLayout, openSheet]);

  const highlights = currentTab.feedbackCards.map((c) => c.original);
  const subtitleOriginal = currentTab.subtitleDiagnosis?.original?.trim() ?? "";

  const renderParagraph = (paragraph: string, pIdx: number): ReactNode[] =>
    tokenizeAnswerParagraph(paragraph, highlights, subtitleOriginal).map((token, tIdx) => {
      if (token.kind === "text") return token.text;
      if (token.kind === "subtitle") {
        return (
          <span key={`subtitle-hl-${pIdx}-${tIdx}`} className="subtitle-hl watching">
            {token.text}
          </span>
        );
      }
      const isActive = focusedCardIndex === token.cardIndex;
      const cardType = currentTab.feedbackCards[token.cardIndex]?.type;
      const typeClass = cardType === "praise" ? "praise-hl" : "improvement-hl";
      const displayNum = cardDisplayNumbers[token.cardIndex] ?? (token.cardIndex + 1);
      return (
        <span key={`hl-${pIdx}-${tIdx}`}
          id={`source-sentence-${token.cardIndex}`}
          onClick={(e) => {
            e.stopPropagation();
            handleSourceHighlightClick(token.cardIndex);
          }}
          className={`annotation-hl ${typeClass} ${isActive ? "active" : ""} ${coachVisible && token.cardIndex === firstCardIndex ? "coach-target" : ""}`}>
          <span className="annotation-badge">
            {displayNum}
          </span>
          {token.text}
        </span>
      );
    });

  const sheetCard = sheetCardIndex !== null ? (currentTab.feedbackCards[sheetCardIndex] as FeedbackCard | undefined) : undefined;
  const sheetRank = sheetCardIndex !== null ? sortedOrder.indexOf(sheetCardIndex) : -1;

  return (
    <section id="section-line-analysis" className="py-24 section-divider max-w-[1440px] mx-auto px-6 md:px-10 report-section-anchor"
      onClick={(e) => {
        // Click-outside: reset highlight if clicking empty area
        if ((e.target as HTMLElement).closest(".annotation-hl") || (e.target as HTMLElement).closest(".subtitle-hl") || (e.target as HTMLElement).closest(".commentary-trigger") || (e.target as HTMLElement).closest(".commentary-body") || (e.target as HTMLElement).closest(".view-mode-toggle") || (e.target as HTMLElement).closest(".report-coach")) return;
        setFocusedCardIndex(null);
        setExpandedCards(new Set());
      }}>
      <h3 className="text-xl sm:text-2xl font-semibold text-white mb-10 tracking-tight"><SectionNumber value="04" />{UI_LABELS.LINE_BY_LINE_ANALYSIS}</h3>

      {/* Split View: Source (Left) + Commentary (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-0 lg:items-start">

        {/* ═══ LEFT PANEL: Source Text ═══ */}
        <div ref={sourceTextRef} className="lg:pr-10 lg:sticky lg:top-[10vh] lg:self-start lg:max-h-[85vh] lg:overflow-y-auto hide-scrollbar">
          {/* Document Header */}
          <div className="doc-header mb-6">
            <span>{targetCompany}</span>
            <span className="separator">·</span>
            <span>{displayName}</span>
          </div>

          {/* Section Navigator Tabs */}
          <div ref={tabBarRef} className="flex items-center border-b border-white/[0.06] mb-8 overflow-x-auto hide-scrollbar -mx-1 px-1">
            {questionTabs.map((tab, index) => (
              <button key={tab.id} data-tab-index={index} onClick={() => handleTabChange(index)}
                className={`section-tab ${activeTab === index ? "active" : ""}`}>
                <span className="tab-num">{String(index + 1).padStart(2, "0")}</span>
                {tab.title}
              </button>
            ))}
          </div>

          {/* Question Prompt */}
          <div className="mb-8">
            <p className="mb-2.5 text-xs font-bold tracking-[0.02em] text-zinc-500">{UI_LABELS.QUESTION} {String(activeTab + 1).padStart(2, "0")}</p>
            <p className="border-b border-white/[0.05] pb-6 text-[15.5px] font-medium leading-[1.65] text-zinc-300">{currentTab.prompt}</p>
          </div>

          {/* 컴팩트 레이아웃 상시 안내. 말풍선이 사라진 뒤에도 남는다. */}
          <p className="mb-4 flex items-center gap-2 text-[12.5px] text-zinc-500 lg:hidden print:hidden">
            <Pointer className="h-3.5 w-3.5 shrink-0" />
            {UI_LABELS.TAP_HIGHLIGHT_GUIDE}
          </p>

          {/* Source Text Body */}
          <div ref={sourceBodyRef} className="relative">
            <div className={`source-text-body ${focusedCardIndex !== null ? "original-text-dimmed" : ""}`}>
              {currentTab.fullAnswer.split("\n").map((paragraph, pIdx) => (
                <p key={pIdx}>{renderParagraph(paragraph, pIdx)}</p>
              ))}
            </div>
            {coachVisible && isCompactLayout && (
              <button
                ref={coachRef}
                type="button"
                className="report-coach print:hidden"
                style={coachStyle}
                onClick={() => {
                  dismissCoach();
                  if (firstCardIndex !== null) openSheet(firstCardIndex);
                }}
              >
                <span className="report-coach-dot" aria-hidden="true" />
                {UI_LABELS.TAP_HIGHLIGHT_COACH}
              </button>
            )}
          </div>

          {/* Character Count */}
          <div className="mt-10 pt-6 border-t border-white/[0.04]">
            <span className="char-count">{charCount.toLocaleString()}자</span>
          </div>
        </div>

        {/* ═══ RIGHT PANEL: AI Commentary ═══ */}
        <div ref={commentaryRef} className="lg:sticky lg:top-[10vh] lg:self-start lg:h-[85vh] flex flex-col lg:border-l border-white/[0.06] lg:pl-8 mt-10 lg:mt-0">
          {/* Panel Header + View Mode Toggle */}
          <div className="flex items-center justify-between mb-6 shrink-0">
            <p className="text-[15.5px] font-semibold tracking-[-0.01em] text-zinc-50">{UI_LABELS.AI_COMMENTARY}</p>
            <div className="view-mode-toggle print:hidden">
              <button onClick={() => setViewMode("list")}
                className={`view-mode-btn ${viewMode === "list" ? "active" : ""}`}>
                {UI_LABELS.VIEW_MODE_LIST}
              </button>
              <button onClick={() => setViewMode("focus")}
                className={`view-mode-btn ${viewMode === "focus" ? "active" : ""}`}>
                {UI_LABELS.VIEW_MODE_FOCUS}
              </button>
            </div>
          </div>

          {/* Scrolling Content Area */}
          <div ref={commentaryScrollRef} className="flex-1 overflow-y-auto commentary-scroll pr-2 pb-10">

            {/* Overview — 항상 펼쳐진 고정 섹션 (여닫이가 아래 헤더 위치를 흔들지 않게) */}
            <div className="border-t border-white/[0.06] py-5">
              <div className="flex items-baseline gap-3">
                <span className="text-[11px] font-bold tabular-nums tracking-[0.08em] text-zinc-600">01</span>
                <span className="flex-1 text-[15.5px] font-semibold text-zinc-50">{UI_LABELS.OVERVIEW}</span>
              </div>
              <div className="pt-4">
                <p className="text-[14px] text-zinc-300 leading-[1.85]">{renderRichText(currentTab.overview)}</p>
              </div>
            </div>

            {/* Subtitle Diagnosis — 항상 펼쳐진 고정 섹션 */}
            <div className="border-t border-white/[0.06] py-5">
              <div className="flex items-baseline gap-3">
                <span className="text-[11px] font-bold tabular-nums tracking-[0.08em] text-zinc-600">02</span>
                <span className="flex-1 text-[15.5px] font-semibold text-zinc-50">{UI_LABELS.SUBTITLE_DIAGNOSIS}</span>
              </div>
              <div className="pt-4">
                <p className="commentary-body-text mb-1">{renderRichText(currentTab.subtitleDiagnosis.feedback)}</p>

                <p className="commentary-label">소제목 수정 제안</p>
                <p className="commentary-headline mb-0">{renderRichText(currentTab.subtitleDiagnosis.suggestion)}</p>
              </div>
            </div>

            {/* Section Header: 문장 진단 */}
            <div className="border-t border-white/[0.06] py-5">
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-[11px] font-bold tabular-nums tracking-[0.08em] text-zinc-600">03</span>
                <span className="flex-1 text-[15.5px] font-semibold text-zinc-50">{UI_LABELS.SENTENCE_DIAGNOSIS}</span>
              </div>

              {/* ── Focus Mode: Full content for focused card ── */}
              {viewMode === "focus" && !isPrinting && !isCompactLayout && (
                <div>
                  {focusedCardIndex !== null ? (() => {
                    const card = currentTab.feedbackCards[focusedCardIndex];
                    if (!card) return null;
                    const displayNum = cardDisplayNumbers[focusedCardIndex] ?? (focusedCardIndex + 1);
                    return (
                      <div className="focus-card">
                        {/* Number + Original */}
                        <div className="flex items-start gap-3 mb-5">
                          <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${card.type === "praise" ? "bg-[#4ADE80] text-[#111]" : "bg-[#FBBF24] text-[#111]"}`}>
                            {displayNum}
                          </span>
                          <p className="text-[14px] text-zinc-300 leading-[1.7] italic flex-1">"{card.original}"</p>
                        </div>

                        <FeedbackCardBody card={card} />
                      </div>
                    );
                  })() : (
                    <div className="py-12 text-center">
                      <p className="text-sm text-zinc-600 leading-relaxed">{UI_LABELS.CLICK_HIGHLIGHT_GUIDE}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── List Mode: Accordion ── */}
              {(viewMode === "list" || isPrinting || isCompactLayout) && (
                <div>
                  {sortedCards.map((card) => {
                    const realIdx = card._origIdx;
                    const isExpanded = expandedCards.has(realIdx);
                    const isFocused = focusedCardIndex === realIdx;
                    const displayNum = cardDisplayNumbers[realIdx] ?? (realIdx + 1);
                    const previewText = card.type === "improvement" ? card.feedback : card.praisePoint;

                    return (
                      <div key={realIdx}
                        id={`commentary-item-${realIdx}`}
                        className={`commentary-item ${card.type} ${isExpanded ? "expanded" : ""} ${isFocused ? "focused" : ""}`}>

                        {/* Trigger */}
                        <button className="commentary-trigger" onClick={() => handleAccordionToggle(realIdx)}>
                          <span className="commentary-num">{displayNum}</span>
                          <span className="flex-1 min-w-0">
                            <span className={`mb-1 block text-[11px] font-semibold tracking-[0.02em] ${card.type === "praise" ? "text-emerald-300/85" : "text-amber-300/75"}`}>
                              {card.type === "praise" ? UI_LABELS.FEEDBACK_TYPE_PRAISE : UI_LABELS.FEEDBACK_TYPE_IMPROVEMENT}
                            </span>
                            <span className="commentary-preview">{renderRichText(previewText ?? "")}</span>
                          </span>
                          <ChevronDown className="commentary-chevron" />
                        </button>

                        {/* Body */}
                        <div className="commentary-body">
                          <div className="commentary-body-inner">
                            <div className="pt-2 pb-5">
                              <FeedbackCardBody card={card} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div> {/* End Scrolling Content Area */}
        </div>
      </div>

      {/* 컴팩트 레이아웃: 하이라이트를 누르면 하단 시트로 코멘트를 연다.
          vaul 모달 잠금은 이전/다음 시 배경 스크롤을 막으므로 modal={false} + 자체 오버레이를 쓴다.
          시트·오버레이 클릭은 섹션의 click-outside 초기화로 번지지 않게 막는다. */}
      {isCompactLayout && (
        <>
          {isSheetOpen && (
            <div
              className="fixed inset-0 z-[60] bg-black/40 touch-none print:hidden"
              aria-hidden="true"
              onClick={(e) => { e.stopPropagation(); closeSheet(); }}
            />
          )}
          <Drawer open={isSheetOpen} onOpenChange={(open) => { if (!open) closeSheet(); }} modal={false} noBodyStyles>
            <DrawerContent
              className={`report-sheet z-[70] max-h-[78vh] border-white/[0.08] bg-[#0E0E11] text-zinc-100 ${sheetPhase !== "idle" ? "report-sheet-stepping" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <DrawerTitle className="sr-only">{UI_LABELS.AI_COMMENTARY}</DrawerTitle>
              {sheetCard && sheetCardIndex !== null && (
                <>
                  <div className={`report-sheet-head ${sheetCard.type} flex items-center gap-2.5 border-b border-white/[0.06] px-[18px] pb-3 pt-1`}>
                    <span className="commentary-num report-sheet-meta">{cardDisplayNumbers[sheetCardIndex] ?? (sheetCardIndex + 1)}</span>
                    <span className={`report-sheet-meta text-[12px] font-semibold tracking-[0.02em] ${sheetCard.type === "praise" ? "text-emerald-300/85" : "text-amber-300/75"}`}>
                      {sheetCard.type === "praise" ? UI_LABELS.FEEDBACK_TYPE_PRAISE : UI_LABELS.FEEDBACK_TYPE_IMPROVEMENT}
                    </span>
                    <span className="report-sheet-meta ml-auto text-[12px] tabular-nums text-zinc-500">{sheetRank + 1} / {sortedOrder.length}</span>
                    <button type="button" className="report-sheet-nav" aria-label="이전 문장" disabled={sheetRank <= 0} onClick={() => stepSheet(-1)}>
                      <ArrowLeft className="h-[15px] w-[15px]" />
                    </button>
                    <button type="button" className="report-sheet-nav" aria-label="다음 문장" disabled={sheetRank >= sortedOrder.length - 1} onClick={() => stepSheet(1)}>
                      <ArrowRight className="h-[15px] w-[15px]" />
                    </button>
                    <DrawerClose asChild>
                      <button type="button" className="report-sheet-nav" aria-label="닫기">
                        <X className="h-[15px] w-[15px]" />
                      </button>
                    </DrawerClose>
                  </div>
                  <div className={`report-sheet-body overflow-y-auto px-5 pb-7 pt-[18px] ${sheetPhase !== "idle" ? `report-sheet-${sheetPhase}` : ""}`}>
                    <p className="commentary-quote">“{sheetCard.original}”</p>
                    <FeedbackCardBody card={sheetCard} />
                  </div>
                </>
              )}
            </DrawerContent>
          </Drawer>
        </>
      )}
    </section>
  );
}
