import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft, Building2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectSummary, AnalysisSummary } from "@/types/my";
import AnalysisCard from "@/components/my/AnalysisCard";
import EmptyState from "@/components/my/EmptyState";
import SkeletonCard from "@/components/my/SkeletonCard";

// =============================================================================
// Mock Data — API 연동 실패 시 Fallback (최소 유지)
// =============================================================================
const MOCK_PROJECT: ProjectSummary = {
  id: "mock-proj-1",
  title: "네이버 웹툰 서비스 PM 지원",
  company_name: "네이버 웹툰",
  job_role: "서비스 PM",
  created_at: "2026-05-05T14:30:00Z",
  analysis_count: 3,
  total_chars: 2420,
  summary:
    "데이터 기반 실행력은 강하지만, 네이버 웹툰 기준 '콘텐츠 임팩트 연결'이 부족합니다",
  keywords: ["데이터 기반 분석", "실행력", "문제 해결"],
};

const MOCK_ANALYSES: AnalysisSummary[] = [
  {
    id: "mock-analysis-1",
    question_text:
      "본인이 주도적으로 문제를 해결했던 경험을 구체적으로 서술하시오.",
    input_text:
      "발로 뛰어 얻은 3,000개의 데이터, 정확도 87%를 달성하다",
    status: "SUCCESS",
    created_at: "2026-05-05T14:32:00Z",
  },
];

// =============================================================================
// Page Component
// =============================================================================
export default function MyAnalyses() {
  const [, navigate] = useLocation();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Project 단건 + Analysis 리스트 병렬 조회
        const [projRes, analysesRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          fetch(`/api/projects/${projectId}/analyses`),
        ]);

        if (!projRes.ok || !analysesRes.ok)
          throw new Error(`HTTP ${projRes.status}/${analysesRes.status}`);

        const projData: ProjectSummary = await projRes.json();
        const analysesData: AnalysisSummary[] = await analysesRes.json();

        setProject(projData);
        setAnalyses(analysesData);
        console.log(`[MyAnalyses] ✅ API 연동 성공 — ${analysesData.length}개 문항`);
      } catch (e) {
        console.warn("[MyAnalyses] ⚠️ API 실패 — Mock 데이터로 대체:", e);
        setProject(MOCK_PROJECT);
        setAnalyses(MOCK_ANALYSES);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-28">
      {/* ════════ GNB ════════ */}
      <motion.nav
        className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-lg border-b border-white/5"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/my")}
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

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-white font-medium"
              onClick={() => navigate("/my")}
            >
              My
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white font-medium"
            >
              로그인
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* ════════ Project Summary Header ════════ */}
      <div className="container pt-10 pb-8">
        {isLoading || !project ? (
          <div className="space-y-3">
            <div className="h-6 w-48 bg-white/[0.06] rounded-md animate-pulse" />
            <div className="h-4 w-32 bg-white/[0.04] rounded-md animate-pulse" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* 회사 · 직무 */}
            <div className="flex items-center gap-2 mb-1">
              {project.company_name && (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500">
                  <Building2 className="w-3.5 h-3.5" />
                  {project.company_name}
                </span>
              )}
              {project.company_name && project.job_role && (
                <span className="text-zinc-700">·</span>
              )}
              {project.job_role && (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500">
                  <Briefcase className="w-3.5 h-3.5" />
                  {project.job_role}
                </span>
              )}
            </div>

            {/* 제목 */}
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight mb-2">
              작성한 자소서
            </h1>
            <p className="text-[13px] text-zinc-500 font-light">
              각 문항을 클릭하면 작성했던 내용을 확인할 수 있습니다.
            </p>
          </motion.div>
        )}
      </div>

      {/* ════════ Analysis List ════════ */}
      <div className="container">
        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} variant="analysis" />
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <EmptyState
            title="분석된 문항이 없어요"
            description="이 프로젝트에 아직 분석 결과가 없습니다."
            ctaLabel="자소서 분석하러 가기"
          />
        ) : (
          <motion.div
            className="grid gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {analyses.map((analysis, idx) => (
              <motion.div
                key={analysis.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * idx }}
              >
                <AnalysisCard analysis={analysis} index={idx} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
