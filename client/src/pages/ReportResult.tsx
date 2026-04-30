import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import { X, Check, ChevronDown, ArrowRight, FileText, Sparkles, ArrowLeft, Download, PenLine, PlusCircle, AlertTriangle, Target, Zap, MessageSquare } from "lucide-react"
import type { ReportData } from "../types/report"
import { UI_LABELS } from "../constants/labels"

const FALLBACK_DATA: ReportData = {
    companyInsight: {
        summary: "숫자로 증명된 실행력을 가장 중시하는 성과주의 조직",
        talentKeywords: ["데이터 기반 의사결정", "실행력", "고객 중심", "글로벌 역량", "문제 해결"],
        hiringSignals: ["정량적 성과를 수치로 제시하는 경험", "가설 수립부터 검증까지의 논리적 사고", "비즈니스 임팩트와 연결된 결과물"],
        rejectionTriggers: ["추상적 표현으로 가득한 경험 서술", "팀 내 본인 기여도가 불분명한 협업 사례", "비즈니스 가치와 연결되지 않는 단순 수치 나열"],
        cultureSignals: ["수평적 소통 문화", "빠른 실행과 피봇", "데이터 드리븐 의사결정"]
    },
    firstImpression: {
        summaryOneLiner: "데이터 기반 실행력은 강하지만, 삼성전자 기준 '제품 임팩트 연결'은 부족합니다",
        persona: "데이터 분석으로 문제를 찾고, 현장 실행력으로 해답을 증명하는 그로스 PM",
        hashtags: ["#현장실행력", "#데이터분석", "#팀리더십"]
    },
    strengths: [
        "3,000건의 현장 데이터 수집과 50곳 매장 방문은 이 회사가 가장 중시하는 '실행력'을 완벽하게 증명합니다. 단순 데스크 리서치가 아닌 발로 뛰는 데이터 수집 방식은 실무진에게 강한 인상을 남길 수 있습니다.",
        "예측 정확도 60%에서 87%로의 개선 과정은 가설-실험-개선의 사이클을 보여줍니다. 이 회사의 데이터 드리븐 문화와 정확히 일치하는 역량입니다.",
        "A/B 테스트를 통한 이탈률 개선(35% to 18%)은 구체적인 방법론과 정량적 결과를 동시에 보여주는 강력한 사례입니다."
    ],
    gaps: [
        "87%의 예측 정확도가 비즈니스적으로 어떤 가치를 창출했는지 연결이 빠져 있습니다. 이 회사 면접관은 반드시 '그래서 매출이나 비용에 어떤 영향이 있었나요?'라고 물을 것입니다.",
        "팀 프로젝트에서 본인의 구체적인 역할과 의사결정 과정이 드러나지 않습니다. '협력하여 완수했습니다'는 이 회사의 탈락 트리거 중 하나입니다.",
        "지원하는 직무와 경험의 연결고리가 약합니다. 왜 이 회사에서, 이 직무로 일하고 싶은지에 대한 전략적 서술이 필요합니다."
    ],
    positioning: {
        current: "실행력은 검증되었으나, 비즈니스 임팩트 연결이 약한 주니어 실무자",
        target: "데이터를 비즈니스 가치로 전환하는 능력을 갖춘 전략적 실무자",
        gap: "경험의 나열에서 그치고 있으며, '왜 이 회사인가'에 대한 전략적 포지셔닝이 부재합니다",
        strategy: "각 경험의 결과물을 비즈니스 지표(매출, 비용 절감, 전환율)와 연결하고, 지원 직무의 핵심 KPI와 매핑하세요. 특히 마무리 문장에서 이 회사의 구체적인 서비스명과 본인의 역량을 연결하는 것이 핵심입니다."
    },
    questionTabs: [
        {
            id: 1, title: "문항 1",
            prompt: "본인이 주도적으로 문제를 해결했던 경험을 구체적으로 서술하시오.",
            subtitleDiagnosis: { exists: true, original: "발로 뛰어 얻은 3,000개의 데이터, 정확도 87%를 달성하다", feedback: "성과가 돋보이는 좋은 소제목입니다. 다만, 어떤 비즈니스 문제를 해결했는지 목적이 드러나면 더 좋습니다.", suggestion: "악성 재고 15% 절감을 이끌어낸 3,000번의 현장 검증과 87%의 예측 모델" },
            fullAnswer: "발로 뛰어 얻은 3,000개의 데이터, 정확도 87%를 달성하다\n\n교내 캡스톤 디자인 프로젝트에서 소상공인을 위한 매출 예측 모델을 개발했습니다. 초기에는 공공 데이터만으로 모델링을 시도했으나, 지역별 특성이 반영되지 않아 예측 정확도가 60%에 머물렀습니다. 이를 해결하기 위해 팀원들과 직접 50곳 이상의 매장을 방문하여 인터뷰를 진행하고 신뢰를 쌓았습니다. 소상공인들의 협조를 얻기 어려웠지만, 여러 번 방문하여 취지를 설명했습니다.\n\n결과적으로 3,000건 이상의 실제 매출 데이터를 수집할 수 있었습니다. 수집된 데이터를 바탕으로 Python과 scikit-learn을 활용하여 예측 모델을 고도화했습니다. 예측 정확도 87%를 달성했으며, 이 성과를 인정받아 교내 캡스톤 디자인 경진대회에서 최우수상을 수상했습니다. 입사 후에도 고객 인사이트를 도출하고 비즈니스 성장에 기여하고 싶습니다.",
            overview: "실행력과 정량적 성과는 훌륭하지만, 과정의 논리적 연결과 직무 적합성 어필이 부족합니다.",
            feedbackCards: [
                { type: "praise", original: "결과적으로 3,000건 이상의 실제 매출 데이터를 수집할 수 있었습니다.", praisePoint: "구체적인 수치(3,000건)를 통해 지원자의 실행력을 증명한 훌륭한 문장입니다.", interviewLink: { question: "3,000건의 데이터를 어떤 기준으로 수집했나요?", intent: "데이터 품질 관리 능력을 검증하려는 의도" } },
                { type: "praise", original: "직접 50곳 이상의 매장을 방문하여 인터뷰를 진행하고 신뢰를 쌓았습니다.", praisePoint: "현장으로 직접 나가는 능동적인 문제 해결 태도가 실무진에게 큰 호감을 줍니다." },
                { type: "improvement", original: "소상공인들의 협조를 얻기 어려웠지만, 여러 번 방문하여 취지를 설명했습니다.", feedback: "'어려웠지만 설명했다'는 전개가 평면적입니다. 구체적으로 어떤 전략으로 설득했는지가 필요합니다.", suggestion: "초기 거절에도 불구하고, 예측 모델이 가져올 '악성 재고 비용 절감' 효과를 시각화한 리포트로 설득하여 50곳의 협조를 이끌어냈습니다.", interviewLink: { question: "거절당했을 때 구체적으로 어떤 방식으로 설득했나요?", intent: "커뮤니케이션 능력과 끈기를 검증" } },
                { type: "improvement", original: "예측 정확도 87%를 달성했으며, 이 성과를 인정받아 교내 캡스톤 디자인 경진대회에서 최우수상을 수상했습니다.", feedback: "정확도를 높인 것에서 끝나면 안 됩니다. 비즈니스적으로 어떤 가치를 창출했는지 결과물 중심으로 재작성해야 합니다.", suggestion: "시계열 예측 모델을 적용해 예측 정확도를 87%까지 끌어올렸으며, 이를 통해 소상공인들의 악성 재고 비용을 15% 이상 절감할 수 있는 솔루션을 제안하여 최우수상을 수상했습니다.", interviewLink: { question: "87%라는 정확도의 비즈니스 임팩트는 구체적으로 무엇이었나요?", intent: "성과를 비즈니스 가치로 연결하는 사고력 검증" } },
                { type: "improvement", original: "입사 후에도 고객 인사이트를 도출하고 비즈니스 성장에 기여하고 싶습니다.", feedback: "너무 추상적이고 뻔한 마무리입니다. 지원하는 회사의 구체적인 서비스와 연결해야 합니다.", suggestion: "현장에서 얻은 데이터를 비즈니스 가치로 연결했던 경험을 살려, 귀사의 주요 서비스에서 유저 이탈률을 방어하고 결제 전환율을 높이는 데이터 기반 PM이 되겠습니다.", interviewLink: { question: "우리 회사의 어떤 서비스에 기여하고 싶은가요?", intent: "지원 동기와 회사 이해도를 검증" } }
            ]
        },
        {
            id: 2, title: "문항 2",
            prompt: "팀 프로젝트에서 갈등을 해결하거나 협업을 통해 성과를 낸 경험을 작성하시오.",
            subtitleDiagnosis: { exists: false, original: "", feedback: "소제목이 비어있습니다. 면접관이 첫 줄만 읽고도 전체 내용을 파악할 수 있도록 핵심 성과를 담은 소제목을 추가하세요.", suggestion: "결제 오류율 23% 개선, A/B 테스트로 증명한 가설 검증력" },
            fullAnswer: "IT 연합 동아리에서 팀원들과 협력하여 성공적으로 프로젝트를 완수했습니다. 당시 저희 팀은 유저 이탈률이 높다는 문제를 겪고 있었습니다. 프로젝트를 통해 많은 것을 배웠고 좋은 결과를 얻었습니다. 다양한 팀원들과 협업하며 많은 것을 배웠습니다. 문제 해결 능력이 뛰어납니다. 결국 3주간 A/B 테스트를 통해 이탈률을 35%에서 18%로 개선했습니다.",
            overview: "핵심 성과(이탈률 개선)가 추상적인 문장들에 가려져 있습니다. 구체적인 방법론과 본인의 기여도를 명확히 해야 합니다.",
            feedbackCards: [
                { type: "praise", original: "결국 3주간 A/B 테스트를 통해 이탈률을 35%에서 18%로 개선했습니다.", praisePoint: "해결 방법(A/B 테스트), 소요 기간(3주), 구체적인 개선 수치(35% -> 18%)가 완벽하게 결합된 핵심 문장입니다.", interviewLink: { question: "A/B 테스트의 가설은 무엇이었고, 대조군은 어떻게 설정했나요?", intent: "실험 설계 능력과 데이터 리터러시 검증" } },
                { type: "improvement", original: "팀원들과 협력하여 성공적으로 프로젝트를 완수했습니다.", feedback: "본인의 구체적인 역할과 기여 내용이 전혀 드러나지 않는 모호한 표현입니다.", suggestion: "5명의 개발팀과 주 2회 스프린트 회의를 주도하며 UI/UX 개편 프로젝트의 리드 PM 역할을 수행했습니다.", interviewLink: { question: "팀에서 본인의 구체적인 역할은 무엇이었나요?", intent: "리더십과 팀 내 포지셔닝 검증" } },
                { type: "improvement", original: "프로젝트를 통해 많은 것을 배웠고 좋은 결과를 얻었습니다.", feedback: "무엇을 배웠고 어떤 결과인지 알 수 없는 추상적인 표현입니다.", suggestion: "데이터 분석을 통한 가설 수립 및 검증 프로세스를 체득했으며, 3개월간 MAU를 12만에서 28만으로 133% 성장시켰습니다.", interviewLink: { question: "구체적으로 무엇을 배웠나요?", intent: "성장 가능성과 자기 인식 수준 검증" } },
                { type: "improvement", original: "문제 해결 능력이 뛰어납니다.", feedback: "본인의 주관적인 평가는 신뢰를 주지 못합니다. 구체적인 과정을 서술하세요.", suggestion: "결제 이탈 구간의 퍼널 데이터를 분석하여 3가지 핵심 병목을 도출하고, 결제 프로세스를 간소화하여 오류율을 2%로 감소시켰습니다.", interviewLink: { question: "문제 해결 능력이 뛰어나다는 근거가 무엇인가요?", intent: "자기 객관화 능력 검증" } }
            ]
        }
    ],
    interviewQA: [
        { question: "이탈률 개선 시 고려한 주요 변수는 무엇이었나요?", followUps: ["변수 간 우선순위는 어떻게 정했나요?", "해당 변수가 유의미하다는 것을 어떻게 검증했나요?"], modelAnswer: "크게 세 가지 변수를 고려했습니다. 첫째, 유저 세그먼트별 이탈 시점 분석을 통해 온보딩 3일차에 급격한 이탈이 발생함을 확인했습니다. 둘째, 기능별 사용률 데이터를 분석하여 핵심 기능 발견율이 23%에 불과함을 파악했습니다. 셋째, 경쟁사 벤치마킹을 통해 푸시 알림 전략의 차이점을 발견했습니다." },
        { question: "A/B 테스트 외에 대안 방법론은 고려하지 않았나요?", followUps: ["표본 크기가 부족한 경우에는 어떻게 대응했을 건가요?", "A/B 테스트 결과의 통계적 유의성은 어떻게 검증했나요?"], modelAnswer: "A/B 테스트 외에도 다변량 테스트, 코호트 분석, 퍼널 분석 등을 활용할 수 있습니다. 특히 표본 크기가 작은 경우 베이지안 접근법을 적용하거나, 정성적 데이터가 필요할 때는 사용자 인터뷰와 세션 리플레이를 병행합니다." },
        { question: "팀 내 반대 의견이 있었을 때 어떻게 설득했나요?", followUps: ["설득에 실패한 경험은 없나요?", "의견 충돌이 해결되지 않을 때의 최종 의사결정 방식은요?"], modelAnswer: "반대 의견이 있을 때는 먼저 상대방의 우려사항을 명확히 이해하려 노력합니다. 이후 데이터 기반의 근거를 제시하고, 작은 규모의 파일럿 테스트를 제안하여 리스크를 최소화하는 방식으로 합의점을 찾습니다." }
    ],
    actionPlan: [
        { title: "추상적 표현 3개 문장을 정량적 성과로 교체", description: "문항 2에서 지적된 '많은 것을 배웠고', '좋은 결과', '뛰어납니다' 등을 구체적 수치와 방법론으로 재작성하세요.", expectedImpact: "면접관이 '이 사람은 근거 있이 말하는 사람이다'라는 인상을 받게 됩니다." },
        { title: "각 경험의 비즈니스 임팩트 연결 문장 추가", description: "87% 정확도, 이탈률 18% 등의 성과가 매출/비용에 어떤 영향을 미쳤는지 한 문장씩 추가하세요.", expectedImpact: "단순 실행자가 아닌 비즈니스 관점의 사고력을 가진 지원자로 포지셔닝됩니다." },
        { title: "마무리 문장에 지원 회사의 구체적 서비스명 삽입", description: "현재 '비즈니스 성장에 기여'라는 범용 표현을 지원 회사의 실제 서비스/제품명과 연결하세요.", expectedImpact: "'우리 회사를 진짜 알고 지원했구나'라는 차별화된 인상을 줍니다." }
    ],
    pmComment: "실행력은 상위 20%입니다. 다만, 지금 상태로는 '열심히 한 사람'이지 '뽑고 싶은 사람'은 아닙니다. 경험을 비즈니스 가치로 번역하는 한 줄이 빠져 있어요."
}
// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PassMateReport() {
    const [, navigate] = useLocation()

    // ── query parameter에서 mock 여부 판단 ──
    const searchParams = new URLSearchParams(window.location.search)
    const useMock = searchParams.get('mock') === 'true'

    // ── sessionStorage에서 회사명/직무명 복원 ──
    const targetCompany = sessionStorage.getItem('passmate_company') || "지원 기업"
    const userName = sessionStorage.getItem('passmate_job') || "지원자"

    const [reportData, setReportData] = useState<ReportData>(() => {
        // mock 모드: 무조건 FALLBACK_DATA 사용
        if (useMock) {
            console.log("🔥 mock 모드: FALLBACK_DATA 사용")
            return FALLBACK_DATA
        }

        // 일반 모드: sessionStorage에서 실제 데이터 로드
        try {
            const stored = sessionStorage.getItem('passmate_analysis_result')
            console.log("🔥 sessionStorage 데이터 존재 여부:", !!stored)
            if (stored) {
                const parsed = JSON.parse(stored)
                console.log("🔥 파싱된 데이터:", parsed)
                if (parsed && Array.isArray(parsed.questionTabs) && parsed.questionTabs.length > 0) {
                    return parsed
                }
            }
        } catch (e) {
            console.warn('[ReportResult] sessionStorage parse failed:', e)
        }
        console.log("🔥 실제 데이터 없음 → FALLBACK_DATA 사용")
        return FALLBACK_DATA
    })

    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [activeTab, setActiveTab] = useState(0)
    const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(0)
    const [completedTasks, setCompletedTasks] = useState<number[]>([])
    const [viewMode, setViewMode] = useState<'focus' | 'list'>('list')
    const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null)
    const [showSubtitle, setShowSubtitle] = useState(false)

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

    const [aiLogicModal, setAiLogicModal] = useState<{
        isOpen: boolean
        original: string
        feedback: string
        suggestion?: string
        type: string
        interviewLink?: { question: string; intent: string }
    } | null>(null)

    const handleTabChange = (index: number) => {
        setActiveTab(index)
        setActiveCardIndex(null)
        setShowSubtitle(false)
    }

    const toggleTask = (index: number) => {
        setCompletedTasks(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index])
    }

    const taskProgress = Math.round((completedTasks.length / reportData.actionPlan.length) * 100)
    const currentTab = reportData.questionTabs[activeTab]
    const visibleCards = viewMode === 'list' ? currentTab.feedbackCards : activeCardIndex !== null ? [currentTab.feedbackCards[activeCardIndex]] : []

    useEffect(() => {
        const anyOpen = aiLogicModal?.isOpen
        if (anyOpen) {
            document.body.style.overflow = 'hidden'
            const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAiLogicModal(null) }
            window.addEventListener('keydown', handleEsc)
            return () => { document.body.style.overflow = 'unset'; window.removeEventListener('keydown', handleEsc) }
        } else {
            document.body.style.overflow = 'unset'
        }
    }, [aiLogicModal?.isOpen])

    return (
        <main className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-zinc-700/50">
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
                <header className="pt-8 pb-16 border-b border-white/10">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium text-white tracking-tight leading-tight md:leading-tight text-balance mb-6">
                        {UI_LABELS.FIRST_IMPRESSION_TITLE(userName)}
                    </h1>

                    <p className="text-lg text-zinc-300 leading-relaxed mb-8 max-w-3xl font-medium">
                        {reportData.firstImpression.summaryOneLiner}
                    </p>

                    {/* Persona + Hashtags */}
                    <div className="bg-zinc-900/40 border border-white/[0.04] p-6 rounded-2xl mb-0">
                        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">{UI_LABELS.APPLICANT_PROFILE}</p>
                        <p className="text-base text-white font-medium leading-relaxed mb-4">{reportData.firstImpression.persona}</p>
                        <div className="flex flex-wrap gap-2">
                            {reportData.firstImpression.hashtags.map((tag: string) => (
                                <span key={tag} className="px-3 py-1 text-xs text-zinc-400 bg-zinc-800/60 border border-white/[0.06] rounded-full">{tag}</span>
                            ))}
                        </div>
                    </div>
                </header>

                {/* ================================================================= */}
                {/* ACT 1.5: COMPANY INSIGHT */}
                {/* ================================================================= */}
                <section className="py-16 border-b border-white/10">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-3">{UI_LABELS.COMPANY_ANALYSIS}</h2>
                    <h3 className="text-2xl sm:text-3xl font-medium text-white mb-5 tracking-tight">{UI_LABELS.HIRING_CRITERIA(targetCompany)}</h3>
                    <p className="text-base text-zinc-400 mb-10 max-w-2xl leading-relaxed">{reportData.companyInsight.summary}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Talent Keywords */}
                        <div className="bg-zinc-900/40 border border-white/[0.04] p-6 rounded-xl">
                            <div className="flex items-center gap-2 mb-4">
                                <Target className="w-4 h-4 text-zinc-500" />
                                <p className="text-xs text-zinc-500 uppercase tracking-widest">{UI_LABELS.TALENT_PROFILE}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {reportData.companyInsight.talentKeywords.map((kw) => (
                                    <span key={kw} className="px-3 py-1.5 text-xs text-zinc-300 bg-zinc-800/60 border border-white/[0.08] rounded-lg font-medium">{kw}</span>
                                ))}
                            </div>
                        </div>

                        {/* Hiring Signals */}
                        <div className="bg-zinc-900/40 border border-white/[0.04] p-6 rounded-xl">
                            <div className="flex items-center gap-2 mb-4">
                                <Zap className="w-4 h-4 text-emerald-500/70" />
                                <p className="text-xs text-zinc-500 uppercase tracking-widest">{UI_LABELS.ACCEPTANCE_CRITERIA}</p>
                            </div>
                            <ul className="space-y-2">
                                {reportData.companyInsight.hiringSignals.map((s, i) => (
                                    <li key={i} className="text-sm text-zinc-400 leading-relaxed flex items-start gap-2">
                                        <Check className="w-3.5 h-3.5 text-emerald-500/60 mt-0.5 shrink-0" />{s}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Rejection Triggers */}
                        <div className="bg-zinc-900/40 border border-red-500/[0.06] p-6 rounded-xl">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="w-4 h-4 text-red-400/70" />
                                <p className="text-xs text-red-400/70 uppercase tracking-widest">{UI_LABELS.REJECTION_TRIGGERS}</p>
                            </div>
                            <ul className="space-y-2">
                                {reportData.companyInsight.rejectionTriggers.map((r, i) => (
                                    <li key={i} className="text-sm text-zinc-400 leading-relaxed flex items-start gap-2">
                                        <X className="w-3.5 h-3.5 text-red-400/50 mt-0.5 shrink-0" />{r}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Culture Signals */}
                        <div className="bg-zinc-900/40 border border-white/[0.04] p-6 rounded-xl">
                            <div className="flex items-center gap-2 mb-4">
                                <MessageSquare className="w-4 h-4 text-zinc-500" />
                                <p className="text-xs text-zinc-500 uppercase tracking-widest">{UI_LABELS.CULTURE_SIGNALS}</p>
                            </div>
                            <ul className="space-y-2">
                                {reportData.companyInsight.cultureSignals.map((c, i) => (
                                    <li key={i} className="text-sm text-zinc-400 leading-relaxed">{c}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* ================================================================= */}
                {/* ACT 2: CORE DIAGNOSIS */}
                {/* ================================================================= */}
                <section className="py-16 border-b border-white/10">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-3">{UI_LABELS.CORE_DIAGNOSIS}</h2>
                    <h3 className="text-2xl sm:text-3xl font-medium text-white mb-10 tracking-tight">{UI_LABELS.STRENGTHS_AND_GAPS(targetCompany)}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                        <div>
                            <p className="text-xs text-emerald-400/70 uppercase tracking-widest mb-4 font-medium">{UI_LABELS.STRENGTHS}</p>
                            <div className="space-y-3">
                                {reportData.strengths.map((s, i) => (
                                    <div key={i} className="bg-zinc-900/40 border border-emerald-500/[0.08] p-5 rounded-xl">
                                        <p className="text-sm text-zinc-300 leading-relaxed">{s}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-amber-400/70 uppercase tracking-widest mb-4 font-medium">{UI_LABELS.GAPS}</p>
                            <div className="space-y-3">
                                {reportData.gaps.map((g, i) => (
                                    <div key={i} className="bg-zinc-900/40 border border-amber-500/[0.08] p-5 rounded-xl">
                                        <p className="text-sm text-zinc-300 leading-relaxed">{g}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Positioning */}
                    <div className="bg-zinc-900/40 border border-white/[0.04] p-8 rounded-2xl">
                        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-6">{UI_LABELS.STRATEGIC_POSITIONING}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                            <div>
                                <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-2">{UI_LABELS.POSITION_CURRENT}</p>
                                <p className="text-sm text-zinc-400 leading-relaxed">{reportData.positioning.current}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-2">{UI_LABELS.POSITION_TARGET}</p>
                                <p className="text-sm text-white font-medium leading-relaxed">{reportData.positioning.target}</p>
                            </div>
                        </div>
                        <div className="border-t border-white/[0.04] pt-5 space-y-4">
                            <div>
                                <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-2">{UI_LABELS.POSITION_GAP}</p>
                                <p className="text-sm text-amber-400/80 leading-relaxed">{reportData.positioning.gap}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-2">{UI_LABELS.POSITION_STRATEGY}</p>
                                <p className="text-sm text-zinc-300 leading-relaxed">{reportData.positioning.strategy}</p>
                            </div>
                        </div>
                    </div>
                </section>
            </article>

            {/* ================================================================= */}
            {/* ACT 3: LINE-BY-LINE ANALYSIS (Split View) */}
            {/* ================================================================= */}
            <section className="py-16 border-b border-white/10 max-w-[1440px] mx-auto px-6 md:px-10">
                <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-3">{UI_LABELS.DETAILED_DIAGNOSIS}</h2>
                <h3 className="text-2xl sm:text-3xl font-medium text-white mb-6 tracking-tight">{UI_LABELS.LINE_BY_LINE_ANALYSIS}</h3>

                {/* Tab buttons */}
                <div className="flex items-center gap-1 mb-5">
                    {reportData.questionTabs.map((tab, index) => (
                        <button key={tab.id} onClick={() => handleTabChange(index)}
                            className={`px-5 py-2 text-sm rounded-lg transition-all ${activeTab === index ? "bg-white/[0.08] text-white font-medium" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"}`}>
                            {tab.title}
                        </button>
                    ))}
                </div>

                {/* Split View */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-0 border border-white/[0.06] rounded-2xl overflow-hidden" style={{ minHeight: '620px' }}>

                    {/* LEFT PANEL */}
                    <div className="border-r border-white/[0.06] flex flex-col bg-zinc-900/20">
                        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                            <p className="text-[11px] text-zinc-500 uppercase tracking-widest">{UI_LABELS.FEEDBACK}</p>
                            <div className="flex bg-zinc-800/60 rounded-lg p-0.5">
                                <button onClick={() => setViewMode('focus')}
                                    className={`px-3 py-1 text-[11px] rounded-md transition-all ${viewMode === 'focus' ? 'bg-zinc-700 text-white font-medium shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                    {UI_LABELS.VIEW_MODE_FOCUS}
                                </button>
                                <button onClick={() => setViewMode('list')}
                                    className={`px-3 py-1 text-[11px] rounded-md transition-all ${viewMode === 'list' ? 'bg-zinc-700 text-white font-medium shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                    {UI_LABELS.VIEW_MODE_LIST}
                                </button>
                            </div>
                        </div>

                        {/* Subtitle diagnosis */}
                        <div className="border-b border-white/[0.06] shrink-0">
                            <button onClick={() => setShowSubtitle(!showSubtitle)}
                                className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors">
                                <span className="text-[11px] text-zinc-500 uppercase tracking-widest">{UI_LABELS.SUBTITLE_DIAGNOSIS}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${showSubtitle ? 'rotate-180' : ''}`} />
                            </button>
                            {showSubtitle && (
                                <div className="px-5 pb-4 space-y-2">
                                    {currentTab.subtitleDiagnosis.exists ? (
                                        <>
                                            <p className="text-xs text-zinc-500 leading-relaxed">"{currentTab.subtitleDiagnosis.original}"</p>
                                            <p className="text-sm text-white font-semibold leading-[1.6]">{currentTab.subtitleDiagnosis.suggestion}</p>
                                            <p className="text-xs text-zinc-500 leading-relaxed">{currentTab.subtitleDiagnosis.feedback}</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-xs text-zinc-500 leading-relaxed">{currentTab.subtitleDiagnosis.feedback}</p>
                                            <p className="text-sm text-white font-semibold whitespace-pre-wrap leading-[1.6]">{currentTab.subtitleDiagnosis.suggestion}</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Overview */}
                        <div className="px-5 py-3 border-b border-white/[0.06] shrink-0">
                            <p className="text-xs text-zinc-500 leading-relaxed">{currentTab.overview}</p>
                        </div>

                        {/* Feedback Cards */}
                        <div className="flex-1 overflow-y-auto">
                            {viewMode === 'focus' && activeCardIndex === null && (
                                <div className="flex items-center justify-center h-full px-6">
                                    <p className="text-sm text-zinc-600 text-center leading-relaxed whitespace-pre-wrap">{UI_LABELS.CLICK_HIGHLIGHT_GUIDE}</p>
                                </div>
                            )}
                            <div className="p-4 space-y-3">
                                {visibleCards.map((card: any, idx: number) => {
                                    const realIdx = viewMode === 'focus' && activeCardIndex !== null ? activeCardIndex : idx
                                    const isActive = activeCardIndex === realIdx
                                    return (
                                        <div key={realIdx} onClick={() => setActiveCardIndex(realIdx)}
                                            className={`rounded-xl overflow-hidden cursor-pointer transition-all ${isActive ? 'border border-[#6366F1]/40 shadow-lg shadow-[#6366F1]/5 bg-zinc-800/50' : 'border border-white/[0.06] bg-zinc-800/30 hover:border-white/[0.12] shadow-sm shadow-black/10'}`}>
                                            <div className="px-4 pt-3.5 pb-2.5 flex items-start gap-3">
                                                <span className={`shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5 ${isActive ? 'bg-[#6366F1] text-white' : 'bg-[#6366F1]/60 text-white/80'}`}>
                                                    {realIdx + 1}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] text-zinc-600 tracking-wider uppercase mb-1.5">{UI_LABELS.ORIGINAL_SENTENCE}</p>
                                                    <p className="text-xs text-zinc-500 leading-relaxed">"{card.original}"</p>
                                                </div>
                                            </div>
                                            <div className="border-l-2 border-[#6366F1] bg-[#6366F1]/[0.05] px-4 py-3">
                                                <p className="text-[10px] text-zinc-600 tracking-wider uppercase mb-1.5">{UI_LABELS.AI_DIAGNOSIS}</p>
                                                <p className="text-xs text-zinc-400 leading-relaxed">
                                                    {card.type === 'improvement' ? card.feedback : card.praisePoint}
                                                </p>
                                            </div>
                                            {/* Interview Link */}
                                            {card.interviewLink && (
                                                <div className="px-4 py-2.5 bg-amber-500/[0.04] border-t border-amber-500/[0.08]">
                                                    <p className="text-[10px] text-amber-400/70 tracking-wider uppercase mb-1">{UI_LABELS.INTERVIEW_ATTACK_POINT}</p>
                                                    <p className="text-xs text-zinc-400 leading-relaxed">"{card.interviewLink.question}"</p>
                                                </div>
                                            )}
                                            <div className="px-4 pt-3 pb-3.5 border-t border-white/[0.04]">
                                                <p className="text-[10px] text-zinc-600 tracking-wider uppercase mb-1.5">{card.type === 'improvement' ? UI_LABELS.IMPROVED_SENTENCE : UI_LABELS.VERDICT}</p>
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="text-sm text-white font-semibold leading-[1.6] flex-1">
                                                        {card.type === 'improvement' ? card.suggestion : card.original}
                                                    </p>
                                                    <button onClick={(e) => { e.stopPropagation(); setAiLogicModal({ isOpen: true, original: card.original, feedback: card.type === 'praise' ? card.praisePoint : card.feedback, suggestion: card.type === 'improvement' ? card.suggestion : undefined, type: card.type, interviewLink: card.interviewLink }) }}
                                                        className="shrink-0 text-[11px] text-zinc-400 px-3 py-1.5 rounded-lg border border-zinc-600/80 hover:border-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] transition-all mt-0.5 font-medium">
                                                        {UI_LABELS.DETAIL_VIEW}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div className="flex flex-col">
                        <div className="px-6 py-3.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                            <p className="text-[11px] text-zinc-500 uppercase tracking-widest">{UI_LABELS.ORIGINAL_TEXT_PANEL}</p>
                            <p className="text-[11px] text-zinc-600">{currentTab.title}</p>
                        </div>
                        <div className="mx-6 mt-4 mb-2 px-4 py-3 bg-zinc-800/40 rounded-lg border border-white/[0.04] shrink-0">
                            <p className="text-[11px] text-zinc-600 mb-1">{UI_LABELS.QUESTION}</p>
                            <p className="text-sm text-zinc-400 leading-relaxed">{currentTab.prompt}</p>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            <div className="text-sm text-zinc-400 leading-[1.8] whitespace-pre-wrap">
                                {currentTab.fullAnswer.split('\n').map((paragraph, pIdx) => (
                                    <p key={pIdx} className="mb-3">
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
                                                    const isActive = activeCardIndex === matchedCardIdx
                                                    result.push(
                                                        <span key={`hl-${pIdx}-${keyCounter++}`} onClick={() => setActiveCardIndex(matchedCardIdx)}
                                                            className={`cursor-pointer relative inline rounded-sm px-0.5 -mx-0.5 transition-all duration-200 ${isActive ? 'bg-[#6366F1]/35 text-white ring-1 ring-[#6366F1]/50' : 'bg-[#6366F1]/[0.12] text-zinc-300 hover:bg-[#6366F1]/25 hover:text-white'}`}>
                                                            <span className="absolute -top-3.5 -left-0.5 w-[18px] h-[18px] rounded-full bg-[#6366F1] text-white text-[9px] font-bold flex items-center justify-center shadow-sm shadow-[#6366F1]/30">
                                                                {matchedCardIdx + 1}
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
                        </div>
                    </div>
                </div>
            </section>

            <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10">

                {/* ================================================================= */}
                {/* ACT 4: INTERVIEW DRILL */}
                {/* ================================================================= */}
                <section className="py-20 border-b border-white/10">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">{UI_LABELS.INTERVIEW_DRILL}</h2>
                    <h3 className="text-2xl sm:text-3xl font-medium text-white mb-5 tracking-tight">{UI_LABELS.INTERVIEW_DRILL_TITLE}</h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-relaxed">{UI_LABELS.INTERVIEW_DRILL_DESC}</p>

                    <div className="space-y-2">
                        {reportData.interviewQA.map((item, index) => (
                            <div key={index} className="border-b border-white/5 last:border-0">
                                <button onClick={() => setOpenQuestionIndex(openQuestionIndex === index ? null : index)}
                                    className="w-full py-6 flex items-start gap-5 text-left group">
                                    <span className="text-[11px] uppercase tracking-widest text-zinc-500 mt-1 min-w-[50px]">Q{index + 1}</span>
                                    <span className="flex-1 text-base text-zinc-300 group-hover:text-white transition-colors leading-relaxed">{item.question}</span>
                                    <ChevronDown className={`w-5 h-5 text-zinc-600 transition-transform mt-0.5 ${openQuestionIndex === index ? "rotate-180" : ""}`} />
                                </button>
                                {openQuestionIndex === index && (
                                    <div className="pb-8 pl-[70px] space-y-4">
                                        {/* Follow-ups */}
                                        {item.followUps && item.followUps.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-[11px] uppercase tracking-widest text-amber-400/60 mb-2">{UI_LABELS.FOLLOW_UP_QUESTIONS}</p>
                                                <ul className="space-y-1.5">
                                                    {item.followUps.map((fu, fi) => (
                                                        <li key={fi} className="text-sm text-zinc-500 leading-relaxed flex items-start gap-2">
                                                            <ArrowRight className="w-3 h-3 text-amber-400/40 mt-1 shrink-0" />{fu}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-3">{UI_LABELS.MODEL_ANSWER}</p>
                                        <p className="text-sm text-zinc-400 leading-loose">{item.modelAnswer}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* ================================================================= */}
                {/* ACT 5: ACTION PLAN */}
                {/* ================================================================= */}
                <section className="py-20 border-b border-white/10">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">{UI_LABELS.ACTION_PLAN}</h2>
                    <h3 className="text-2xl sm:text-3xl font-medium text-white mb-5 tracking-tight">{UI_LABELS.ACTION_PLAN_TITLE}</h3>

                    <div className="flex items-center gap-5 mb-14 mt-10">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-zinc-400 transition-all duration-500" style={{ width: `${taskProgress}%` }} />
                        </div>
                        <span className="text-sm text-zinc-500 tabular-nums">{completedTasks.length}/{reportData.actionPlan.length}</span>
                    </div>

                    <div className="space-y-2">
                        {reportData.actionPlan.map((task, index) => {
                            const isComplete = completedTasks.includes(index)
                            return (
                                <button key={index} onClick={() => toggleTask(index)} className="w-full text-left py-5 flex items-start gap-5 group">
                                    <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors mt-0.5 ${isComplete ? "bg-zinc-300 border-zinc-300" : "border-zinc-600 group-hover:border-zinc-400"}`}>
                                        {isComplete && <Check className="w-3 h-3 text-zinc-900" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className={`text-base transition-colors leading-relaxed block mb-1 ${isComplete ? "line-through text-zinc-600" : "text-zinc-200 group-hover:text-white"}`}>{task.title}</span>
                                        <p className={`text-sm transition-colors leading-relaxed ${isComplete ? "text-zinc-700" : "text-zinc-500"}`}>{task.description}</p>
                                        <p className={`text-xs mt-2 transition-colors ${isComplete ? "text-zinc-700" : "text-emerald-500/60"}`}>{UI_LABELS.EXPECTED_IMPACT}: {task.expectedImpact}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </section>

                {/* ================================================================= */}
                {/* ACT 6: PM COMMENT */}
                {/* ================================================================= */}
                <section className="py-20 border-b border-white/10">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">{UI_LABELS.PM_VERDICT}</h2>
                    <h3 className="text-2xl sm:text-3xl font-medium text-white mb-10 tracking-tight">{UI_LABELS.PM_VERDICT_TITLE}</h3>
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-zinc-300 text-xs font-bold tracking-tight">PM</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-sm font-medium text-white">PM Yehwan</span>
                                <span className="text-xs text-zinc-600">{UI_LABELS.JUST_NOW}</span>
                            </div>
                            <div className="border-l-2 border-zinc-700 pl-5">
                                <p className="text-sm text-zinc-400 leading-loose">{reportData.pmComment}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ================================================================= */}
                {/* PREMIUM UPSELL */}
                {/* ================================================================= */}
                <section className="py-20">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">{UI_LABELS.PREMIUM}</h2>
                    <h3 className="text-2xl sm:text-3xl font-medium text-white mb-5 tracking-tight">{UI_LABELS.PREMIUM_NEXT_STEPS}</h3>
                    <p className="text-base text-zinc-400 mb-12 max-w-2xl leading-relaxed">{UI_LABELS.PREMIUM_DESC}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="group relative bg-zinc-900/40 border border-white/[0.06] rounded-xl p-8 hover:border-white/[0.15] transition-all duration-300">
                            <div className="w-10 h-10 rounded-lg bg-zinc-800/80 flex items-center justify-center mb-6">
                                <FileText className="w-5 h-5 text-zinc-400" />
                            </div>
                            <h4 className="text-lg font-medium text-white mb-3">{UI_LABELS.PAST_QUESTIONS}</h4>
                            <p className="text-sm text-zinc-500 leading-relaxed mb-8">{UI_LABELS.PAST_QUESTIONS_DESC}</p>
                            <button className="text-sm text-zinc-300 hover:text-white transition-colors flex items-center gap-2 group/btn">
                                <span>{UI_LABELS.GO_TO}</span><ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>
                        <div className="group relative bg-zinc-900/40 border border-white/[0.06] rounded-xl p-8 hover:border-zinc-400/30 transition-all duration-300">
                            <div className="w-10 h-10 rounded-lg bg-zinc-800/80 flex items-center justify-center mb-6 border border-zinc-500/20">
                                <Sparkles className="w-5 h-5 text-zinc-300" />
                            </div>
                            <h4 className="text-lg font-medium text-white mb-3">{UI_LABELS.EXPERT_REVIEW}</h4>
                            <p className="text-sm text-zinc-500 leading-relaxed mb-8">{UI_LABELS.EXPERT_REVIEW_DESC}</p>
                            <button className="text-sm text-zinc-300 hover:text-white transition-colors flex items-center gap-2 group/btn">
                                <span>{UI_LABELS.APPLY_PREMIUM}</span><ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </section>

                {/* NEXT STEP */}
                <section className="py-16 mt-10 bg-zinc-900/80 rounded-2xl border border-white/[0.04] px-6 md:px-10 text-center">
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

            {/* ================================================================= */}
            {/* AI LOGIC DETAIL MODAL */}
            {/* ================================================================= */}
            {aiLogicModal?.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setAiLogicModal(null)}>
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] shrink-0">
                            <div>
                                <p className="text-[11px] text-zinc-500 uppercase tracking-widest mb-1">{UI_LABELS.ANALYSIS_LOGIC}</p>
                                <h3 className="text-base font-medium text-white">{UI_LABELS.DIAGNOSIS_DETAIL}</h3>
                            </div>
                            <button onClick={() => setAiLogicModal(null)} className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-6 py-5 overflow-y-auto space-y-5">
                            <div>
                                <div className="flex items-center gap-2.5 mb-3">
                                    <span className="text-[11px] text-zinc-500 font-medium tabular-nums">01</span>
                                    <span className="text-sm font-medium text-zinc-300">{UI_LABELS.ORIGINAL_ANALYSIS}</span>
                                </div>
                                <div className="ml-7 border-l border-white/[0.06] pl-4">
                                    <p className="text-sm text-zinc-300 leading-relaxed">"{aiLogicModal.original}"</p>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5 mb-3">
                                    <span className="text-[11px] text-zinc-500 font-medium tabular-nums">02</span>
                                    <span className="text-sm font-medium text-zinc-300">{aiLogicModal.type === "praise" ? UI_LABELS.STRENGTHS : UI_LABELS.IMPROVED_SENTENCE}</span>
                                </div>
                                <div className="ml-7 border-l border-[#6B8AFF]/30 pl-4 space-y-4">
                                    <p className="text-sm text-zinc-400 leading-relaxed">{aiLogicModal.feedback}</p>
                                    {aiLogicModal.suggestion && (
                                        <div className="pt-2 border-t border-white/[0.04]">
                                            <p className="text-base text-white font-semibold leading-relaxed">{aiLogicModal.suggestion}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {aiLogicModal.interviewLink && (
                                <div>
                                    <div className="flex items-center gap-2.5 mb-3">
                                        <span className="text-[11px] text-zinc-500 font-medium tabular-nums">03</span>
                                        <span className="text-sm font-medium text-amber-400/80">{UI_LABELS.INTERVIEW_ATTACK_POINT}</span>
                                    </div>
                                    <div className="ml-7 border-l border-amber-400/20 pl-4 space-y-2">
                                        <p className="text-sm text-zinc-300 leading-relaxed">"{aiLogicModal.interviewLink.question}"</p>
                                        <p className="text-xs text-zinc-500 leading-relaxed">{aiLogicModal.interviewLink.intent}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
