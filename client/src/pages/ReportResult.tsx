import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from "react"
import { useLocation } from "wouter"
import { Check, ChevronDown, ArrowRight, ArrowLeft, Download, PenLine, PlusCircle, AlertTriangle, X } from "lucide-react"
import type { ReportData } from "../types/report"
import { UI_LABELS } from "../constants/labels"
import { isReportSectionLocked } from "../utils/reportAccess"
import FeedbackSection from "../components/FeedbackSection"
import AuthButton from "../components/AuthButton"
import { BrandName } from "@/components/BrandName"
import { ReportAccessGate } from "../components/report/ReportAccessGate"
import { useAuth } from "../contexts/AuthContext"
import { AuthenticationRequiredError, getAuthorizationHeader } from "@/lib/apiAuth"
import { REPORT_NAV_SECTIONS } from "./reportNavigation"
import {
    buildEditorialKeywords,
    normalizeDiagnosisEntries,
    resolveHiringMemoryItems,
    getHeroIdentity,
    getHeroSummary,
    limitSectionHighlights,
    parseHighlightedText,
    splitPersonaForHeroLines,
    splitMentorComment,
} from "./reportFirstImpression"

// 섹션 제목 앞의 흐린 번호. 잡지 폴리오처럼 제목과 같은 크기, 낮은 명도로 순서만 남긴다.
function SectionNumber({ value }: { value: string }) {
    return <span className="mr-3.5 font-semibold tabular-nums text-zinc-700">{value}</span>
}

const MENTOR_COMMENT_STYLES = [
    { title: "첫인상", numberClassName: "text-[#A7A8FF]" },
    { title: "보완하면 좋을 점", numberClassName: "text-[#D9B94B]" },
    { title: "면접 체크포인트", numberClassName: "text-[#69D5B1]" },
]

type HighlightTone = "strength" | "gap" | "interview"

const HIGHLIGHT_UNDERLINE_STYLES: Record<HighlightTone, CSSProperties> = {
    strength: {
        backgroundImage: "linear-gradient(to top, rgba(105, 211, 177, 0.22) 0 4px, transparent 4px)",
        backgroundPosition: "0 100%",
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 100%",
        borderRadius: "2px",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
    },
    gap: {
        backgroundImage: "linear-gradient(to top, rgba(217, 185, 75, 0.22) 0 4px, transparent 4px)",
        backgroundPosition: "0 100%",
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 100%",
        borderRadius: "2px",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
    },
    interview: {
        backgroundImage: "linear-gradient(to top, rgba(123, 184, 255, 0.2) 0 4px, transparent 4px)",
        backgroundPosition: "0 100%",
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 100%",
        borderRadius: "2px",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
    },
}

function getFallbackDisplayName(user: { name?: string | null; email?: string | null } | null) {
    const authName = user?.name?.trim()
    if (authName) return authName

    const emailName = user?.email?.split("@")[0]?.trim()
    if (emailName) return emailName

    return "지원자"
}

// =============================================================================
// MINI NAVIGATOR
// =============================================================================
function MiniNavigator({ activeSection }: { activeSection: string }) {
    return (
        <nav className="report-nav hidden xl:block" aria-label="리포트 목차">
            <div className="report-nav-list">
                {REPORT_NAV_SECTIONS.map((sec) => (
                    <a
                        key={sec.id}
                        href={`#${sec.id}`}
                        className={`report-nav-item ${activeSection === sec.id ? 'active' : ''}`}
                        aria-current={activeSection === sec.id ? 'location' : undefined}
                        onClick={(e) => {
                            e.preventDefault()
                            document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }}
                    >
                        <span className="report-nav-index">{sec.indexLabel}.</span>
                        <span>{sec.label}</span>
                    </a>
                ))}
            </div>
        </nav>
    )
}

// ReportContent가 역참조하는 최상위 필드를 렌더 전에 확인한다.
// 과거 스키마·불완전 생성 리포트가 TypeError(화이트스크린)로 이어지는 것을 막는다.
function isRenderableReport(payload: unknown): payload is ReportData {
    if (!payload || typeof payload !== "object") return false
    const report = payload as Record<string, unknown>
    const companyInsight = report.companyInsight as Record<string, unknown> | null | undefined
    return (
        Array.isArray(report.questionTabs) &&
        Array.isArray(report.actionPlan) &&
        Array.isArray(report.strengths) &&
        Array.isArray(report.gaps) &&
        !!report.firstImpression &&
        typeof report.firstImpression === "object" &&
        !!companyInsight &&
        typeof companyInsight === "object" &&
        Array.isArray(companyInsight.talentKeywords)
    )
}

function AuthenticatedReport() {
    const { user } = useAuth()
    const requestedAnalysisId = new URLSearchParams(window.location.search).get("analysisId")
    const [reportData, setReportData] = useState<ReportData | null>(null)
    const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(requestedAnalysisId)
    const [targetCompany, setTargetCompany] = useState("")
    const [isReportLoading, setIsReportLoading] = useState(true)
    const [reportError, setReportError] = useState<string | null>(null)

    useEffect(() => {
        if (!requestedAnalysisId) {
            setReportError("분석 리포트를 찾을 수 없습니다.")
            setIsReportLoading(false)
            return
        }

        let cancelled = false

        const loadPersistedReport = async () => {
            try {
                setReportData(null)
                setReportError(null)
                setIsReportLoading(true)
                const response = await fetch(`/api/analysis/${encodeURIComponent(requestedAnalysisId)}`, {
                    headers: await getAuthorizationHeader(),
                })
                const payload = await response.json()

                if (cancelled) return

                if (!response.ok) {
                    throw new Error(payload?.message || payload?.error || "분석 리포트를 불러오지 못했습니다.")
                }

                if (!isRenderableReport(payload?.ai_response_json)) {
                    throw new Error("저장된 분석 리포트 형식이 올바르지 않습니다.")
                }

                setReportData(payload.ai_response_json as ReportData)
                setActiveAnalysisId(payload.id ?? requestedAnalysisId)
                setTargetCompany(payload.company_name ?? "")
            } catch (error) {
                if (!cancelled) {
                    if (error instanceof AuthenticationRequiredError) {
                        setReportError("로그인이 만료되었어요. 다시 로그인한 뒤 리포트를 열어 주세요.")
                    } else {
                        setReportError(error instanceof Error ? error.message : "분석 리포트를 불러오지 못했습니다.")
                    }
                }
            } finally {
                if (!cancelled) setIsReportLoading(false)
            }
        }

        loadPersistedReport()

        return () => {
            cancelled = true
        }
    }, [requestedAnalysisId])

    if (isReportLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center text-sm text-zinc-400">
                분석 리포트를 불러오는 중이에요.
            </main>
        )
    }

    if (reportError || !reportData || !activeAnalysisId) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center text-sm text-red-400">
                {reportError ?? "분석 리포트를 불러오지 못했습니다."}
            </main>
        )
    }

    return (
        <ReportContent
            reportData={reportData}
            activeAnalysisId={activeAnalysisId}
            targetCompany={targetCompany}
            displayName={getFallbackDisplayName(user)}
        />
    )
}

type ReportContentProps = {
    reportData: ReportData
    activeAnalysisId: string
    targetCompany: string
    displayName: string
}

function ReportContent({
    reportData,
    activeAnalysisId,
    targetCompany,
    displayName,
}: ReportContentProps) {
    const [, navigate] = useLocation()
    const { isAuthenticated } = useAuth()

    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [activeTab, setActiveTab] = useState(0)
    const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(0)
    const [completedTasks, setCompletedTasks] = useState<number[]>([])
    const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())
    const [focusedCardIndex, setFocusedCardIndex] = useState<number | null>(null)
    const [viewMode, setViewMode] = useState<'focus' | 'list'>('list')
    const [activeSection, setActiveSection] = useState(REPORT_NAV_SECTIONS[0].id)
    const [showOverview, setShowOverview] = useState(true)
    const [showSubtitle, setShowSubtitle] = useState(true)

    const isLockedFromSection = (sectionIndex: number) =>
        isReportSectionLocked({
            sectionIndex,
            isAuthenticated,
        })

    const handleLoginToUnlock = useCallback(() => {
        navigate(`/login?redirect=${encodeURIComponent("/report-new")}`)
    }, [navigate])

    // ── Scroll Spy (IntersectionObserver) ──
    useEffect(() => {
        const observers: IntersectionObserver[] = []
        REPORT_NAV_SECTIONS.forEach((sec) => {
            const el = document.getElementById(sec.id)
            if (!el) return
            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) setActiveSection(sec.id)
                },
                { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
            )
            observer.observe(el)
            observers.push(observer)
        })
        return () => observers.forEach((o) => o.disconnect())
    }, [])

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 4000)
            return () => clearTimeout(timer)
        }
    }, [toastMessage])

    const handleTabChange = (index: number) => {
        setActiveTab(index)
        setShowOverview(true)
        setShowSubtitle(true)
    }

    // 아무것도 클릭하지 않은 상태에서도 1번 문장이 디폴트로 선택되어 있게 처리
    useEffect(() => {
        const currentTab = reportData?.questionTabs?.[activeTab]
        if (currentTab?.feedbackCards?.length > 0) {
            const firstIdx = currentTab.feedbackCards.map((c: any, i: number) => ({ i, pos: currentTab.fullAnswer.indexOf(c.original) }))
                                         .sort((a: any, b: any) => a.pos - b.pos)[0]?.i ?? 0;
            setFocusedCardIndex(firstIdx)
            setExpandedCards(new Set([firstIdx]))
        } else {
            setFocusedCardIndex(null)
            setExpandedCards(new Set())
        }
    }, [activeTab, reportData])

    const toggleTask = (index: number) => {
        setCompletedTasks(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index])
    }

    const taskProgress = Math.round((completedTasks.length / reportData.actionPlan.length) * 100)
    const currentTab = reportData.questionTabs[activeTab]
    const heroPersona = useMemo(
        () => getHeroIdentity(reportData.firstImpression.persona, reportData.firstImpression.hashtags),
        [reportData.firstImpression.hashtags, reportData.firstImpression.persona]
    )
    const heroPersonaLines = useMemo(() => splitPersonaForHeroLines(heroPersona), [heroPersona])
    const heroSummary = useMemo(
        () => getHeroSummary(reportData.firstImpression.summaryOneLiner),
        [reportData.firstImpression.summaryOneLiner]
    )
    const editorialKeywords = useMemo(
        () => buildEditorialKeywords({
            hashtags: reportData.firstImpression.hashtags,
            talentKeywords: reportData.companyInsight.talentKeywords,
        }),
        [reportData.companyInsight.talentKeywords, reportData.firstImpression.hashtags]
    )
    const hiringMemoryItems = useMemo(
        () => resolveHiringMemoryItems({
            hiringMemory: reportData.firstImpression.hiringMemory,
            strengths: reportData.strengths,
            gaps: reportData.gaps,
        }),
        [reportData.firstImpression.hiringMemory, reportData.gaps, reportData.strengths]
    )
    const strengthEntries = useMemo(
        () => normalizeDiagnosisEntries(reportData.strengths),
        [reportData.strengths]
    )
    const gapEntries = useMemo(
        () => normalizeDiagnosisEntries(reportData.gaps),
        [reportData.gaps]
    )
    const strengthHighlights = useMemo(
        () => limitSectionHighlights(strengthEntries.map((entry) => entry.text)),
        [strengthEntries]
    )
    const gapHighlights = useMemo(
        () => limitSectionHighlights(gapEntries.map((entry) => entry.text)),
        [gapEntries]
    )
    const mentorCommentBlocks = useMemo(
        () => splitMentorComment(reportData.pmComment),
        [reportData.pmComment]
    )
    const renderTextSegments = useCallback((
        segments: ReturnType<typeof parseHighlightedText>,
        tone: HighlightTone = "interview",
        emphasize = true
    ) => {
        return segments.map((segment, index) => {
            if (emphasize && segment.kind === "bold") {
                return (
                    <strong
                        key={`${segment.text}-${index}`}
                        className="rounded-[2px] font-semibold text-inherit"
                        style={HIGHLIGHT_UNDERLINE_STYLES[tone]}
                    >
                        {segment.text}
                    </strong>
                )
            }

            return <span key={`${segment.text}-${index}`}>{segment.text}</span>
        })
    }, [])
    const renderRichText = useCallback(
        (text: string, tone: HighlightTone = "interview") => renderTextSegments(parseHighlightedText(text), tone, false),
        [renderTextSegments]
    )
    const renderCleanText = useCallback((text: string) => {
        return renderTextSegments(parseHighlightedText(text), "interview", false)
    }, [renderTextSegments])

    // 원문 텍스트 위치 기준으로 번호 재배정 (위에서부터 1, 2, 3...)
    const cardDisplayNumbers = useMemo(() => {
        const fullText = currentTab.fullAnswer
        const positions = currentTab.feedbackCards.map((card: any, idx: number) => ({
            idx, pos: fullText.indexOf(card.original)
        }))
        positions.sort((a: any, b: any) => a.pos - b.pos)
        const map: Record<number, number> = {}
        positions.forEach((p: any, rank: number) => { map[p.idx] = rank + 1 })
        return map
    }, [currentTab])

    // Sort cards by their position in the source text
    const sortedCards = useMemo(() => {
        return [...currentTab.feedbackCards].map((c: any, i: number) => ({ ...c, _origIdx: i })).sort((a: any, b: any) => {
            const posA = currentTab.fullAnswer.indexOf(a.original)
            const posB = currentTab.fullAnswer.indexOf(b.original)
            return posA - posB
        })
    }, [currentTab])

    // Character count for current answer
    const charCount = useMemo(() => {
        return currentTab.fullAnswer.replace(/\n/g, '').length
    }, [currentTab])

    const sourceTextRef = useRef<HTMLDivElement>(null)
    const commentaryRef = useRef<HTMLDivElement>(null)

    // Toggle accordion (multi-expand) and scroll source text to matching sentence
    const handleAccordionToggle = useCallback((cardIdx: number) => {
        setExpandedCards(prev => {
            const next = new Set(prev)
            if (next.has(cardIdx)) {
                next.delete(cardIdx)
            } else {
                next.add(cardIdx)
            }
            return next
        })
        setFocusedCardIndex(cardIdx)
    }, [])

    // Click source highlight → expand matching accordion and scroll to it
    const handleSourceHighlightClick = useCallback((cardIdx: number) => {
        setFocusedCardIndex(cardIdx)
        setExpandedCards(prev => {
            const next = new Set(prev)
            next.add(cardIdx)
            return next
        })
        // Use setTimeout to allow the accordion to expand before scrolling
        setTimeout(() => {
            const el = document.getElementById(`commentary-item-${cardIdx}`)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }, 50)
    }, [])

    return (
        <main className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-indigo-500/20">
            <MiniNavigator activeSection={activeSection} />

            {/* TOP NAV (Global Sticky) */}
            <div className="sticky top-0 z-50 w-full bg-[#09090B]/95 backdrop-blur-md border-b border-white/[0.05]">
                <div className="max-w-4xl mx-auto px-6 md:px-8 pt-6 pb-4 flex items-center justify-between">
                    <button onClick={() => window.history.back()} className="inline-flex items-center gap-2.5 text-sm text-zinc-500 hover:text-white transition-colors group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span>{UI_LABELS.BACK}</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            className="text-[13px] text-gray-300 hover:text-white hover:bg-white/10 font-medium h-8 px-3 rounded-md transition-colors duration-200"
                            onClick={() => navigate("/my")}
                        >
                            내 지원서
                        </button>
                        <AuthButton />
                    </div>
                </div>
            </div>

            <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10 pt-4">

                {/* ================================================================= */}
                {/* ACT 1: FIRST IMPRESSION */}
                {/* ================================================================= */}
                <header id="section-first-impression" className="pt-8 pb-[6.5rem] section-divider">
                    <div className="relative min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0B0B0E] px-5 py-5 sm:px-8 sm:py-7 md:px-10 md:py-9">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.09),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_48%)]" />
                        <div className="pointer-events-none absolute inset-px rounded-[15px] border border-white/[0.035]" />

                        <div className="relative flex min-w-0 flex-col gap-2 border-b border-white/[0.06] pb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                            <BrandName className="h-3.5" />
                            <span className="min-w-0 break-words sm:text-right">First Read · {targetCompany}</span>
                        </div>

                        <div className="relative min-w-0 py-12 text-center sm:py-14 md:py-[4.25rem]">
                            <p className="mb-5 text-[15px] sm:text-base text-zinc-300">{displayName}님은</p>
                            <h1 className="mx-auto max-w-3xl text-[2.08rem] sm:text-[3.15rem] md:text-[4.05rem] font-semibold leading-[1.04] tracking-tight text-white">
                                {heroPersonaLines.map((line) => (
                                    <span key={line} className="block">
                                        {line}
                                    </span>
                                ))}
                            </h1>
                            <p className="mx-auto mt-6 max-w-2xl text-[16px] sm:text-[19px] leading-[1.8] text-zinc-300 text-balance">
                                {renderCleanText(heroSummary)}
                            </p>
                        </div>

                        <div className="relative flex min-w-0 flex-wrap justify-center gap-2.5 pb-8">
                            {editorialKeywords.map((keyword) => (
                                <span key={keyword} className="max-w-full rounded-full border border-white/[0.12] bg-white/[0.045] px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-colors duration-200 hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-zinc-100">
                                    {keyword}
                                </span>
                            ))}
                        </div>

                        <div className="relative grid items-start gap-5 md:grid-cols-2">
                            <div className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-5">
                                <p className="mb-3 text-sm font-semibold text-white">채용담당자가 기억할 모습</p>
                                <ul className="space-y-3">
                                    {hiringMemoryItems.map((item) => (
                                        <li key={`${item.mark}-${item.text}`} className="grid grid-cols-[22px_1fr] gap-2.5 text-sm leading-[1.68] text-zinc-300">
                                            <span className={`mt-0.5 inline-flex size-[18px] items-center justify-center rounded-full border ${item.mark === "✓" ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-400/10 text-amber-200"}`}>
                                                {item.mark === "✓" ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}
                                            </span>
                                            <span className="pt-px">{item.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-5">
                                <p className="mb-3 text-sm font-semibold text-white">{UI_LABELS.APPLICANT_PROFILE}</p>
                                <p className="text-sm leading-[1.82] text-zinc-400">
                                    {reportData.firstImpression.profileNote?.trim()
                                        ? renderCleanText(reportData.firstImpression.profileNote)
                                        : `${heroPersona}라는 인상이 먼저 남습니다. 경험의 흐름은 문제를 발견하고 근거를 모아 실행으로 옮기는 방향으로 읽힙니다.`}
                                </p>
                            </div>

                            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 md:col-span-2">
                                <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">현직자 코멘트</p>
                                <div className="grid gap-5 md:grid-cols-3">
                                    {mentorCommentBlocks.map((block, index) => {
                                        const style = MENTOR_COMMENT_STYLES[index]
                                        if (!style) return null

                                        return (
                                            <blockquote key={block.title} className="min-w-0">
                                                <div className="mb-4 flex items-center gap-3">
                                                    <span className={`text-[32px] font-extrabold leading-none tracking-[0.08em] opacity-60 ${style.numberClassName}`}>{String(index + 1).padStart(2, "0")}</span>
                                                    <p className="text-[15px] font-bold text-zinc-100">
                                                        {style.title}
                                                    </p>
                                                </div>
                                                <p className="text-sm leading-[1.82] text-zinc-300">{renderCleanText(block.text)}</p>
                                            </blockquote>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* ================================================================= */}
                {/* ACT 1.5: COMPANY INSIGHT */}
                {/* ================================================================= */}
                <section id="section-company-insight" className="py-24 section-divider">
                    <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-6 tracking-tight"><SectionNumber value="02" />{UI_LABELS.HIRING_CRITERIA(targetCompany)}</h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-[1.75]">{renderRichText(reportData.companyInsight.summary)}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Talent Keywords */}
                        <div className="py-2">
                            <p className="text-sm text-zinc-400 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.TALENT_PROFILE}</p>
                            <div className="flex flex-wrap gap-2.5">
                                {reportData.companyInsight.talentKeywords.map((kw) => (
                                    <span key={kw} className="px-4 py-2 text-sm text-zinc-200 bg-white/[0.04] border border-white/[0.05] rounded-lg font-medium">{kw}</span>
                                ))}
                            </div>
                        </div>

                        {/* Hiring Signals */}
                        <div className="py-2">
                            <p className="text-sm text-emerald-400/70 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.ACCEPTANCE_CRITERIA}</p>
                            <ul className="space-y-3">
                                {reportData.companyInsight.hiringSignals.map((s, i) => (
                                    <li key={i} className="text-[15px] text-zinc-200 leading-[1.7] flex items-start gap-2.5">
                                        <Check className="w-4 h-4 text-emerald-400/50 mt-0.5 shrink-0" />{renderRichText(s)}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Rejection Triggers */}
                        <div className="py-2">
                            <p className="text-sm text-rose-400/60 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.REJECTION_TRIGGERS}</p>
                            <ul className="space-y-3">
                                {reportData.companyInsight.rejectionTriggers.map((r, i) => (
                                    <li key={i} className="text-[15px] text-zinc-400 leading-[1.7] flex items-start gap-2.5">
                                        <X className="w-4 h-4 text-rose-400/35 mt-0.5 shrink-0" />{renderRichText(r)}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Culture Signals */}
                        <div className="py-2">
                            <p className="text-sm text-zinc-400 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.CULTURE_SIGNALS}</p>
                            <ul className="space-y-3">
                                {reportData.companyInsight.cultureSignals.map((c, i) => (
                                    <li key={i} className="text-[15px] text-zinc-400 leading-[1.7] flex items-start gap-2.5">
                                        <div className="w-[5px] h-[5px] rounded-full bg-zinc-600 mt-[9px] shrink-0"></div>{renderRichText(c)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* ================================================================= */}
                {/* ACT 2: CORE DIAGNOSIS */}
                {/* ================================================================= */}
                <ReportAccessGate
                    isLocked={isLockedFromSection(2)}
                    onLogin={handleLoginToUnlock}
                >
                    <section id="section-core-diagnosis" className="py-24 section-divider">
                        <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-14 tracking-tight"><SectionNumber value="03" />{UI_LABELS.STRENGTHS_AND_GAPS(targetCompany)}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-14 mb-16">
                        <div>
                            <p className="text-[15px] font-bold text-emerald-300/90 mb-6">{UI_LABELS.STRENGTHS}</p>
                            <div>
                                {strengthEntries.map((entry, i) => (
                                    <div key={i} className={i > 0 ? "mt-7 border-t border-white/[0.05] pt-7" : ""}>
                                        {entry.headline ? (
                                            <>
                                                <p className="mb-2.5 flex items-center gap-2.5 text-[17px] font-semibold leading-[1.45] tracking-[-0.01em] text-zinc-50">
                                                    <span aria-hidden="true" className="mx-[3px] inline-block size-[7px] shrink-0 rounded-full bg-emerald-400/85 shadow-[0_0_8px_rgba(52,211,153,0.35)]" />
                                                    {entry.headline}
                                                </p>
                                                <p className="pl-[23px] text-[15px] leading-[1.85] text-zinc-400">{renderTextSegments(strengthHighlights[i], "strength")}</p>
                                            </>
                                        ) : (
                                            <p className="text-[16px] leading-[1.8] text-zinc-100">{renderTextSegments(strengthHighlights[i], "strength")}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-[15px] font-bold text-amber-300/80 mb-6">{UI_LABELS.GAPS}</p>
                            <div>
                                {gapEntries.map((entry, i) => (
                                    <div key={i} className={i > 0 ? "mt-7 border-t border-white/[0.05] pt-7" : ""}>
                                        {entry.headline ? (
                                            <>
                                                <p className="mb-2.5 flex items-baseline gap-2.5 text-[17px] font-semibold leading-[1.45] tracking-[-0.01em] text-zinc-50">
                                                    <span aria-hidden="true" className="w-[13px] shrink-0 text-[13px] text-amber-300/70">△</span>
                                                    {entry.headline}
                                                </p>
                                                <p className="pl-[23px] text-[15px] leading-[1.85] text-zinc-400">{renderTextSegments(gapHighlights[i], "gap")}</p>
                                            </>
                                        ) : (
                                            <p className="text-[16px] leading-[1.8] text-zinc-300">{renderTextSegments(gapHighlights[i], "gap")}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Positioning */}
                    <div className="bg-white/[0.03] border border-white/[0.05] p-6 sm:p-9 rounded-xl">
                        <p className="text-[17px] font-semibold tracking-[-0.01em] text-zinc-50 mb-8">{UI_LABELS.STRATEGIC_POSITIONING}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_40px_1fr] gap-5 items-stretch mb-9">
                            <div>
                                <span className="inline-block rounded-md border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold tracking-[0.02em] text-zinc-400 mb-3.5">{UI_LABELS.POSITION_CURRENT}</span>
                                <p className="text-[15px] text-zinc-400 leading-[1.8]">{renderRichText(reportData.positioning.current)}</p>
                            </div>
                            <div aria-hidden="true" className="flex items-center justify-center text-xl text-zinc-700 rotate-90 sm:rotate-0 -my-1 sm:my-0">→</div>
                            <div>
                                <span className="inline-block rounded-md border border-sky-300/20 bg-sky-300/[0.08] px-3 py-1.5 text-xs font-semibold tracking-[0.02em] text-sky-300 mb-3.5">{UI_LABELS.POSITION_TARGET}</span>
                                <p className="text-[15px] text-zinc-100 leading-[1.8]">{renderRichText(reportData.positioning.target)}</p>
                            </div>
                        </div>
                        <div className="border-t border-white/[0.05] pt-7 mb-7">
                            <p className="text-sm font-semibold text-amber-300/80 mb-2.5">{UI_LABELS.POSITION_GAP}</p>
                            <p className="text-[15px] text-zinc-200 leading-[1.8] max-w-2xl">{renderRichText(reportData.positioning.gap)}</p>
                        </div>
                        <div className="border-t border-white/[0.05] pt-7">
                            <p className="text-sm font-semibold text-emerald-300/85 mb-2.5">{UI_LABELS.POSITION_STRATEGY}</p>
                            <p className="text-[15px] text-zinc-200 leading-[1.8] max-w-2xl">{renderRichText(reportData.positioning.strategy)}</p>
                        </div>
                    </div>
                    </section>
                </ReportAccessGate>
            </article>

            {/* ================================================================= */}
            {/* ACT 3: LINE-BY-LINE ANALYSIS — Editorial Review Workspace */}
            {/* ================================================================= */}
            <ReportAccessGate
                isLocked={isLockedFromSection(3)}
                onLogin={handleLoginToUnlock}
                showOverlay={false}
            >
            <section id="section-line-analysis" className="py-24 section-divider max-w-[1440px] mx-auto px-6 md:px-10"
                onClick={(e) => {
                    // Click-outside: reset highlight if clicking empty area
                    if ((e.target as HTMLElement).closest('.annotation-hl') || (e.target as HTMLElement).closest('.commentary-trigger') || (e.target as HTMLElement).closest('.commentary-body') || (e.target as HTMLElement).closest('.view-mode-toggle')) return
                    setFocusedCardIndex(null)
                    setExpandedCards(new Set())
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
                        <div className="flex items-center border-b border-white/[0.06] mb-8">
                            {reportData.questionTabs.map((tab, index) => (
                                <button key={tab.id} onClick={() => handleTabChange(index)}
                                    className={`section-tab ${activeTab === index ? 'active' : ''}`}>
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

                        {/* Source Text Body */}
                        <div className={`source-text-body ${focusedCardIndex !== null ? 'original-text-dimmed' : ''}`}>
                            {currentTab.fullAnswer.split('\n').map((paragraph: string, pIdx: number) => (
                                <p key={pIdx}>
                                    {(() => {
                                        const highlights = currentTab.feedbackCards.map((c: any) => c.original)
                                        let result: React.ReactNode[] = []
                                        let remaining = paragraph
                                        let keyCounter = 0
                                        while (remaining.length > 0) {
                                            let earliestIdx = remaining.length
                                            let matchedHighlight = ''
                                            let matchedCardIdx = -1
                                            highlights.forEach((h: string, hIdx: number) => {
                                                const pos = remaining.indexOf(h)
                                                if (pos !== -1 && pos < earliestIdx) {
                                                    earliestIdx = pos
                                                    matchedHighlight = h
                                                    matchedCardIdx = hIdx
                                                }
                                            })
                                            if (matchedHighlight) {
                                                if (earliestIdx > 0) result.push(remaining.slice(0, earliestIdx))
                                                const isActive = focusedCardIndex === matchedCardIdx
                                                const cardType = currentTab.feedbackCards[matchedCardIdx]?.type
                                                const typeClass = cardType === 'praise' ? 'praise-hl' : 'improvement-hl'
                                                const displayNum = cardDisplayNumbers[matchedCardIdx] ?? (matchedCardIdx + 1)
                                                result.push(
                                                    <span key={`hl-${pIdx}-${keyCounter++}`}
                                                        id={`source-sentence-${matchedCardIdx}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleSourceHighlightClick(matchedCardIdx)
                                                        }}
                                                        className={`annotation-hl ${typeClass} ${isActive ? 'active' : ''}`}>
                                                        <span className="annotation-badge">
                                                            {displayNum}
                                                        </span>
                                                        {matchedHighlight}
                                                    </span>
                                                )
                                                remaining = remaining.slice(earliestIdx + matchedHighlight.length)
                                            } else {
                                                result.push(remaining)
                                                remaining = ''
                                            }
                                        }
                                        return result
                                    })()}
                                </p>
                            ))}
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
                            <div className="view-mode-toggle">
                                <button onClick={() => setViewMode('list')}
                                    className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}>
                                    {UI_LABELS.VIEW_MODE_LIST}
                                </button>
                                <button onClick={() => setViewMode('focus')}
                                    className={`view-mode-btn ${viewMode === 'focus' ? 'active' : ''}`}>
                                    {UI_LABELS.VIEW_MODE_FOCUS}
                                </button>
                            </div>
                        </div>

                        {/* Scrolling Content Area */}
                        <div className="flex-1 overflow-y-auto commentary-scroll pr-2 pb-10">

                        {/* Overview — Collapsible */}
                        <div className="border-t border-white/[0.06] py-5">
                            <button onClick={() => setShowOverview(!showOverview)}
                                className="w-full flex items-baseline gap-3 text-left">
                                <span className="text-[11px] font-bold tabular-nums tracking-[0.08em] text-zinc-600">01</span>
                                <span className="flex-1 text-[15.5px] font-semibold text-zinc-50">{UI_LABELS.OVERVIEW}</span>
                                <ChevronDown className={`w-4 h-4 self-center text-zinc-600 transition-transform ${showOverview ? 'rotate-180' : ''}`} />
                            </button>
                            {showOverview && (
                                <div className="pt-4">
                                    <p className="text-[14px] text-zinc-300 leading-[1.85]">{renderRichText(currentTab.overview)}</p>
                                </div>
                            )}
                        </div>

                        {/* Subtitle Diagnosis — Collapsible */}
                        <div className="border-t border-white/[0.06] py-5">
                            <button onClick={() => setShowSubtitle(!showSubtitle)}
                                className="w-full flex items-baseline gap-3 text-left">
                                <span className="text-[11px] font-bold tabular-nums tracking-[0.08em] text-zinc-600">02</span>
                                <span className="flex-1 text-[15.5px] font-semibold text-zinc-50">{UI_LABELS.SUBTITLE_DIAGNOSIS}</span>
                                <ChevronDown className={`w-4 h-4 self-center text-zinc-600 transition-transform ${showSubtitle ? 'rotate-180' : ''}`} />
                            </button>
                            {showSubtitle && (
                                <div className="pt-4">
                                    <p className="commentary-body-text mb-1">{renderRichText(currentTab.subtitleDiagnosis.feedback)}</p>

                                    <p className="commentary-label">소제목 수정 제안</p>
                                    <p className="commentary-headline mb-0">{renderRichText(currentTab.subtitleDiagnosis.suggestion)}</p>
                                </div>
                            )}
                        </div>

                        {/* Section Header: 문장 진단 */}
                        <div className="border-t border-white/[0.06] py-5">
                            <div className="flex items-baseline gap-3 mb-4">
                                <span className="text-[11px] font-bold tabular-nums tracking-[0.08em] text-zinc-600">03</span>
                                <span className="flex-1 text-[15.5px] font-semibold text-zinc-50">{UI_LABELS.SENTENCE_DIAGNOSIS}</span>
                            </div>

                        {/* ── Focus Mode: Full content for focused card ── */}
                        {viewMode === 'focus' && (
                            <div>
                                {focusedCardIndex !== null ? (() => {
                                    const card = currentTab.feedbackCards[focusedCardIndex] as any
                                    if (!card) return null
                                    const displayNum = cardDisplayNumbers[focusedCardIndex] ?? (focusedCardIndex + 1)
                                    return (
                                        <div className="focus-card">
                                            {/* Number + Original */}
                                            <div className="flex items-start gap-3 mb-5">
                                                <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${card.type === 'praise' ? 'bg-[#4ADE80] text-[#111]' : 'bg-[#FBBF24] text-[#111]'}`}>
                                                    {displayNum}
                                                </span>
                                                <p className="text-[14px] text-zinc-300 leading-[1.7] italic flex-1">"{card.original}"</p>
                                            </div>

                                            {/* Detailed Analysis */}
                                            <p className="commentary-body-text mb-4">{renderRichText(card.detailedAnalysis || (card.type === 'improvement' ? card.feedback : card.praisePoint))}</p>

                                            {/* Interview perspective */}
                                            {card.interviewLink && (
                                                <>
                                                    <p className="commentary-label">예상 면접 질문</p>
                                                    <p className="commentary-headline mb-1.5"><span className="mr-1 font-bold text-sky-300/80">Q.</span>{renderRichText(card.interviewLink.question)}</p>
                                                    <p className="commentary-meta mb-4">{UI_LABELS.QUESTION_INTENT}: {renderRichText(card.interviewLink.intent)}</p>
                                                </>
                                            )}

                                            {/* Improvement suggestion */}
                                            {card.type === 'improvement' && card.suggestion && (
                                                <>
                                                    <p className="commentary-label">개선한 문장</p>
                                                    <p className="commentary-headline">{renderRichText(card.suggestion)}</p>
                                                </>
                                            )}
                                        </div>
                                    )
                                })() : (
                                    <div className="py-12 text-center">
                                        <p className="text-sm text-zinc-600 leading-relaxed">{UI_LABELS.CLICK_HIGHLIGHT_GUIDE}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── List Mode: Accordion ── */}
                        {viewMode === 'list' && (
                            <div>
                                {sortedCards.map((card: any) => {
                                    const realIdx = card._origIdx
                                    const isExpanded = expandedCards.has(realIdx)
                                    const isFocused = focusedCardIndex === realIdx
                                    const displayNum = cardDisplayNumbers[realIdx] ?? (realIdx + 1)
                                    const previewText = card.type === 'improvement' ? card.feedback : card.praisePoint

                                    return (
                                        <div key={realIdx}
                                            id={`commentary-item-${realIdx}`}
                                            className={`commentary-item ${card.type} ${isExpanded ? 'expanded' : ''} ${isFocused ? 'focused' : ''}`}>

                                            {/* Trigger */}
                                            <button className="commentary-trigger" onClick={() => handleAccordionToggle(realIdx)}>
                                                <span className="commentary-num">{displayNum}</span>
                                                <span className="flex-1 min-w-0">
                                                    <span className={`mb-1 block text-[11px] font-semibold tracking-[0.02em] ${card.type === 'praise' ? 'text-emerald-300/85' : 'text-amber-300/75'}`}>
                                                        {card.type === 'praise' ? UI_LABELS.FEEDBACK_TYPE_PRAISE : UI_LABELS.FEEDBACK_TYPE_IMPROVEMENT}
                                                    </span>
                                                    <span className="commentary-preview">{renderRichText(previewText)}</span>
                                                </span>
                                                <ChevronDown className="commentary-chevron" />
                                            </button>

                                            {/* Body */}
                                            <div className="commentary-body pt-2">
                                                {/* Detailed Analysis */}
                                                <p className="commentary-body-text mb-4">{renderRichText(card.detailedAnalysis || (card.type === 'improvement' ? card.feedback : card.praisePoint))}</p>

                                                {/* Interview perspective */}
                                                {card.interviewLink && (
                                                    <>
                                                        <p className="commentary-label">예상 면접 질문</p>
                                                        <p className="commentary-headline mb-1.5"><span className="mr-1 font-bold text-sky-300/80">Q.</span>{renderRichText(card.interviewLink.question)}</p>
                                                        <p className="commentary-meta mt-1">{UI_LABELS.QUESTION_INTENT}: {renderRichText(card.interviewLink.intent)}</p>
                                                    </>
                                                )}

                                                {/* Improvement suggestion */}
                                                {card.type === 'improvement' && card.suggestion && (
                                                    <>
                                                        <p className="commentary-label">개선한 문장</p>
                                                        <p className="commentary-headline">{renderRichText(card.suggestion)}</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        </div>

                        </div> {/* End Scrolling Content Area */}
                    </div>
                </div>
            </section>
            </ReportAccessGate>

            <ReportAccessGate
                isLocked={isLockedFromSection(4)}
                onLogin={handleLoginToUnlock}
                showOverlay={false}
            >
            <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10">

                {/* ================================================================= */}
                {/* ACT 4: INTERVIEW DRILL */}
                {/* ================================================================= */}
                <section id="section-interview-drill" className="pt-24 pb-24 section-divider">
                    <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-6 tracking-tight"><SectionNumber value="05" />{UI_LABELS.INTERVIEW_DRILL_TITLE}</h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-[1.7]">{UI_LABELS.INTERVIEW_DRILL_DESC}</p>

                    <div className="space-y-0">
                        {reportData.interviewQA.map((item, index) => (
                            <div key={index} className="border-b border-white/[0.04] last:border-0">
                                <button onClick={() => setOpenQuestionIndex(openQuestionIndex === index ? null : index)}
                                    className="w-full py-6 flex items-start gap-5 text-left group">
                                    <span className="text-xs uppercase tracking-[0.12em] text-zinc-500 mt-1 min-w-[50px] font-medium">Q{index + 1}</span>
                                    <span className="flex-1 text-[17px] text-zinc-300 group-hover:text-white transition-colors leading-[1.6]">{renderRichText(item.question)}</span>
                                    <ChevronDown className={`w-5 h-5 text-zinc-600 transition-transform mt-0.5 ${openQuestionIndex === index ? "rotate-180" : ""}`} />
                                </button>
                                {openQuestionIndex === index && (
                                    <div className="pb-8 pl-[70px] space-y-4">
                                        {item.followUps && item.followUps.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-xs uppercase tracking-[0.12em] text-amber-300/50 mb-3 font-medium">{UI_LABELS.FOLLOW_UP_QUESTIONS}</p>
                                                <ul className="space-y-2">
                                                    {item.followUps.map((fu, fi) => (
                                                        <li key={fi} className="text-[15px] text-zinc-500 leading-[1.7] flex items-start gap-2.5">
                                                            <ArrowRight className="w-3 h-3 text-amber-300/35 mt-1.5 shrink-0" />{renderRichText(fu)}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 mb-3 font-medium">{UI_LABELS.MODEL_ANSWER}</p>
                                        <p className="text-[15px] text-zinc-400 leading-[1.8]">{renderRichText(item.modelAnswer)}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* ================================================================= */}
                {/* ACT 5: ACTION PLAN */}
                {/* ================================================================= */}
                <section id="section-action-plan" className="py-24 section-divider">
                    <h3 className="text-xl sm:text-2xl font-semibold text-white mb-6 tracking-tight"><SectionNumber value="06" />{UI_LABELS.ACTION_PLAN_TITLE}</h3>

                    <div className="flex items-center gap-5 mb-14 mt-10">
                        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500/70 transition-all duration-500" style={{ width: `${taskProgress}%` }} />
                        </div>
                        <span className="text-sm text-zinc-500 tabular-nums">{completedTasks.length}/{reportData.actionPlan.length}</span>
                    </div>

                    <div className="space-y-0">
                        {reportData.actionPlan.map((task, index) => {
                            const isComplete = completedTasks.includes(index)
                            return (
                                <button key={index} onClick={() => toggleTask(index)} className="w-full text-left py-5 flex items-start gap-5 group border-b border-white/[0.03] last:border-0">
                                    <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors mt-0.5 ${isComplete ? "bg-indigo-500 border-indigo-500" : "border-zinc-700 group-hover:border-zinc-500"}`}>
                                        {isComplete && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className={`text-base transition-colors leading-[1.6] block mb-1.5 ${isComplete ? "line-through text-zinc-600" : "text-zinc-200 group-hover:text-white"}`}>{renderRichText(task.title)}</span>
                                        <p className={`text-[15px] transition-colors leading-[1.7] ${isComplete ? "text-zinc-700" : "text-zinc-500"}`}>{renderRichText(task.description)}</p>
                                        <p className={`text-sm mt-2.5 transition-colors ${isComplete ? "text-zinc-700" : "text-zinc-500"}`}>{UI_LABELS.EXPECTED_IMPACT}: {renderRichText(task.expectedImpact)}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </section>

                {/* ================================================================= */}
                {/* ACT 6: PM COMMENT */}
                {/* ================================================================= */}
                <section id="section-pm-comment" className="pt-24 pb-20 section-divider">
                    <h3 className="text-xl sm:text-2xl font-medium text-white mb-10 tracking-tight"><SectionNumber value="07" />{UI_LABELS.PM_VERDICT_TITLE}</h3>
                    <div className="mentor-comment-thread relative">
                        {mentorCommentBlocks.map((block, index) => (
                            <article
                                key={block.title}
                                className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 pb-8 last:pb-0 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:gap-5"
                            >
                                {index < mentorCommentBlocks.length - 1 && (
                                    <span aria-hidden="true" className="absolute left-5 top-12 bottom-0 w-px bg-white/[0.06] sm:left-[22px]" />
                                )}
                                <div className="relative z-10 flex size-10 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/10 sm:size-11">
                                    <span className="text-xs font-bold tracking-tight text-indigo-400">H</span>
                                </div>
                                <div className="min-w-0 pt-0.5">
                                    <div className="mb-3 flex items-center gap-3">
                                        <span className="text-sm font-medium text-white">Mentor Hansi</span>
                                        <span className="text-xs text-zinc-600">{UI_LABELS.JUST_NOW}</span>
                                    </div>
                                    <h4 className="mb-3 text-[18px] font-semibold tracking-tight text-zinc-100">{block.title}</h4>
                                    <p className="text-[17px] font-normal leading-[1.8] text-zinc-200">{renderCleanText(block.text)}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                {/* ================================================================= */}
                {/* FEEDBACK SECTION */}
                {/* ================================================================= */}
                <FeedbackSection analysisId={activeAnalysisId} />

                {/* NEXT STEP */}
                <section className="py-16 mt-10 bg-white/[0.02] rounded-xl border border-white/[0.04] px-6 md:px-10 text-center">
                    <h3 className="text-xl font-medium text-white mb-8">{UI_LABELS.WHATS_NEXT}</h3>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button onClick={() => navigate("/analyze")} className="w-full sm:w-auto px-6 py-3.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
                            <PenLine className="w-4 h-4" /><span>{UI_LABELS.EDIT_RESUME}</span>
                        </button>
                        <button onClick={() => navigate("/")} className="w-full sm:w-auto px-6 py-3.5 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
                            <PlusCircle className="w-4 h-4" /><span>{UI_LABELS.ANALYZE_NEW}</span>
                        </button>
                        <button className="w-full sm:w-auto px-6 py-3.5 bg-transparent border border-white/10 text-zinc-300 font-medium rounded-lg hover:bg-white/[0.02] transition-colors flex items-center justify-center gap-2">
                            <Download className="w-4 h-4" /><span>{UI_LABELS.SAVE_REPORT}</span>
                        </button>
                    </div>
                </section>

                {/* FOOTER */}
                <footer className="pt-20 pb-8 mt-10">
                    <p className="text-xs text-zinc-600 leading-relaxed mb-6 text-center">{UI_LABELS.FOOTER_DISCLAIMER}</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-zinc-600">
                        <p>Pre:View 2026. All rights reserved.</p>
                        <span className="hidden sm:inline">-</span>
                        <p>Report ID: RPT-2026-0430-{Math.random().toString(36).slice(2, 6).toUpperCase()}</p>
                    </div>
                </footer>
            </article>
            </ReportAccessGate>


            {/* Toast */}
            {toastMessage && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-fade-in">
                    <div className={`px-5 py-3 rounded-xl border shadow-2xl shadow-black/40 backdrop-blur-xl text-sm font-medium max-w-md ${toastMessage.type === 'success' ? 'bg-zinc-900/95 border-green-500/30 text-green-400' : 'bg-zinc-900/95 border-red-500/30 text-red-400'}`}>
                        {toastMessage.text}
                    </div>
                </div>
            )}
        </main>
    )
}

export default function PassMateReport() {
    const { isAuthenticated, isLoading: authLoading } = useAuth()

    if (authLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center text-sm text-zinc-400">
                로그인 정보를 확인하는 중이에요.
            </main>
        )
    }

    if (!isAuthenticated) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center">
                <section className="max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8">
                    <h1 className="text-lg font-semibold text-white">로그인이 필요해요</h1>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                        로그인 후 분석 리포트를 확인할 수 있어요.
                    </p>
                    <a
                        href={`/login?redirect=${encodeURIComponent("/report-new")}`}
                        className="mt-6 inline-flex rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-900"
                    >
                        로그인하기
                    </a>
                </section>
            </main>
        )
    }

    return <AuthenticatedReport />
}

