import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Sparkles,
  FileText,
  Network,
  Briefcase,
  Gem,
  MessageCircle,
  Loader2,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Coffee,
  User,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

/**
 * PassMate - 자소서 분석 페이지 (/analyze)
 *
 * 입력 화면:
 * - Title & Subtitle
 * - Large text input area with placeholder
 * - Two action buttons: 자소서 분석하기 / 예시 자소서 보기
 * - 4 analysis criteria cards
 *
 * 결과 화면:
 * - 종합 점수 (원형 게이지)
 * - 강점 / 약점 리포트
 * - PM 예환의 AI 어드바이스 (슬랙 메모지 스타일)
 * - 1:1 커피챗 CTA
 */

const SAMPLE_COVER_LETTER = `저는 대학교 재학 중 데이터 분석 동아리에서 2년간 활동하며 실무 역량을 쌓았습니다. 특히 3학년 때 참여한 '소상공인 매출 예측 프로젝트'에서 팀 리더를 맡아 4명의 팀원과 함께 6개월간 프로젝트를 이끌었습니다.

프로젝트 초기, 데이터 수집 단계에서 소상공인들의 협조를 얻기 어려웠지만, 직접 50곳 이상의 매장을 방문하여 인터뷰를 진행하고 신뢰를 쌓았습니다. 이를 통해 3,000건 이상의 매출 데이터를 확보할 수 있었고, Python과 scikit-learn을 활용하여 예측 모델을 구축했습니다.

그 결과, 예측 정확도 87%를 달성했으며, 이 성과를 인정받아 교내 캡스톤 디자인 경진대회에서 최우수상을 수상했습니다. 이 경험을 통해 데이터 기반의 문제 해결 능력과 팀 리더십을 키울 수 있었습니다.

귀사의 데이터 분석팀에서 이러한 경험을 바탕으로 고객 인사이트를 도출하고 비즈니스 성장에 기여하고 싶습니다.`;

const analysisCriteria = [
  {
    icon: Network,
    title: "논리 구조",
    description: "문단 간의 논리적 흐름과 STAR 기법 활용도를 분석합니다.",
    color: "blue",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    borderHover: "hover:border-blue-300",
  },
  {
    icon: Briefcase,
    title: "직무 적합도",
    description: "지원 직무와 관련된 키워드 및 역량 매칭 정도를 평가합니다.",
    color: "sky",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    borderHover: "hover:border-sky-300",
  },
  {
    icon: Gem,
    title: "경험 구체성",
    description: "경험의 수치 데이터, 구체적 사례, 팩트 체크를 검증합니다.",
    color: "emerald",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    borderHover: "hover:border-emerald-300",
  },
  {
    icon: MessageCircle,
    title: "설득력",
    description: "읽는 사람을 설득하는 표현력과 차별화 포인트를 분석합니다.",
    color: "amber",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    borderHover: "hover:border-amber-300",
  },
];

// Mock analysis result data
const mockResult = {
  score: 78,
  strengths: [
    "STAR 기법이 전반적으로 잘 적용되었습니다.",
    "구체적인 수치(50곳, 3,000건, 87%)가 경험의 신뢰도를 높입니다.",
    "직무 관련 키워드(데이터 분석, Python, scikit-learn)가 적절히 배치되었습니다.",
  ],
  weaknesses: [
    "지원 회사에 대한 구체적인 이해가 드러나지 않습니다.",
    "'많은 것을 배웠다'는 추상적 표현이 있습니다.",
    "입사 후 기여 계획이 다소 일반적입니다.",
  ],
  adviceMessages: [
    {
      text: "이 자소서는 실무자 관점에서 이런 점이 아쉽네요. 경험의 구체성은 좋지만, '왜 우리 회사인가?'에 대한 답이 빠져 있어요. 실무진은 이 부분을 꽤 중요하게 봅니다.",
      timestamp: "방금 전",
    },
    {
      text: "팁 하나 드리면, 마지막 문단에서 '귀사의 데이터 분석팀'이라고만 쓰지 말고, 해당 회사가 최근 진행한 프로젝트나 비전을 언급하면서 연결하면 훨씬 설득력이 올라갑니다. 면접에서도 이 부분을 질문할 확률이 높아요.",
      timestamp: "방금 전",
    },
    {
      text: "성과 수치(87% 정확도)가 인상적인데, 이 수치가 왜 의미 있는지 비교 대상을 넣어보세요. 예를 들어 '기존 모델 대비 15% 향상' 같은 문맥을 추가하면 임팩트가 커집니다.",
      timestamp: "방금 전",
    },
  ],
};

export default function Analyze() {
  const [, navigate] = useLocation();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleAnalyze = () => {
    if (!content.trim()) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowResults(true);
    }, 2000);
  };

  const handleLoadSample = () => {
    setContent(SAMPLE_COVER_LETTER);
  };

  const handleReset = () => {
    setShowResults(false);
    setContent("");
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.15 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
    hover: {
      y: -4,
      transition: { duration: 0.2 },
    },
  };

  return (
    <div className="min-h-screen bg-white">
      {/* GNB */}
      <motion.nav
        className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container flex items-center justify-between h-16">
          {/* Left: Back + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-[#0A1628] to-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">PassMate</span>
            </div>
          </div>

          {/* Right: Login */}
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-600 hover:text-slate-900 font-medium"
          >
            로그인
          </Button>
        </div>
      </motion.nav>

      <AnimatePresence mode="wait">
        {!showResults ? (
          /* ========== INPUT VIEW ========== */
          <motion.section
            key="input"
            className="py-16 md:py-24 bg-gradient-to-b from-slate-50 via-white to-white"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
          >
            <div className="container max-w-3xl mx-auto px-4">
              {/* Title & Subtitle */}
              <motion.div className="text-center mb-10" variants={itemVariants}>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
                  자소서 분석
                </h1>
                <p className="text-slate-500 text-lg leading-relaxed max-w-xl mx-auto">
                  작성한 자기소개서를 붙여 넣으면 분석 결과를 확인할 수 있습니다.
                </p>
              </motion.div>

              {/* Text Input Area */}
              <motion.div variants={itemVariants} className="mb-6">
                <div className="relative">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="여기에 자기소개서를 붙여 넣어 주세요."
                    rows={12}
                    className="w-full border-slate-200 bg-white rounded-2xl p-6 text-base leading-relaxed resize-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 shadow-sm"
                  />
                  {/* Character count */}
                  <div className="absolute bottom-4 right-5 text-xs text-slate-400">
                    {content.length.toLocaleString()}자
                  </div>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                className="flex flex-col sm:flex-row gap-3 mb-16"
                variants={itemVariants}
              >
                <Button
                  onClick={handleAnalyze}
                  disabled={isLoading || !content.trim()}
                  size="lg"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-7 py-6 text-base font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      자소서 분석하기
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleLoadSample}
                  variant="outline"
                  size="lg"
                  className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50 px-7 py-6 text-base font-medium rounded-xl transition-all"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  예시 자소서 보기
                </Button>
              </motion.div>

              {/* Analysis Criteria Section */}
              <motion.div variants={itemVariants} className="mb-4">
                <h2 className="text-xl font-bold text-slate-900 mb-2 text-center">
                  분석 기준
                </h2>
                <p className="text-sm text-slate-500 text-center mb-8">
                  아래 4가지 기준으로 자소서를 종합적으로 평가합니다.
                </p>
              </motion.div>

              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {analysisCriteria.map(
                  ({ icon: Icon, title, description, iconBg, iconColor, borderHover }) => (
                    <motion.div
                      key={title}
                      variants={cardVariants}
                      whileHover="hover"
                      className="cursor-default"
                    >
                      <Card
                        className={`p-6 border-slate-200/80 bg-white shadow-sm hover:shadow-md ${borderHover} transition-all rounded-2xl h-full`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}
                          >
                            <Icon className={`w-5 h-5 ${iconColor}`} />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-slate-900 mb-1">
                              {title}
                            </h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                              {description}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )
                )}
              </motion.div>
            </div>
          </motion.section>
        ) : (
          /* ========== RESULTS VIEW ========== */
          <motion.section
            key="results"
            className="py-12 md:py-20 bg-gradient-to-b from-slate-50 via-white to-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="container max-w-4xl mx-auto px-4">
              {/* Results Header */}
              <motion.div
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h1 className="text-3xl md:text-4xl font-bold text-[#0A1628] mb-3 tracking-tight">
                  분석 리포트
                </h1>
                <p className="text-slate-500 text-lg">
                  현직자 관점에서 분석한 당신의 자소서 리포트입니다.
                </p>
              </motion.div>

              {/* Score + Strengths/Weaknesses Grid */}
              <div className="grid md:grid-cols-3 gap-6 mb-10">
                {/* Score Card */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <Card className="p-8 border-slate-200/80 shadow-md rounded-2xl h-full flex flex-col items-center justify-center bg-white">
                    <p className="text-sm font-medium text-slate-400 mb-4">자소서 완성도</p>
                    <div className="relative inline-flex items-center justify-center mb-4">
                      <svg className="w-32 h-32" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#E2E8F0" strokeWidth="10" />
                        <motion.circle
                          cx="60" cy="60" r="50" fill="none"
                          stroke="url(#resultScoreGradient)"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${mockResult.score * 3.14} ${100 * 3.14}`}
                          transform="rotate(-90 60 60)"
                          initial={{ strokeDasharray: `0 ${100 * 3.14}` }}
                          animate={{ strokeDasharray: `${mockResult.score * 3.14} ${100 * 3.14}` }}
                          transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                        />
                        <defs>
                          <linearGradient id="resultScoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#2563EB" />
                            <stop offset="100%" stopColor="#0A1628" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <motion.span
                        className="absolute text-4xl font-bold text-[#0A1628]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                      >
                        {mockResult.score}<span className="text-lg text-slate-400">점</span>
                      </motion.span>
                    </div>
                    <p className="text-sm text-slate-500">상위 22%</p>
                  </Card>
                </motion.div>

                {/* Strengths */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <Card className="p-6 border-emerald-200 bg-emerald-50/50 rounded-2xl h-full">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-base font-bold text-emerald-700">강점</h3>
                    </div>
                    <ul className="space-y-3">
                      {mockResult.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </motion.div>

                {/* Weaknesses */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  <Card className="p-6 border-amber-200 bg-amber-50/50 rounded-2xl h-full">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <h3 className="text-base font-bold text-amber-700">개선 필요</h3>
                    </div>
                    <ul className="space-y-3">
                      {mockResult.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-amber-700">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </motion.div>
              </div>

              {/* ===== PM 예환의 AI 어드바이스 ===== */}
              <motion.div
                className="mb-10"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                <Card className="border-blue-200/60 bg-gradient-to-br from-[#F8FAFF] to-[#EEF4FF] shadow-md rounded-2xl overflow-hidden">
                  {/* Section Header — Slack-style top bar */}
                  <div className="px-6 py-4 bg-[#0A1628] flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="text-white font-semibold text-sm">PM 예환의 AI 어드바이스</span>
                      <span className="text-blue-300 text-xs ml-2">실무자 관점 피드백</span>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="p-6 space-y-4">
                    {mockResult.adviceMessages.map((msg, i) => (
                      <motion.div
                        key={i}
                        className="flex items-start gap-3"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 1 + i * 0.2 }}
                      >
                        {/* Avatar */}
                        <div className="w-9 h-9 bg-[#0A1628] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-white text-xs font-bold">PM</span>
                        </div>

                        {/* Message bubble */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-[#0A1628]">PM 예환</span>
                            <span className="text-xs text-slate-400">{msg.timestamp}</span>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-xl rounded-tl-sm px-4 py-3 shadow-sm">
                            <p className="text-sm text-slate-700 leading-relaxed">{msg.text}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {/* Typing indicator */}
                    <motion.div
                      className="flex items-center gap-3 pt-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.8 }}
                    >
                      <div className="w-9 h-9 bg-[#0A1628] rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">PM</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 text-xs">
                        <span className="inline-block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="inline-block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="inline-block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        <span className="ml-2 text-slate-400">더 자세한 피드백을 준비하고 있어요...</span>
                      </div>
                    </motion.div>
                  </div>
                </Card>
              </motion.div>

              {/* ===== 1:1 커피챗 CTA ===== */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.2 }}
                className="mb-10"
              >
                <Card className="border-blue-300/50 bg-gradient-to-r from-[#0A1628] to-blue-700 rounded-2xl overflow-hidden shadow-lg shadow-blue-900/20">
                  <div className="px-8 py-8 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-xl font-bold text-white mb-2">
                        더 자세한 피드백이 필요하다면?
                      </h3>
                      <p className="text-blue-200 text-sm leading-relaxed">
                        현직 삼성 PM이 직접 자소서를 리뷰하고, 합격 전략을 함께 설계합니다.
                      </p>
                    </div>
                    <Button
                      size="lg"
                      className="bg-white hover:bg-blue-50 text-[#0A1628] px-8 py-6 text-base font-bold rounded-xl shadow-lg hover:shadow-xl transition-all whitespace-nowrap"
                    >
                      <Coffee className="w-5 h-5 mr-2" />
                      1:1 커피챗 신청하기
                      <ChevronRight className="w-5 h-5 ml-1" />
                    </Button>
                  </div>
                </Card>
              </motion.div>

              {/* Re-analyze Button */}
              <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="border-slate-200 text-slate-600 hover:bg-slate-50 px-8 py-5 rounded-xl font-medium"
                  onClick={handleReset}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  새 자소서 분석하기
                </Button>
              </motion.div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
