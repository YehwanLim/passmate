import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft, Building2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectSummary, AnalysisSummary } from "@/types/my";
import AnalysisCard from "@/components/my/AnalysisCard";
import EmptyState from "@/components/my/EmptyState";
import SkeletonCard from "@/components/my/SkeletonCard";
import SubtleBackground from "@/components/SubtleBackground";
import Logo from "@/components/Logo";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getAuthorizationHeader } from "@/lib/apiAuth";

// =============================================================================
// Page Component
// =============================================================================
export default function MyAnalyses() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useRequireAuth(); // 미인증 시 /login 리다이렉트
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user?.id || !projectId) return;

    const fetchData = async () => {
      try {
        setLoadError(null);
        const authHeaders = await getAuthorizationHeader();
        // Project 단건 + Analysis 리스트 병렬 조회
        const [projRes, analysesRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`, { headers: authHeaders }),
          fetch(`/api/projects/${projectId}/analyses`, { headers: authHeaders }),
        ]);

        if (!projRes.ok || !analysesRes.ok)
          throw new Error(`HTTP ${projRes.status}/${analysesRes.status}`);

        const projData: ProjectSummary = await projRes.json();
        const analysesData: AnalysisSummary[] = await analysesRes.json();

        setProject(projData);
        setAnalyses(analysesData);
      } catch (e) {
        setProject(null);
        setAnalyses([]);
        setLoadError(e instanceof Error ? e.message : "지원서 분석을 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [authLoading, projectId, user?.id]);

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
              onClick={() => setLocation("/my")}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
              <Logo className="h-6 w-auto" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="text-[13px] text-gray-300 hover:text-white hover:bg-white/10 font-medium h-8 px-3 rounded-md transition-colors duration-200"
              onClick={() => setLocation("/my")}
            >
              My
            </button>
            <button
              className="text-[13px] text-gray-300 hover:text-white hover:bg-white/10 font-medium h-8 px-3 rounded-md transition-colors duration-200"
            >
              로그인
            </button>
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
        ) : loadError ? (
          <p role="alert" className="py-10 text-center text-sm text-red-400">
            {loadError}
          </p>
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
