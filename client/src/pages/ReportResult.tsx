import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useLocation } from "wouter"
import { Check, ChevronDown, ArrowRight, FileText, Sparkles, ArrowLeft, Download, PenLine, PlusCircle, AlertTriangle, X, MessageSquareText, Type, ListChecks } from "lucide-react"
import type { ReportData } from "../types/report"
import { UI_LABELS } from "../constants/labels"
import { loadReportData, loadAnalysisFromStorage } from "../utils/storage"
import FeedbackSection from "../components/FeedbackSection"

const FALLBACK_DATA: ReportData = {
    companyInsight: {
        summary: "글로벌 콘텐츠 IP 생태계를 주도하며, 정량적 데이터와 정성적 콘텐츠 감각을 동시에 요구하는 유연한 조직",
        talentKeywords: ["콘텐츠 이해도", "데이터 기반 의사결정", "글로벌 비즈니스 감각", "유저 중심", "빠른 실행력"],
        hiringSignals: ["단순 수치를 넘어 콘텐츠 임팩트로 연결한 경험", "글로벌 시장의 문화적 차이를 반영한 기획", "가설 수립부터 검증, 프로덕트 개선까지의 완결성 있는 경험"],
        rejectionTriggers: ["콘텐츠 플랫폼 특성을 이해하지 못한 기계적인 데이터 분석", "유저의 감정적 경험(UX)을 간과한 효율성 중심의 기획", "본인 기여도가 불분명한 팀 프로젝트 나열"],
        cultureSignals: ["수평적인 소통과 치열한 토론", "빠른 실패와 학습(Fail Fast)", "다양성을 존중하는 열린 조직 문화"]
    },
    firstImpression: {
        summaryOneLiner: "데이터 기반 실행력은 강하지만, 네이버 웹툰 기준 '콘텐츠 임팩트 연결'이 부족합니다",
        persona: "데이터를 통해 인사이트를 도출하고 실행에 옮기는 그로스 PM",
        hashtags: ["#데이터분석", "#가설검증", "#글로벌잠재력"]
    },
    strengths: [
        "A/B 테스트를 통한 이탈률 개선(35% to 18%)은 구체적인 방법론과 정량적 결과를 동시에 보여주는 강력한 사례입니다. 네이버 웹툰의 데이터 드리븐 문화와 잘 맞습니다.",
        "글로벌 서비스 분석에 대한 주도적인 리서치와 3,000건의 데이터 수집 과정은 글로벌 확장을 지속하는 네이버 웹툰에 긍정적인 신호를 줍니다."
    ],
    gaps: [
        "개선한 지표가 네이버 웹툰의 핵심 비즈니스 모델(열람률, 결제 전환율, IP 확장 등)과 어떻게 연결될 수 있는지에 대한 고민이 부족합니다.",
        "웹툰/콘텐츠 플랫폼만의 특수성(유저의 감정적 몰입, 팬덤 문화 등)을 고려한 기획이나 분석 경험이 잘 드러나지 않습니다.",
        "팀 프로젝트에서 본인의 구체적인 역할과 의사결정 과정이 뚜렷하지 않아 협업 및 리더십 역량을 판단하기 어렵습니다."
    ],
    positioning: {
        current: "데이터 툴 활용과 실행력은 검증되었으나, 콘텐츠 비즈니스에 대한 이해가 부족한 주니어",
        target: "데이터 인사이트를 바탕으로 유저의 몰입도를 높이고 콘텐츠 비즈니스 가치를 극대화하는 PM",
        gap: "경험의 나열에서 그치고 있으며, '왜 네이버 웹툰인가'에 대한 전략적 포지셔닝이 부재합니다",
        strategy: "데이터 분석 경험을 네이버 웹툰의 주요 서비스(추천 시스템, 결제 유도, 글로벌 현지화 등)와 직접 연결하고, 콘텐츠 플랫폼에 대한 깊은 이해를 바탕으로 한 기획 능력을 어필하세요."
    },
    questionTabs: [
        {
            id: 1, title: "문항 1",
            prompt: "자신이 주도적으로 문제를 발견하고 해결한 경험에 대해 서술해 주세요. (어떤 문제를 어떻게 해결했는지 구체적으로 작성할 것)",
            subtitleDiagnosis: { exists: true, original: "3,000건의 데이터로 사용자 맞춤 추천을 개선하다", feedback: "성과는 드러나지만, 추천 개선이 어떤 비즈니스 문제를 해결했는지 목적이 더 명확하면 좋습니다.", suggestion: "콘텐츠 탐색 이탈률 15% 방어를 위한 3,000건의 유저 데이터 분석과 맞춤 추천 고도화" },
            fullAnswer: "3,000건의 데이터로 사용자 맞춤 추천을 개선하다\n\n교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영한 경험이 있습니다. 런칭 초기, 유저들이 메인 화면에서 콘텐츠를 탐색하다가 이탈하는 비율이 매우 높다는 문제를 발견했습니다. 이를 해결하기 위해 직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다. 유저의 클릭 패턴과 체류 시간을 분석한 결과, 장르별 개인화가 부족하다는 점을 파악했습니다.\n\n이를 해결하기 위해 추천 로직을 개선하고 A/B 테스트를 진행했습니다. 결과적으로 메인 화면 이탈률을 35%에서 18%로 낮출 수 있었으며, 일간 활성 사용자 수(DAU)도 20% 증가했습니다. 이러한 데이터 기반의 문제 해결 경험을 살려 네이버 웹툰에서도 글로벌 유저들에게 최적화된 콘텐츠 경험을 제공하는 데 기여하고 싶습니다.",
            overview: "데이터를 활용한 문제 해결 과정이 잘 드러나 있으나, 네이버 웹툰의 비즈니스적 맥락과의 연결이 다소 추상적입니다.",
            feedbackCards: [
                { type: "praise", original: "직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다.", praisePoint: "구체적인 수치(3,000건)를 통해 지원자의 주도적인 문제 해결 의지와 실행력을 증명한 훌륭한 문장입니다.", detailedAnalysis: "이 문장은 정량적 근거를 통해 실행력을 증명하는 핵심 문장입니다. 다만, 데이터의 수집 기준이나 분석 과정에서의 주요 의사결정 포인트를 한 줄 추가하면 더욱 설득력이 높아집니다." },
                { type: "praise", original: "메인 화면 이탈률을 35%에서 18%로 낮출 수 있었으며, 일간 활성 사용자 수(DAU)도 20% 증가했습니다.", praisePoint: "A/B 테스트라는 방법론과 명확한 수치적 개선 성과가 잘 결합되어 있습니다.", detailedAnalysis: "해결 방법과 구체적인 개선 수치가 결합되어 지원자의 데이터 기반 문제 해결 역량을 명확히 보여줍니다. 성과를 구체적으로 증명하는 좋은 사례입니다." },
                { type: "improvement", original: "유저의 클릭 패턴과 체류 시간을 분석한 결과, 장르별 개인화가 부족하다는 점을 파악했습니다.", feedback: "분석의 깊이가 다소 얕게 느껴집니다.", detailedAnalysis: "클릭 패턴과 체류 시간만으로 '장르별 개인화 부족'을 도출한 논리적 비약이 있을 수 있습니다. 좀 더 구체적으로 어떤 세그먼트의 유저가 어떤 행동 양상을 보였는지 상세히 서술하면 분석 역량을 더 돋보이게 할 수 있습니다.", suggestion: "유저 코호트 분석 결과, 신규 가입 후 3일 내 특정 장르만 소비하는 유저군에서 이탈률이 두드러짐을 확인하여 세밀한 장르별 개인화 필요성을 도출했습니다." },
                { type: "improvement", original: "이러한 데이터 기반의 문제 해결 경험을 살려 네이버 웹툰에서도 글로벌 유저들에게 최적화된 콘텐츠 경험을 제공하는 데 기여하고 싶습니다.", feedback: "범용적인 포부 문장으로, 네이버 웹툰만의 특화된 메시지가 부재합니다.", detailedAnalysis: "마무리 문장은 '지원 동기'를 최종 확인하는 구간입니다. 현재 문장은 다른 플랫폼에도 그대로 쓸 수 있는 범용 표현입니다. 네이버 웹툰의 특정 서비스나 글로벌 진출 국가 등 구체적인 타겟을 언급해야 면접관에게 강한 인상을 남길 수 있습니다.", suggestion: "이러한 데이터 분석 기반의 개인화 역량을 바탕으로, 네이버 웹툰의 글로벌 서비스에서 국가별 유저 취향을 반영한 큐레이션을 고도화하여 글로벌 열람률을 극대화하는 PM이 되겠습니다." }
            ]
        },
        {
            id: 2, title: "문항 2",
            prompt: "팀 프로젝트나 협업 과정에서 발생한 갈등을 극복하고 성과를 이끌어낸 경험을 설명해 주세요.",
            subtitleDiagnosis: { exists: false, original: "", feedback: "소제목이 비어있습니다. 전체 내용을 파악할 수 있도록 핵심 성과를 담은 소제목을 추가하세요.", suggestion: "개발팀과의 커뮤니케이션 병목 해결로 스프린트 기간 30% 단축" },
            fullAnswer: "학교 프로젝트에서 서비스 기획을 맡아 개발팀, 디자인팀과 협업했습니다. 당시 저희 팀은 일정 지연과 소통 부족이라는 문제를 겪고 있었습니다. 저는 기획자로서 이 문제를 해결하기 위해 적극적으로 나섰습니다. 프로젝트를 진행하며 많은 것을 배웠고 좋은 결과를 얻었습니다. 다양한 팀원들과 협업하며 서로의 입장을 이해하는 법을 배웠습니다. 결국 지속적인 회의와 일정 관리를 통해 프로젝트를 기한 내에 마칠 수 있었습니다.",
            overview: "협업 경험이 추상적으로만 서술되어 있어, 구체적인 본인의 기여도와 문제 해결 방법론을 파악하기 어렵습니다.",
            feedbackCards: [
                { type: "improvement", original: "저는 기획자로서 이 문제를 해결하기 위해 적극적으로 나섰습니다.", feedback: "본인의 구체적인 액션이 보이지 않습니다.", detailedAnalysis: "'적극적으로 나섰다'는 표현은 주관적이며 모호합니다. 면접관은 갈등 상황에서 어떤 구체적인 커뮤니케이션 방법론이나 도구를 사용했는지 알고 싶어합니다.", suggestion: "기획자로서 지라(Jira)와 칸반 보드를 도입하여 각 팀의 태스크 진행 상황을 투명하게 공유하는 프로세스를 구축했습니다." },
                { type: "improvement", original: "프로젝트를 진행하며 많은 것을 배웠고 좋은 결과를 얻었습니다.", feedback: "무엇을 배웠고 어떤 결과인지 특정할 수 없는 표현입니다.", detailedAnalysis: "'많은 것'과 '좋은 결과'는 자소서에서 피해야 할 단어 조합입니다. 구체적으로 어떤 하드/소프트 스킬을 습득했는지, 결과물(산출물 퀄리티 향상, 일정 단축 등)이 무엇인지 명시해야 합니다.", suggestion: "크로스펑셔널 팀 리딩 경험을 통해 애자일 방법론을 체득했으며, 초기 예상보다 2주 앞당겨 베타 버전을 런칭할 수 있었습니다." },
                { type: "improvement", original: "결국 지속적인 회의와 일정 관리를 통해 프로젝트를 기한 내에 마칠 수 있었습니다.", feedback: "일반적인 대응 방법으로 지원자만의 차별성이 드러나지 않습니다.", detailedAnalysis: "단순히 '회의를 많이 했다'는 것은 효율적인 갈등 해결 방법이 아닙니다. 회의 방식을 어떻게 효율화했는지, 기한을 맞추기 위해 스펙 조율 등 어떤 전략적 의사결정을 내렸는지가 중요합니다.", suggestion: "단순한 회의 횟수 증가가 아닌, 데일리 스탠드업 도입과 핵심 스펙 우선순위 재조정을 통해 디자인-개발 간의 병목 현상을 해결하고 기한 내 런칭을 달성했습니다." }
            ]
        }
    ],
    interviewQA: [
        { question: "네이버 웹툰의 추천 로직을 개선한다면 어떤 데이터를 가장 먼저 볼 것 같나요?", followUps: ["왜 그 데이터가 가장 중요하다고 생각하나요?", "해당 데이터를 수집하기 위해 어떤 기획이 필요할까요?"], modelAnswer: "단순 클릭수보다는 '회차별 체류 시간'과 '연속 열람(정주행) 비율'을 가장 먼저 확인하겠습니다. 콘텐츠의 몰입도를 판단하는 데 있어 단순히 눌러본 것보다 끝까지 읽었는지가 핵심 지표이기 때문입니다." },
        { question: "글로벌 유저 타겟팅 시 고려해야 할 문화적 차이는 어떻게 파악할 계획인가요?", followUps: ["현지 유저 인터뷰가 어렵다면 어떻게 데이터를 얻을 건가요?"], modelAnswer: "현지 소셜 미디어 트렌드와 경쟁 플랫폼의 인기 순위를 분석하는 동시에, 네이버 웹툰의 기존 현지화 콘텐츠 댓글 반응(감성 분석)을 텍스트 마이닝하여 현지 유저들의 감정적 반응 포인트를 파악하겠습니다." },
        { question: "개발팀과 기획 스펙으로 충돌할 때, 네이버 웹툰의 빠른 실행 문화에 맞춰 어떻게 조율할 것인가요?", followUps: ["개발팀이 절대 불가능하다고 한다면요?"], modelAnswer: "먼저 '가장 검증하고 싶은 핵심 가설' 하나만 남기고 부가 기능을 과감히 덜어내는 MVP 모델을 제안하겠습니다. 이를 통해 개발 부담을 줄이고 빠른 테스트와 피봇이 가능하도록 조율하겠습니다." }
    ],
    actionPlan: [
        { title: "문항 2를 구체적인 STAR 기법으로 전면 재작성", description: "협업 문항에서 '많은 것을 배웠고' 등 추상적 표현을 배제하고, 구체적인 도구(Jira 등) 활용과 의사결정 과정을 서술하세요.", expectedImpact: "팀 프로젝트에서의 리더십과 커뮤니케이션 역량을 명확히 어필할 수 있습니다." },
        { title: "콘텐츠 도메인 지식 어필 문구 추가", description: "문항 1의 마무리 문장에 단순 '글로벌 유저' 대신 '글로벌 국가별 장르 선호도'나 '정주행 전환율' 등 도메인 특화 용어를 사용하세요.", expectedImpact: "네이버 웹툰 비즈니스에 대한 높은 이해도를 증명할 수 있습니다." }
    ],
    pmComment: "데이터를 다루는 스킬과 실행력은 뛰어납니다. 다만, 이 역량이 네이버 웹툰이라는 '콘텐츠 플랫폼'에서 어떻게 발휘될지에 대한 고민이 10% 부족합니다. 지원 동기 부분을 콘텐츠 특화 인사이트로 조금만 더 뾰족하게 다듬어 보세요."
}

// =============================================================================
// NAVIGATION SECTIONS
// =============================================================================
const NAV_SECTIONS = [
    { id: 'section-first-impression', label: '01. 첫인상' },
    { id: 'section-company-insight', label: '02. 합격 기준' },
    { id: 'section-core-diagnosis', label: '03. 핵심 진단' },
    { id: 'section-line-analysis', label: '04. 문장 분석' },
    { id: 'section-interview-drill', label: '05. 예상 질문' },
    { id: 'section-action-plan', label: '06. 다음 단계' },
    { id: 'section-pm-comment', label: '07. 실무자 코멘트' },
]

// =============================================================================
// MINI NAVIGATOR
// =============================================================================
function MiniNavigator({ activeSection }: { activeSection: string }) {
    return (
        <nav className="report-nav hidden xl:block">
            <div className="space-y-0.5">
                {NAV_SECTIONS.map((sec, idx) => (
                    <a
                        key={sec.id}
                        href={`#${sec.id}`}
                        className={`report-nav-item ${activeSection === sec.id ? 'active' : ''}`}
                        onClick={(e) => {
                            e.preventDefault()
                            document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }}
                    >
                        {sec.label}
                    </a>
                ))}
            </div>
        </nav>
    )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PassMateReport() {
    const [, navigate] = useLocation()

    // ── query parameter에서 mock 여부 판단 ──
    const searchParams = new URLSearchParams(window.location.search)
    const useMock = searchParams.get('mock') === 'true' || searchParams.get('dummy') === 'true'

    // ── sessionStorage에서 회사명/직무명 복원 (통합 구조 우선) ──
    const storedAnalysis = loadAnalysisFromStorage()
    const targetCompany = storedAnalysis?.company || sessionStorage.getItem('passmate_company') || "네이버 웹툰"
    const userName = storedAnalysis?.userName || sessionStorage.getItem('passmate_user') || "김민지"
    const analysisId = storedAnalysis?.analysis_id || null

    const [reportData, setReportData] = useState<ReportData>(() => {
        // mock 모드: 무조건 FALLBACK_DATA 사용
        if (useMock) {
            console.log("🔥 mock 모드: FALLBACK_DATA 사용")
            return FALLBACK_DATA
        }

        // 일반 모드: 통합 스토리지 유틸리티 사용
        const data = loadReportData()
        if (data) {
            console.log("🔥 분석 결과 복원 성공")
            return data as unknown as ReportData
        }

        console.log("🔥 실제 데이터 없음 → FALLBACK_DATA 사용")
        return FALLBACK_DATA
    })

    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [activeTab, setActiveTab] = useState(0)
    const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(0)
    const [completedTasks, setCompletedTasks] = useState<number[]>([])
    const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())
    const [focusedCardIndex, setFocusedCardIndex] = useState<number | null>(null)
    const [viewMode, setViewMode] = useState<'focus' | 'list'>('list')
    const [activeSection, setActiveSection] = useState(NAV_SECTIONS[0].id)
    const [showOverview, setShowOverview] = useState(true)
    const [showSubtitle, setShowSubtitle] = useState(true)

    // ── Scroll Spy (IntersectionObserver) ──
    useEffect(() => {
        const observers: IntersectionObserver[] = []
        NAV_SECTIONS.forEach((sec) => {
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

    const handleApiTest = async () => {
        try {
            setToastMessage({ type: 'success', text: UI_LABELS.API_TEST_SENDING })
            const res = await fetch('/api/test-gemini')
            const data = await res.json()
            if (data.ok) {
                setToastMessage({ type: 'success', text: UI_LABELS.API_TEST_SUCCESS })
            } else {
                setToastMessage({ type: 'error', text: UI_LABELS.API_TEST_FAILED + data.error })
            }
        } catch (e: any) {
            setToastMessage({ type: 'error', text: UI_LABELS.API_TEST_NETWORK_ERROR })
        }
    }

    const handleTabChange = (index: number) => {
        setActiveTab(index)
        setExpandedCards(new Set())
        setFocusedCardIndex(null)
        setShowOverview(true)
        setShowSubtitle(true)
    }

    const toggleTask = (index: number) => {
        setCompletedTasks(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index])
    }

    const taskProgress = Math.round((completedTasks.length / reportData.actionPlan.length) * 100)
    const currentTab = reportData.questionTabs[activeTab]

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
            <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10">
                {/* TOP NAV */}
                <div className="pt-8 pb-4 flex items-center justify-between">
                    <button onClick={() => navigate("/analyze")} className="inline-flex items-center gap-2.5 text-sm text-zinc-500 hover:text-white transition-colors group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span>{UI_LABELS.BACK}</span>
                    </button>
                    <button onClick={handleApiTest} className="text-[11px] text-zinc-600 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600 hover:text-zinc-400 transition-all">
                        {UI_LABELS.API_TEST}
                    </button>
                </div>

                {/* Mock 모드 안내 배너 */}
                {useMock && (
                    <div className="mt-2 mb-4 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs text-amber-400">현재 더미 데이터(mock)가 표시되고 있습니다. 실제 분석 결과를 보려면 분석 페이지에서 다시 시도하세요.</span>
                    </div>
                )}

                {/* ================================================================= */}
                {/* ACT 1: FIRST IMPRESSION */}
                {/* ================================================================= */}
                <header id="section-first-impression" className="pt-8 pb-24 section-divider">
                    <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-white tracking-tight leading-snug md:leading-snug text-balance mb-8">
                        {UI_LABELS.FIRST_IMPRESSION_TITLE(userName)}
                    </h1>

                    <p className="text-lg sm:text-xl text-zinc-200 leading-[1.7] mb-10 max-w-3xl font-medium">
                        {reportData.firstImpression.summaryOneLiner}
                    </p>

                    {/* Persona + Hashtags — Primary Card */}
                    <div className="bg-white/[0.02] border border-white/[0.05] p-7 rounded-xl">
                        <p className="text-sm text-zinc-500 uppercase tracking-[0.15em] mb-3 font-medium">{UI_LABELS.APPLICANT_PROFILE}</p>
                        <p className="text-[17px] text-zinc-100 font-medium leading-[1.7] mb-5">{reportData.firstImpression.persona}</p>
                        <div className="flex flex-wrap gap-2">
                            {reportData.firstImpression.hashtags.map((tag: string) => (
                                <span key={tag} className="px-3 py-1.5 text-xs text-zinc-400 bg-white/[0.03] border border-white/[0.04] rounded-full font-medium">{tag}</span>
                            ))}
                        </div>
                    </div>
                </header>

                {/* ================================================================= */}
                {/* ACT 1.5: COMPANY INSIGHT */}
                {/* ================================================================= */}
                <section id="section-company-insight" className="py-24 section-divider">
                    <h2 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.COMPANY_ANALYSIS}</h2>
                    <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-6 tracking-tight">{UI_LABELS.HIRING_CRITERIA(targetCompany)}</h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-[1.75]">{reportData.companyInsight.summary}</p>

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
                                        <Check className="w-4 h-4 text-emerald-400/50 mt-0.5 shrink-0" />{s}
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
                                        <X className="w-4 h-4 text-rose-400/35 mt-0.5 shrink-0" />{r}
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
                                        <div className="w-[5px] h-[5px] rounded-full bg-zinc-600 mt-[9px] shrink-0"></div>{c}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* ================================================================= */}
                {/* ACT 2: CORE DIAGNOSIS */}
                {/* ================================================================= */}
                <section id="section-core-diagnosis" className="py-24 section-divider">
                    <h2 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.CORE_DIAGNOSIS}</h2>
                    <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-14 tracking-tight">{UI_LABELS.STRENGTHS_AND_GAPS(targetCompany)}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                        <div>
                            <p className="text-sm text-emerald-400/70 uppercase tracking-[0.12em] mb-6 font-semibold">{UI_LABELS.STRENGTHS}</p>
                            <div className="space-y-5">
                                {reportData.strengths.map((s, i) => (
                                    <div key={i} className="pl-0 py-0">
                                        <p className="text-[16px] text-zinc-100 leading-[1.8] font-normal">{s}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-sm text-amber-300/60 uppercase tracking-[0.12em] mb-6 font-semibold">{UI_LABELS.GAPS}</p>
                            <div className="space-y-5">
                                {reportData.gaps.map((g, i) => (
                                    <div key={i} className="pl-0 py-0">
                                        <p className="text-[16px] text-zinc-300 leading-[1.8] font-normal">{g}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Positioning */}
                    <div className="bg-white/[0.03] border border-white/[0.05] p-8 rounded-xl backdrop-blur-sm">
                        <p className="text-sm text-zinc-400 uppercase tracking-[0.12em] mb-7 font-semibold">{UI_LABELS.STRATEGIC_POSITIONING}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-7">
                            <div>
                                <span className="inline-block px-3 py-1.5 bg-zinc-800/80 border border-white/[0.05] rounded-md text-xs font-semibold text-zinc-300 mb-3">{UI_LABELS.POSITION_CURRENT}</span>
                                <p className="text-base text-zinc-400 leading-[1.7] mt-1">{reportData.positioning.current}</p>
                            </div>
                            <div>
                                <span className="inline-block px-3 py-1.5 bg-zinc-800/80 border border-white/[0.05] rounded-md text-xs font-semibold text-zinc-300 mb-3">{UI_LABELS.POSITION_TARGET}</span>
                                <p className="text-[17px] text-white font-bold leading-[1.7] mt-1">{reportData.positioning.target}</p>
                            </div>
                        </div>
                        <div className="border-t border-white/[0.04] pt-6 space-y-7">
                            <div>
                                <span className="inline-block px-3 py-1.5 bg-zinc-800/80 border border-white/[0.05] rounded-md text-xs font-semibold text-zinc-300 mb-3">{UI_LABELS.POSITION_GAP}</span>
                                <p className="text-base text-amber-300 font-semibold leading-[1.7] mt-1">{reportData.positioning.gap}</p>
                            </div>
                            <div>
                                <span className="inline-block px-3 py-1.5 bg-zinc-800/80 border border-white/[0.05] rounded-md text-xs font-semibold text-zinc-300 mb-3">{UI_LABELS.POSITION_STRATEGY}</span>
                                <p className="text-[15px] text-zinc-300 leading-[1.7] mt-1">{reportData.positioning.strategy}</p>
                            </div>
                        </div>
                    </div>
                </section>
            </article>

            {/* ================================================================= */}
            {/* ACT 3: LINE-BY-LINE ANALYSIS — Editorial Review Workspace */}
            {/* ================================================================= */}
            <section id="section-line-analysis" className="py-24 section-divider max-w-[1440px] mx-auto px-6 md:px-10"
                onClick={(e) => {
                    // Click-outside: reset highlight if clicking empty area
                    if ((e.target as HTMLElement).closest('.annotation-hl') || (e.target as HTMLElement).closest('.commentary-trigger') || (e.target as HTMLElement).closest('.commentary-body') || (e.target as HTMLElement).closest('.view-mode-toggle')) return
                    setFocusedCardIndex(null)
                    setExpandedCards(new Set())
                }}>
                <h2 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.DETAILED_DIAGNOSIS}</h2>
                <h3 className="text-xl sm:text-2xl font-semibold text-white mb-10 tracking-tight">{UI_LABELS.LINE_BY_LINE_ANALYSIS}</h3>

                {/* Split View: Source (Left) + Commentary (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-0 lg:items-start">

                    {/* ═══ LEFT PANEL: Source Text ═══ */}
                    <div ref={sourceTextRef} className="lg:pr-10 lg:sticky lg:top-[10vh] lg:self-start lg:max-h-[85vh] lg:overflow-y-auto hide-scrollbar">
                        {/* Document Header */}
                        <div className="doc-header mb-6">
                            <span>{targetCompany}</span>
                            <span className="separator">·</span>
                            <span>{userName}</span>
                        </div>

                        {/* Section Navigator Tabs */}
                        <div className="flex items-center border-b border-white/[0.06] mb-8">
                            {reportData.questionTabs.map((tab, index) => (
                                <button key={tab.id} onClick={() => handleTabChange(index)}
                                    className={`section-tab ${activeTab === index ? 'active' : ''}`}>
                                    {tab.title}
                                </button>
                            ))}
                        </div>

                        {/* Question Prompt */}
                        <div className="mb-8">
                            <p className="question-prompt">{currentTab.prompt}</p>
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
                            <p className="text-xs text-zinc-500 uppercase tracking-[0.15em] font-semibold">{UI_LABELS.AI_COMMENTARY}</p>
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
                        <div className="mb-4 bg-zinc-900/40 border border-white/[0.06] rounded-2xl p-5 hover:bg-zinc-900/60 transition-colors">
                            <button onClick={() => setShowOverview(!showOverview)}
                                className="w-full flex items-center justify-between text-left group">
                                <span className="commentary-section-label panel-header flex items-center gap-3 text-zinc-50" style={{ margin: 0, border: 'none', padding: 0 }}><MessageSquareText className="w-5 h-5 text-zinc-300" />{UI_LABELS.OVERVIEW}</span>
                                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${showOverview ? 'rotate-180' : ''}`} />
                            </button>
                            {showOverview && (
                                <div className="pt-4 mt-4 border-t border-white/[0.04]">
                                    <p className="text-[14px] text-zinc-300 leading-[1.8]">{currentTab.overview}</p>
                                </div>
                            )}
                        </div>

                        {/* Subtitle Diagnosis — Collapsible */}
                        <div className="mb-4 bg-zinc-900/40 border border-white/[0.06] rounded-2xl p-5 hover:bg-zinc-900/60 transition-colors">
                            <button onClick={() => setShowSubtitle(!showSubtitle)}
                                className="w-full flex items-center justify-between text-left group">
                                <span className="commentary-section-label panel-header flex items-center gap-3 text-zinc-50" style={{ margin: 0, border: 'none', padding: 0 }}><Type className="w-5 h-5 text-zinc-300" />{UI_LABELS.SUBTITLE_DIAGNOSIS}</span>
                                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${showSubtitle ? 'rotate-180' : ''}`} />
                            </button>
                            {showSubtitle && (
                                <div className="pt-4 mt-4 border-t border-white/[0.04]">
                                    {currentTab.subtitleDiagnosis.exists ? (
                                        <div className="space-y-0">
                                            <p className="commentary-body-text mb-4">{currentTab.subtitleDiagnosis.feedback}</p>
                                            
                                            <p className="commentary-label">소제목 수정 제안</p>
                                            <p className="commentary-headline mb-0">{currentTab.subtitleDiagnosis.suggestion}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-0">
                                            <p className="commentary-body-text mb-4">{currentTab.subtitleDiagnosis.feedback}</p>
                                            
                                            <p className="commentary-label" style={{ marginTop: '0' }}>소제목 수정 제안</p>
                                            <p className="commentary-headline mb-0">{currentTab.subtitleDiagnosis.suggestion}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Section Header: 문장 진단 */}
                        <div className="bg-zinc-900/40 border border-white/[0.06] rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-6">
                                <ListChecks className="w-5 h-5 text-zinc-300" />
                                <span className="commentary-section-label panel-header text-zinc-50" style={{ margin: 0, border: 'none', padding: 0 }}>{UI_LABELS.SENTENCE_DIAGNOSIS}</span>
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
                                            <p className="commentary-body-text mb-4">{card.detailedAnalysis || (card.type === 'improvement' ? card.feedback : card.praisePoint)}</p>

                                            {/* Interview perspective */}
                                            {card.interviewLink && (
                                                <>
                                                    <p className="commentary-label">예상 면접 질문</p>
                                                    <p className="commentary-headline">"{card.interviewLink.question}"</p>
                                                    <p className="commentary-meta mb-4">{UI_LABELS.QUESTION_INTENT}: {card.interviewLink.intent}</p>
                                                </>
                                            )}

                                            {/* Improvement suggestion */}
                                            {card.type === 'improvement' && card.suggestion && (
                                                <>
                                                    <p className="commentary-label">개선한 문장</p>
                                                    <p className="commentary-headline">{card.suggestion}</p>
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
                                            className={`commentary-item ${card.type} ${isExpanded ? 'expanded' : ''} ${isFocused && !isExpanded ? 'focused' : ''}`}>

                                            {/* Trigger */}
                                            <button className="commentary-trigger" onClick={() => handleAccordionToggle(realIdx)}>
                                                <span className="commentary-num">{displayNum}</span>
                                                <span className="commentary-preview flex-1 min-w-0">{previewText}</span>
                                                <ChevronDown className="commentary-chevron" />
                                            </button>

                                            {/* Body */}
                                            <div className="commentary-body pt-2">
                                                {/* Detailed Analysis */}
                                                <p className="commentary-body-text mb-4">{card.detailedAnalysis || (card.type === 'improvement' ? card.feedback : card.praisePoint)}</p>

                                                {/* Interview perspective */}
                                                {card.interviewLink && (
                                                    <>
                                                        <p className="commentary-label">예상 면접 질문</p>
                                                        <p className="commentary-headline">"{card.interviewLink.question}"</p>
                                                        <p className="commentary-meta mt-1">{UI_LABELS.QUESTION_INTENT}: {card.interviewLink.intent}</p>
                                                    </>
                                                )}

                                                {/* Improvement suggestion */}
                                                {card.type === 'improvement' && card.suggestion && (
                                                    <>
                                                        <p className="commentary-label">개선한 문장</p>
                                                        <p className="commentary-headline">{card.suggestion}</p>
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



            <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10">

                {/* ================================================================= */}
                {/* ACT 4: INTERVIEW DRILL */}
                {/* ================================================================= */}
                <section id="section-interview-drill" className="pt-24 pb-24 section-divider">
                    <h2 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.INTERVIEW_DRILL}</h2>
                    <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-6 tracking-tight">{UI_LABELS.INTERVIEW_DRILL_TITLE}</h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-[1.7]">{UI_LABELS.INTERVIEW_DRILL_DESC}</p>

                    <div className="space-y-0">
                        {reportData.interviewQA.map((item, index) => (
                            <div key={index} className="border-b border-white/[0.04] last:border-0">
                                <button onClick={() => setOpenQuestionIndex(openQuestionIndex === index ? null : index)}
                                    className="w-full py-6 flex items-start gap-5 text-left group">
                                    <span className="text-xs uppercase tracking-[0.12em] text-zinc-500 mt-1 min-w-[50px] font-medium">Q{index + 1}</span>
                                    <span className="flex-1 text-[17px] text-zinc-300 group-hover:text-white transition-colors leading-[1.6]">{item.question}</span>
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
                                                            <ArrowRight className="w-3 h-3 text-amber-300/35 mt-1.5 shrink-0" />{fu}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 mb-3 font-medium">{UI_LABELS.MODEL_ANSWER}</p>
                                        <p className="text-[15px] text-zinc-400 leading-[1.8]">{item.modelAnswer}</p>
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
                    <h2 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.ACTION_PLAN}</h2>
                    <h3 className="text-xl sm:text-2xl font-semibold text-white mb-6 tracking-tight">{UI_LABELS.ACTION_PLAN_TITLE}</h3>

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
                                        <span className={`text-base transition-colors leading-[1.6] block mb-1.5 ${isComplete ? "line-through text-zinc-600" : "text-zinc-200 group-hover:text-white"}`}>{task.title}</span>
                                        <p className={`text-[15px] transition-colors leading-[1.7] ${isComplete ? "text-zinc-700" : "text-zinc-500"}`}>{task.description}</p>
                                        <p className={`text-sm mt-2.5 transition-colors ${isComplete ? "text-zinc-700" : "text-emerald-400/50"}`}>{UI_LABELS.EXPECTED_IMPACT}: {task.expectedImpact}</p>
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
                    <h2 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.PM_VERDICT}</h2>
                    <h3 className="text-xl sm:text-2xl font-medium text-white mb-10 tracking-tight">{UI_LABELS.PM_VERDICT_TITLE}</h3>
                    <div className="flex items-start gap-5">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-indigo-400 text-xs font-bold tracking-tight">H</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-sm font-medium text-white">Mentor Hansi</span>
                                <span className="text-xs text-zinc-600">{UI_LABELS.JUST_NOW}</span>
                            </div>
                            <div className="border-l-2 border-indigo-400/20 pl-5">
                                <p className="text-[17px] text-zinc-200 leading-[1.8] font-normal">{reportData.pmComment}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ================================================================= */}
                {/* FEEDBACK SECTION */}
                {/* ================================================================= */}
                <FeedbackSection analysisId={analysisId} />

                {/* ================================================================= */}
                {/* PREMIUM UPSELL */}
                {/* ================================================================= */}
                <section className="py-24">
                    <h2 className="text-xs uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.PREMIUM}</h2>
                    <h3 className="text-2xl sm:text-3xl font-medium text-white mb-6 tracking-tight">{UI_LABELS.PREMIUM_NEXT_STEPS}</h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-[1.7]">{UI_LABELS.PREMIUM_DESC}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="group relative bg-white/[0.02] border border-white/[0.04] rounded-xl p-8 hover:border-white/[0.08] transition-all duration-300">
                            <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center mb-6">
                                <FileText className="w-5 h-5 text-zinc-400" />
                            </div>
                            <h4 className="text-lg font-medium text-white mb-3">{UI_LABELS.PAST_QUESTIONS}</h4>
                            <p className="text-[15px] text-zinc-500 leading-[1.7] mb-8">{UI_LABELS.PAST_QUESTIONS_DESC}</p>
                            <button className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group/btn">
                                <span>{UI_LABELS.GO_TO}</span><ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>
                        <div className="group relative bg-white/[0.02] border border-white/[0.04] rounded-xl p-8 hover:border-white/[0.08] transition-all duration-300">
                            <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center mb-6">
                                <Sparkles className="w-5 h-5 text-zinc-400" />
                            </div>
                            <h4 className="text-lg font-medium text-white mb-3">{UI_LABELS.EXPERT_REVIEW}</h4>
                            <p className="text-[15px] text-zinc-500 leading-[1.7] mb-8">{UI_LABELS.EXPERT_REVIEW_DESC}</p>
                            <button className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group/btn">
                                <span>{UI_LABELS.APPLY_PREMIUM}</span><ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </section>

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
                        <p>PassMate 2026. All rights reserved.</p>
                        <span className="hidden sm:inline">-</span>
                        <p>Report ID: RPT-2026-0430-{Math.random().toString(36).slice(2, 6).toUpperCase()}</p>
                    </div>
                </footer>
            </article>


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
