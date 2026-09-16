import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectSummary } from "@/types/my";
import ProjectCard from "@/components/my/ProjectCard";
import EmptyState from "@/components/my/EmptyState";
import SkeletonCard from "@/components/my/SkeletonCard";
import SubtleBackground from "@/components/SubtleBackground";
import SiteHeader from "@/components/SiteHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthenticationRequiredError, getAuthorizationHeader } from "@/lib/apiAuth";

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
        if (!response.ok) throw new Error("지원서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        const data: ProjectSummary[] = await response.json();
        setProjects(data);
      } catch (e) {
        setProjects([]);
        if (e instanceof AuthenticationRequiredError) {
          setLoadError("로그인이 만료되었어요. 다시 로그인해 주세요.");
        } else {
          setLoadError(e instanceof Error ? e.message : "지원서를 불러오지 못했습니다.");
        }
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
      if (!response.ok) throw new Error("프로젝트를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (e) {
      if (e instanceof AuthenticationRequiredError) {
        setLoadError("로그인이 만료되었어요. 다시 로그인해 주세요.");
      } else {
        setLoadError(e instanceof Error ? e.message : "프로젝트를 삭제하지 못했습니다.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-28">
      {/* ════════ GNB ════════ */}
      <SiteHeader />

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
                // 카드마다 50ms 씩 밀리면 18장은 마지막 카드가 1초 넘게 늦는다. 여섯 장까지만 계단식.
                transition={{ duration: 0.35, delay: 0.05 * Math.min(idx, 5) }}
              >
                <ProjectCard
                  project={project}
                  onViewQuestions={() => navigate(`/my/${project.id}`)}
                  onViewReport={() => {
                    if (project.latest_analysis_id) {
                      const query = `analysisId=${encodeURIComponent(project.latest_analysis_id)}`;
                      navigate(project.kind === "COMPANY" ? `/company-report?${query}` : `/report-new?${query}`);
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

      {/* ════════ 회원 탈퇴 — 의도적으로 눈에 띄지 않게 우측 하단에 둔다 ════════ */}
      <div className="container mt-16 flex justify-end">
        <button
          id="my-account-deletion-link"
          onClick={() => navigate("/account/deletion")}
          className="text-[11px] text-zinc-700 hover:text-zinc-500 transition-colors"
        >
          회원 탈퇴
        </button>
      </div>
    </div>
  );
}
