import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectSummary } from "@/types/my";
import ProjectCard from "@/components/my/ProjectCard";
import EmptyState from "@/components/my/EmptyState";
import SkeletonCard from "@/components/my/SkeletonCard";
import SubtleBackground from "@/components/SubtleBackground";
import Logo from "@/components/Logo";
import AuthButton from "@/components/AuthButton";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getAuthorizationHeader } from "@/lib/apiAuth";

// =============================================================================
// Page Component
// =============================================================================
export default function MyProjects() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useRequireAuth(); // 미인증 시 /login 리다이렉트
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user?.id) return;

    const fetchProjects = async () => {
      try {
        setLoadError(null);
        const response = await fetch("/api/projects", { headers: await getAuthorizationHeader() });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: ProjectSummary[] = await response.json();
        setProjects(data);
      } catch (e) {
        setProjects([]);
        setLoadError(e instanceof Error ? e.message : "지원서를 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [authLoading, user?.id]);

  /** Project 삭제 핸들러 */
  const handleDelete = async (projectId: string) => {
    if (
      !confirm(
        "이 프로젝트를 삭제하시겠습니까?\n모든 분석 이력이 함께 삭제됩니다."
      )
    )
      return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        headers: await getAuthorizationHeader(),
      });
      if (!response.ok) throw new Error("Delete failed");
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "프로젝트를 삭제하지 못했습니다.");
    }
  };

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
              onClick={() => navigate("/")}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
              <Logo className="w-6 h-6" textClassName="text-lg md:text-xl text-white" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="text-[13px] text-gray-300 hover:text-white hover:bg-white/10 font-medium h-8 px-3 rounded-md transition-colors duration-200"
              onClick={() => navigate("/my")}
            >
              My
            </button>
            <AuthButton />
          </div>
        </div>
      </motion.nav>

      {/* ════════ Page Header ════════ */}
      <div className="container pt-10 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight mb-1">
            지원서 관리
          </h1>
          <p className="text-[14px] text-zinc-500 font-light">
            분석한 자소서를 확인하고, 다시 활용할 수 있습니다.
          </p>
        </motion.div>
      </div>

      {/* ════════ Project List ════════ */}
      <div className="container">
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} variant="project" />
          ))}
        </div>
        ) : loadError ? (
          <p role="alert" className="py-10 text-center text-sm text-red-400">
            {loadError}
          </p>
        ) : projects.length === 0 ? (
          <EmptyState
            title="아직 분석한 지원서가 없어요"
            description="자소서를 분석하면 여기에서 확인하고 다시 활용할 수 있습니다."
            ctaLabel="자소서 분석하러 가기"
          />
        ) : (
          <motion.div
            className="grid gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {projects.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * idx }}
              >
                <ProjectCard
                  project={project}
                  onViewQuestions={() => navigate(`/my/${project.id}`)}
                  onViewReport={() => {
                    if (project.latest_analysis_id) {
                      navigate(`/report-new?analysisId=${encodeURIComponent(project.latest_analysis_id)}`);
                    } else {
                      setLoadError("저장된 분석 리포트를 찾을 수 없습니다.");
                    }
                  }}
                  onDelete={() => handleDelete(project.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ════════ 향후 확장 영역 (멘토링 BM 등) ════════ */}
    </div>
  );
}
