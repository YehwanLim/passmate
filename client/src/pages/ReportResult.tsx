
import { useState } from "react"
import { X, Check, ChevronDown, ArrowRight, FileText, Sparkles } from "lucide-react"

// =============================================================================
// DATA
// =============================================================================

const factChecks = [
    {
        status: "warning",
        original: "프로젝트를 통해 많은 것을 배웠고 좋은 결과를 얻었습니다.",
        issue: "추상적 표현",
        suggestion: "구체적인 학습 내용과 정량적 결과를 명시하세요"
    },
    {
        status: "success",
        original: "3주간 A/B 테스트를 통해 이탈률을 35%에서 18%로 개선",
        issue: null,
        suggestion: "검증 가능한 수치와 기간이 명확하게 제시됨"
    },
    {
        status: "warning",
        original: "팀원들과 협력하여 성공적으로 프로젝트를 완수했습니다.",
        issue: "모호한 기여도",
        suggestion: "본인의 구체적인 역할과 기여 내용을 명시하세요"
    }
]

const skills = [
    { name: "문제 해결", score: 92 },
    { name: "데이터 분석", score: 78 },
    { name: "협업/리더십", score: 65 },
    { name: "기획력", score: 45 },
]

const keywords = {
    matched: ["문제정의", "가설검증", "정량분석", "A/B테스트"],
    missing: ["UX리서치", "프레젠테이션"],
}

const examples = [
    {
        before: "프로젝트에서 좋은 성과를 거두었습니다.",
        after: "3개월간 MAU를 12만에서 28만으로 133% 성장시켰습니다.",
        improvement: "정량적 지표 추가"
    },
    {
        before: "다양한 팀원들과 협업하며 많은 것을 배웠습니다.",
        after: "5명의 개발팀과 주 2회 스프린트 회의를 주도하며 출시 일정을 2주 앞당겼습니다.",
        improvement: "구체적 역할 명시"
    },
    {
        before: "문제 해결 능력이 뛰어납니다.",
        after: "결제 오류율 23%를 분석하여 3가지 핵심 원인을 도출, 오류율을 2%로 감소시켰습니다.",
        improvement: "문제-해결 프로세스 서술"
    }
]

const questions = [
    {
        difficulty: "상",
        question: "이탈률 개선 시 고려한 주요 변수는?",
        answer: "이탈률 개선 시 크게 세 가지 변수를 고려했습니다. 첫째, 유저 세그먼트별 이탈 시점 분석을 통해 온보딩 3일차에 급격한 이탈이 발생함을 확인했습니다. 둘째, 기능별 사용률 데이터를 분석하여 핵심 기능 발견율이 23%에 불과함을 파악했습니다. 셋째, 경쟁사 벤치마킹을 통해 푸시 알림 전략의 차이점을 발견했습니다."
    },
    {
        difficulty: "중",
        question: "A/B 테스트 외 대안 방법론은?",
        answer: "A/B 테스트 외에도 다변량 테스트(MVT), 코호트 분석, 퍼널 분석 등을 활용할 수 있습니다. 특히 표본 크기가 작은 경우 베이지안 접근법을 적용하거나, 정성적 데이터가 필요할 때는 사용자 인터뷰와 세션 리플레이를 병행합니다."
    },
    {
        difficulty: "상",
        question: "팀 내 반대 의견은 어떻게 설득했나요?",
        answer: "반대 의견이 있을 때는 먼저 상대방의 우려사항을 명확히 이해하려 노력합니다. 이후 데이터 기반의 근거를 제시하고, 작은 규모의 파일럿 테스트를 제안하여 리스크를 최소화하는 방식으로 합의점을 찾습니다. 실제로 UI 개편 프로젝트에서 이 방식으로 반대하던 시니어 개발자를 설득했습니다."
    },
    {
        difficulty: "하",
        question: "프로젝트에서 가장 큰 성과는 무엇인가요?",
        answer: "이탈률을 35%에서 18%로 감소시킨 것이 가장 큰 성과입니다. 이는 월간 활성 사용자 기준으로 약 4만 명의 추가 리텐션 효과를 가져왔으며, 연간 매출로 환산하면 약 8억 원의 가치를 창출한 것으로 추정됩니다."
    }
]

const tasks = [
    {
        priority: "High",
        title: "추상적 표현 3개 문장 수정",
        description: "섹션 1에서 지적된 문장들을 구체적 수치와 함께 재작성"
    },
    {
        priority: "High",
        title: "누락된 JD 키워드 보완",
        description: "UX리서치, 프레젠테이션 관련 경험 추가 서술"
    },
    {
        priority: "Medium",
        title: "기획력 역량 강화",
        description: "기획 과정에서의 의사결정 및 문서화 경험 보강"
    },
    {
        priority: "Medium",
        title: "면접 예상 질문 5회 모의 연습",
        description: "특히 난이도 '상' 질문에 대한 답변 구조화"
    },
    {
        priority: "Low",
        title: "전체 맞춤법 및 문장 흐름 검토",
        description: "최종 제출 전 교정 작업 수행"
    }
]

// =============================================================================
// STYLE MAPS
// =============================================================================

const difficultyStyles = {
    "상": "text-red-400",
    "중": "text-amber-400",
    "하": "text-zinc-400"
}

const priorityStyles = {
    "High": "text-cyan-400",
    "Medium": "text-zinc-400",
    "Low": "text-zinc-500"
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface PassMateReportProps {
    userName?: string
    role?: string
    targetCompany?: string
}

export default function PassMateReport({
    userName = "김민준",
    role = "서비스 PM",
    targetCompany = "삼성전자"
}: PassMateReportProps) {
    const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(0)
    const [completedTasks, setCompletedTasks] = useState<number[]>([])

    const toggleTask = (index: number) => {
        setCompletedTasks(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        )
    }

    const taskProgress = Math.round((completedTasks.length / tasks.length) * 100)

    return (
        <main className="min-h-screen bg-[#09090B] text-zinc-100">
            <article className="max-w-3xl mx-auto px-6 md:px-8">

                {/* ================================================================= */}
                {/* HEADER */}
                {/* ================================================================= */}
                <header className="pt-16 pb-12 border-b border-white/10">
                    <div className="flex items-center gap-3 text-zinc-500 text-sm tracking-wide mb-10">
                        <span className="font-medium">PassMate</span>
                        <span className="text-zinc-700">/</span>
                        <span>Insight Report</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white tracking-tight leading-tight md:leading-tight text-balance mb-6">
                        <span className="text-cyan-400">{userName}</span>님의 합격에 한발짝 다가가기 위한
                        <br className="hidden sm:block" />
                        <span className="sm:hidden"> </span>
                        자기소개서 분석 리포트
                    </h1>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-400">
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-600">ROLE</span>
                            <span className="text-zinc-300">{role}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-600">TARGET</span>
                            <span className="text-zinc-300">{targetCompany}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 mt-10 text-sm text-zinc-500">
                        <span>Generated on April 27, 2026</span>
                        <span className="text-zinc-700">·</span>
                        <span>Reading time: 8 min</span>
                    </div>
                </header>

                {/* ================================================================= */}
                {/* EXECUTIVE SUMMARY */}
                {/* ================================================================= */}
                <section className="py-20">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-10">
                        Executive Summary
                    </h2>

                    <div className="space-y-10">
                        <div className="flex items-baseline gap-8">
                            <span className="text-8xl md:text-9xl font-light text-cyan-400 tabular-nums tracking-tight">
                                78
                            </span>
                            <div>
                                <p className="text-2xl text-white mb-2 tracking-tight">Overall Score</p>
                                <p className="text-base text-zinc-400 leading-relaxed">상위 22% 수준의 자기소개서입니다</p>
                            </div>
                        </div>

                        <p className="text-lg md:text-xl text-zinc-400 leading-relaxed max-w-3xl">
                            전반적으로 구조화된 서술과 구체적인 수치 제시가 강점입니다.
                            다만, 일부 경험의 검증 가능성과 JD 핵심 키워드 매칭률에서 개선 여지가 있습니다.
                            아래 분석을 통해 구체적인 보완 방향을 확인하세요.
                        </p>
                    </div>

                    {/* Hero Branding Quote */}
                    <div className="mt-20 pt-14 border-t border-white/5">
                        <div className="relative pl-10">
                            <span className="absolute left-0 top-0 text-6xl text-zinc-700 font-serif leading-none select-none">
                                &ldquo;
                            </span>
                            <p className="text-xl md:text-2xl lg:text-3xl text-zinc-300 italic leading-relaxed max-w-2xl">
                                데이터 분석으로 문제를 찾고, A/B 테스트로 해답을 증명하는 그로스 PM
                            </p>
                            <p className="mt-6 text-sm text-zinc-500">
                                — 귀하의 핵심 포지셔닝 문장
                            </p>
                        </div>
                    </div>

                    <hr className="border-white/10 mt-20" />
                </section>

                {/* ================================================================= */}
                {/* SECTION 01: FACT CHECK */}
                {/* ================================================================= */}
                <section className="py-20">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">
                        Section 01
                    </h2>
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-medium text-white mb-5 tracking-tight">
                        경험 팩트 체크
                    </h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-relaxed">
                        자기소개서에서 발견된 주요 문장들의 검증 가능성을 분석했습니다.
                    </p>

                    <div className="space-y-10">
                        {factChecks.map((item, index) => (
                            <div key={index} className="group">
                                <div className="flex items-start gap-5">
                                    <div className={`mt-1.5 flex-shrink-0 ${item.status === "success" ? "text-cyan-400" : "text-red-400"
                                        }`}>
                                        {item.status === "success" ? (
                                            <Check className="w-5 h-5" />
                                        ) : (
                                            <X className="w-5 h-5" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <blockquote className="text-lg md:text-xl text-zinc-300 leading-relaxed mb-4 border-l-2 border-zinc-700 pl-5">
                                            {`"${item.original}"`}
                                        </blockquote>

                                        {item.issue && (
                                            <p className="text-sm text-red-400/80 mb-3 leading-relaxed">
                                                Issue: {item.issue}
                                            </p>
                                        )}

                                        <p className="text-base text-zinc-500 leading-relaxed">
                                            {item.suggestion}
                                        </p>
                                    </div>
                                </div>

                                {index < factChecks.length - 1 && (
                                    <hr className="border-white/5 mt-10" />
                                )}
                            </div>
                        ))}
                    </div>

                    <hr className="border-white/10 mt-20" />
                </section>

                {/* ================================================================= */}
                {/* SECTION 02: JD ANALYSIS */}
                {/* ================================================================= */}
                <section className="py-20">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">
                        Section 02
                    </h2>
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-medium text-white mb-5 tracking-tight">
                        JD 매칭 분석
                    </h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-relaxed">
                        지원하신 직무의 Job Description과 자기소개서의 매칭 정도를 분석했습니다.
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20">
                        {/* Skill Match */}
                        <div>
                            <h4 className="text-base text-zinc-300 mb-8 tracking-tight">역량별 매칭률</h4>
                            <div className="space-y-6">
                                {skills.map((skill) => (
                                    <div key={skill.name}>
                                        <div className="flex justify-between text-base mb-3">
                                            <span className="text-zinc-300">{skill.name}</span>
                                            <span className={`tabular-nums font-medium ${skill.score >= 80 ? "text-cyan-400" :
                                                    skill.score >= 60 ? "text-zinc-400" : "text-zinc-500"
                                                }`}>
                                                {skill.score}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${skill.score >= 80 ? "bg-cyan-400" :
                                                        skill.score >= 60 ? "bg-zinc-500" : "bg-zinc-600"
                                                    }`}
                                                style={{ width: `${skill.score}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Keywords */}
                        <div>
                            <h4 className="text-base text-zinc-300 mb-8 tracking-tight">키워드 분석</h4>

                            <div className="mb-8">
                                <p className="text-sm text-zinc-500 uppercase tracking-wide mb-4">Matched</p>
                                <div className="flex flex-wrap gap-3">
                                    {keywords.matched.map((keyword) => (
                                        <span
                                            key={keyword}
                                            className="px-4 py-2 text-base text-cyan-400 border border-cyan-400/30 rounded-lg"
                                        >
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="text-sm text-zinc-500 uppercase tracking-wide mb-4">Missing</p>
                                <div className="flex flex-wrap gap-3">
                                    {keywords.missing.map((keyword) => (
                                        <span
                                            key={keyword}
                                            className="px-4 py-2 text-base text-zinc-500 border border-zinc-700 rounded-lg"
                                        >
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-white/10 mt-20" />
                </section>

                {/* ================================================================= */}
                {/* SECTION 03: BEFORE/AFTER */}
                {/* ================================================================= */}
                <section className="py-20">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">
                        Section 03
                    </h2>
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-medium text-white mb-5 tracking-tight">
                        문장 개선 제안
                    </h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-relaxed">
                        추상적인 표현을 구체적이고 검증 가능한 문장으로 개선한 예시입니다.
                    </p>

                    <div className="space-y-14">
                        {examples.map((example, index) => (
                            <div key={index}>
                                <p className="text-sm text-zinc-600 uppercase tracking-wide mb-5">
                                    Example {String(index + 1).padStart(2, '0')}
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-5 items-start">
                                    <div>
                                        <p className="text-sm text-zinc-500 mb-3">Before</p>
                                        <p className="text-base text-zinc-500 leading-relaxed line-through decoration-zinc-700">
                                            {example.before}
                                        </p>
                                    </div>

                                    <div className="hidden md:flex items-center justify-center h-full pt-8">
                                        <ArrowRight className="w-5 h-5 text-zinc-600" />
                                    </div>

                                    <div>
                                        <p className="text-sm text-cyan-400/70 mb-3">After</p>
                                        <p className="text-base text-zinc-200 leading-relaxed">
                                            {example.after}
                                        </p>
                                    </div>
                                </div>

                                <p className="text-sm text-zinc-500 mt-5">
                                    Improvement: {example.improvement}
                                </p>

                                {index < examples.length - 1 && (
                                    <hr className="border-white/5 mt-10" />
                                )}
                            </div>
                        ))}
                    </div>

                    <hr className="border-white/10 mt-20" />
                </section>

                {/* ================================================================= */}
                {/* SECTION 04: INTERVIEW QUESTIONS */}
                {/* ================================================================= */}
                <section className="py-20">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">
                        Section 04
                    </h2>
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-medium text-white mb-5 tracking-tight">
                        예상 꼬리 질문
                    </h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-relaxed">
                        자기소개서 내용을 기반으로 면접에서 받을 수 있는 질문과 모범 답변입니다.
                    </p>

                    <div className="space-y-2">
                        {questions.map((item, index) => (
                            <div
                                key={index}
                                className="border-b border-white/5 last:border-0"
                            >
                                <button
                                    onClick={() => setOpenQuestionIndex(openQuestionIndex === index ? null : index)}
                                    className="w-full py-6 flex items-start gap-5 text-left group"
                                >
                                    <span className={`text-sm font-medium mt-0.5 min-w-[60px] ${difficultyStyles[item.difficulty as keyof typeof difficultyStyles]}`}>
                                        난이도 {item.difficulty}
                                    </span>

                                    <span className="flex-1 text-base text-zinc-200 group-hover:text-white transition-colors leading-relaxed">
                                        {item.question}
                                    </span>

                                    <ChevronDown
                                        className={`w-5 h-5 text-zinc-500 transition-transform mt-0.5 ${openQuestionIndex === index ? "rotate-180" : ""
                                            }`}
                                    />
                                </button>

                                {openQuestionIndex === index && (
                                    <div className="pb-8 pl-[80px]">
                                        <p className="text-sm text-cyan-400/70 mb-3">Model Answer</p>
                                        <p className="text-base text-zinc-400 leading-loose">
                                            {item.answer}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <p className="text-sm text-zinc-600 mt-10">
                        * 모범 답변 가이드 포함
                    </p>

                    <hr className="border-white/10 mt-20" />
                </section>

                {/* ================================================================= */}
                {/* SECTION 05: ACTION PLAN */}
                {/* ================================================================= */}
                <section className="py-20">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">
                        Section 05
                    </h2>
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-medium text-white mb-5 tracking-tight">
                        Action Plan
                    </h3>
                    <p className="text-base text-zinc-400 mb-10 max-w-2xl leading-relaxed">
                        분석 결과를 바탕으로 권장하는 개선 작업 목록입니다.
                    </p>

                    <div className="flex items-center gap-5 mb-14">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-cyan-400 transition-all duration-500"
                                style={{ width: `${taskProgress}%` }}
                            />
                        </div>
                        <span className="text-base text-zinc-500 tabular-nums">
                            {completedTasks.length}/{tasks.length}
                        </span>
                    </div>

                    <div className="space-y-2">
                        {tasks.map((task, index) => {
                            const isComplete = completedTasks.includes(index)

                            return (
                                <button
                                    key={index}
                                    onClick={() => toggleTask(index)}
                                    className="w-full text-left py-5 flex items-start gap-5 group"
                                >
                                    <div className={`w-6 h-6 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors mt-0.5 ${isComplete
                                            ? "bg-cyan-400 border-cyan-400"
                                            : "border-zinc-700 group-hover:border-zinc-500"
                                        }`}>
                                        {isComplete && <Check className="w-4 h-4 text-zinc-900" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-4 mb-2">
                                            <span className={`text-sm ${priorityStyles[task.priority as keyof typeof priorityStyles]}`}>
                                                {task.priority}
                                            </span>
                                            <span className={`text-base transition-colors leading-relaxed ${isComplete ? "line-through text-zinc-600" : "text-zinc-200 group-hover:text-white"
                                                }`}>
                                                {task.title}
                                            </span>
                                        </div>
                                        <p className={`text-base transition-colors leading-relaxed ${isComplete ? "text-zinc-700" : "text-zinc-500"
                                            }`}>
                                            {task.description}
                                        </p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    <hr className="border-white/10 mt-20" />
                </section>

                {/* ================================================================= */}
                {/* SECTION 06: PM FINAL ADVICE (Chat Style) */}
                {/* ================================================================= */}
                <section className="py-20">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">
                        Section 06
                    </h2>
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-medium text-white mb-5 tracking-tight">
                        PM 예환의 파이널 코멘트
                    </h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-relaxed">
                        현직 PM이 리포트를 직접 검토한 뒤 남기는 실무 관점의 마지막 조언입니다.
                    </p>

                    <div className="space-y-10">
                        {/* Message 1 */}
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold tracking-tight">PM</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-base font-semibold text-white">PM 예환</span>
                                    <span className="text-xs text-zinc-600">방금 전</span>
                                </div>
                                <div className="border-l-2 border-cyan-500/40 pl-5">
                                    <p className="text-base text-zinc-300 leading-loose">
                                        실무자 관점에서 아쉬운 점이 하나 있네요. 경험의 구체성은 좋지만, <span className="text-cyan-400 font-medium">'왜 우리 회사인가?'</span>에 대한 답이 빠져 있어요. 실무진은 이 부분을 꽤 중요하게 봅니다.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Message 2 */}
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold tracking-tight">PM</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-base font-semibold text-white">PM 예환</span>
                                    <span className="text-xs text-zinc-600">방금 전</span>
                                </div>
                                <div className="border-l-2 border-cyan-500/40 pl-5">
                                    <p className="text-base text-zinc-300 leading-loose">
                                        팁 하나 드리면, 마지막 문단에서 '귀사의 데이터 분석팀'이라고만 쓰지 말고, <span className="text-cyan-400 font-medium">해당 회사가 최근 진행한 프로젝트나 비전을 언급</span>하면서 연결해 보세요. 면접에서도 이 부분을 질문할 확률이 높아요!
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-white/10 mt-20" />
                </section>

                {/* ================================================================= */}
                {/* PREMIUM UPSELL */}
                {/* ================================================================= */}
                <section className="py-24">
                    <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">
                        Next Step
                    </h2>
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-medium text-white mb-5 tracking-tight">
                        합격을 위한 프리미엄 Next Step
                    </h3>
                    <p className="text-base text-zinc-400 mb-16 max-w-2xl leading-relaxed">
                        AI 분석을 넘어, 실제 합격자들의 데이터와 현직자의 전문 코칭으로 한 단계 더 도약하세요.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Card 1: Content Upsell */}
                        <div className="group relative bg-white/[0.02] border border-white/[0.08] rounded-lg p-8 md:p-10 hover:border-white/[0.15] transition-all duration-300">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-8">
                                    <FileText className="w-6 h-6 text-zinc-400" />
                                </div>

                                <h4 className="text-xl font-medium text-white mb-4 tracking-tight">
                                    기출 면접 문제 모아보기
                                </h4>

                                <p className="text-base text-zinc-400 leading-relaxed mb-10">
                                    수만 건의 합격 데이터를 바탕으로 실제 기출된 면접 질문 리스트와 현직자 방어 스크립트 핵심을 확인하세요.
                                </p>

                                <button className="w-full py-4 px-5 text-base text-zinc-300 border border-zinc-700 rounded-lg hover:border-zinc-500 hover:text-white transition-all duration-200 flex items-center justify-center gap-3 group/btn">
                                    <span>면접 기출문제 & 스크립트 모아보기</span>
                                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-200" />
                                </button>
                            </div>
                        </div>

                        {/* Card 2: Human Coaching */}
                        <div className="group relative bg-white/[0.02] border border-white/[0.08] rounded-lg p-8 md:p-10 hover:border-cyan-500/20 transition-all duration-300">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/15 to-indigo-500/10 flex items-center justify-center mb-8">
                                    <Sparkles className="w-6 h-6 text-cyan-400" />
                                </div>

                                <div className="flex items-center gap-3 mb-4">
                                    <h4 className="text-xl font-medium text-white tracking-tight">
                                        1:1 자기소개서 첨삭 받기
                                    </h4>
                                    <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-cyan-400 bg-cyan-500/10 rounded-md font-medium">
                                        Premium
                                    </span>
                                </div>

                                <p className="text-base text-zinc-400 leading-relaxed mb-10">
                                    AI의 분석을 넘어, 10년 차 실무진 멘토의 손길로 자소서의 완성도를 극대화해보세요.
                                </p>

                                <button className="w-full py-4 px-5 text-base text-zinc-900 bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-lg hover:from-cyan-300 hover:to-cyan-400 transition-all duration-200 flex items-center justify-center gap-3 font-medium group/btn">
                                    <span>1:1 프리미엄 첨삭 신청하기</span>
                                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform duration-200" />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ================================================================= */}
                {/* FOOTER */}
                {/* ================================================================= */}
                <footer className="py-12 border-t border-white/5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-600">
                        <p>PassMate © 2026. All rights reserved.</p>
                        <p>Report ID: RPT-2026-0427-7842</p>
                    </div>
                </footer>

            </article>
        </main>
    )
}