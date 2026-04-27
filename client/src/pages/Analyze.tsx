import { Button } from "@/components/ui/button";
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
 * - 분석 완료 후 /report-new 로 이동
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
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
  },
  {
    icon: Briefcase,
    title: "직무 적합도",
    description: "지원 직무와 관련된 키워드 및 역량 매칭 정도를 평가합니다.",
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-400",
  },
  {
    icon: Gem,
    title: "경험 구체성",
    description: "경험의 수치 데이터, 구체적 사례, 팩트 체크를 검증합니다.",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
  },
  {
    icon: MessageCircle,
    title: "설득력",
    description: "읽는 사람을 설득하는 표현력과 차별화 포인트를 분석합니다.",
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-400",
  },
];


export default function Analyze() {
  const [, navigate] = useLocation();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = () => {
    if (!content.trim()) return;
    setIsLoading(true);
    setTimeout(() => {
      navigate("/report-new");
    }, 3000);
  };

  const handleLoadSample = () => {
    setContent(SAMPLE_COVER_LETTER);
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
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* GNB */}
      <motion.nav
        className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-lg border-b border-white/5"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container flex items-center justify-between h-16">
          {/* Left: Back + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">PassMate</span>
            </div>
          </div>

          {/* Right: Login */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white font-medium"
          >
            로그인
          </Button>
        </div>
      </motion.nav>

      {/* ========== INPUT VIEW ========== */}
      <motion.section
        className="py-16 md:py-24"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="container max-w-3xl mx-auto px-4">
          {/* Title & Subtitle */}
          <motion.div className="text-center mb-10" variants={itemVariants}>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
              자소서 분석
            </h1>
            <p className="text-gray-500 text-lg leading-relaxed max-w-xl mx-auto">
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
                className="w-full border-white/10 bg-white/5 text-white rounded-2xl p-6 text-base leading-relaxed resize-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-gray-600"
              />
              {/* Character count */}
              <div className="absolute bottom-4 right-5 text-xs text-gray-600">
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
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-white px-7 py-6 text-base font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-cyan-500/30 transition-all disabled:opacity-50 disabled:shadow-none"
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
              className="flex-1 border-white/10 text-gray-300 hover:bg-white/5 hover:text-white px-7 py-6 text-base font-medium rounded-xl transition-all"
            >
              <FileText className="w-5 h-5 mr-2" />
              예시 자소서 보기
            </Button>
          </motion.div>

          {/* Analysis Criteria Section */}
          <motion.div variants={itemVariants} className="mb-4">
            <h2 className="text-xl font-bold text-white mb-2 text-center">
              분석 기준
            </h2>
            <p className="text-sm text-gray-500 text-center mb-8">
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
              ({ icon: Icon, title, description, iconBg, iconColor }) => (
                <motion.div
                  key={title}
                  variants={cardVariants}
                  whileHover="hover"
                  className="cursor-default"
                >
                  <div
                    className="p-6 border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/[0.08] hover:border-white/20 transition-all rounded-2xl h-full"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}
                      >
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-white mb-1">
                          {title}
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                          {description}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            )}
          </motion.div>
        </div>
      </motion.section>

      {/* ========== LOADING OVERLAY ========== */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="fixed inset-0 z-[100] bg-[#0A0A0A] flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Pulsing gradient ring */}
            <div className="relative mb-10">
              <svg className="w-24 h-24 animate-spin" style={{ animationDuration: '3s' }} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="url(#loadGrad)" strokeWidth="4"
                  strokeLinecap="round" strokeDasharray="80 200"
                />
                <defs>
                  <linearGradient id="loadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#22D3EE" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
              </div>
            </div>

            {/* Text */}
            <motion.p
              className="text-xl font-semibold text-white mb-3 tracking-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              인사이트 리포트를 생성하고 있습니다
            </motion.p>
            <motion.p
              className="text-sm text-zinc-500 mb-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              현직 PM의 합격 로직으로 분석 중...
            </motion.p>

            {/* Progress bar */}
            <div className="w-64 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "90%" }}
                transition={{ duration: 2.8, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
