import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import type { ProjectSummary } from "@/types/my";
import ProjectCard from "@/components/my/ProjectCard";
import EmptyState from "@/components/my/EmptyState";
import SkeletonCard from "@/components/my/SkeletonCard";
import SiteHeader from "@/components/SiteHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthenticationRequiredError, getAuthorizationHeader } from "@/lib/apiAuth";
import NewApplicationForm from "@/components/my/NewApplicationForm";
import ExperienceVault from "@/components/my/ExperienceVault";
import MyCreditsPanel from "@/components/my/MyCreditsPanel";
import { sortApplications } from "@/lib/workspace";
import { WORKSPACE_COPY } from "./workspaceCopy";

// =============================================================================
// Page Component
// =============================================================================
export default function MyProjects() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useRequireAuth(); // 미인증 시 /login 리다이렉트
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<"applications" | "experiences">(
    () => (typeof window !== "undefined" && window.location.hash === "#experiences" ? "experiences" : "applications")
  );
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading || !user?.id) return;

    const fetchProjects = async () => {
      try {
        setLoadError(null);
        const response = await fetch("/api/projects", { headers: await getAuthorizationHeader() });
        if (!response.ok) throw new Error("지원서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        const data: ProjectSummary[] = await response.json();
        setProjects(sortApplications(data));
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

  const projectList = isLoading ? (
    <div className="grid gap-3 px-3 pb-2">
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} variant="project" />
      ))}
    </div>
  ) : loadError ? (
    <p role="alert" className="py-10 text-center text-sm text-danger">
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
      className="divide-y divide-line-soft border-t border-line-soft"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      {projects.map((project, idx) => (
        <motion.div
          key={project.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          // 줄마다 50ms 씩 밀리면 18줄은 마지막 줄이 1초 넘게 늦는다. 여섯 줄까지만 계단식.
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
                // 진단 전 지원서는 리포트가 없다. 목록 전체 오류로 바꾸지 않고 작성 화면으로 보낸다.
                navigate(`/my/${project.id}`);
              }
            }}
            onDelete={() => handleDelete(project.id)}
          />
        </motion.div>
      ))}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-stage pb-28">
      {/* ════════ GNB ════════ */}
      <SiteHeader variant="light" />

      {/* ════════ Page Header ════════ */}
      <div className="container pt-10 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-ink">
            {WORKSPACE_COPY.page.title}
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-4">
            {WORKSPACE_COPY.page.subtitle}
          </p>
        </motion.div>
      </div>

      {/* ════════ 대시보드: 왼쪽 이용권 칸 + 오른쪽 흰 판(탭 + 목록) ════════ */}
      <div className="container">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <MyCreditsPanel email={user?.email ?? null} />
          </div>
          <div className="min-w-0 rounded-[20px] bg-surface p-2 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 pb-3">
              <div role="tablist" className="flex gap-1">
                {(["applications", "experiences"] as const).map((key) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={tab === key}
                    type="button"
                    onClick={() => {
                      setTab(key);
                      window.history.replaceState(null, "", key === "experiences" ? "#experiences" : window.location.pathname);
                    }}
                    className={`h-9 rounded-[10px] px-3.5 text-[15px] transition-colors ${
                      tab === key ? "bg-ink font-bold text-white" : "font-semibold text-ink-4 hover:bg-fill hover:text-ink-2"
                    }`}
                  >
                    {WORKSPACE_COPY.tabs[key]}
                  </button>
                ))}
              </div>
              {tab === "applications" && (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="h-10 rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
                >
                  {WORKSPACE_COPY.newApplication}
                </button>
              )}
            </div>
            {tab === "experiences" ? (
              <div className="px-3 pb-2">
                <ExperienceVault />
              </div>
            ) : (
              <>
                {creating && (
                  <div className="px-3 pb-4">
                    <NewApplicationForm onCreated={(id) => navigate(`/my/${id}`)} onCancel={() => setCreating(false)} />
                  </div>
                )}
                {projectList}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ════════ 향후 확장 영역 (멘토링 BM 등) ════════ */}

      {/* ════════ 회원 탈퇴 — 의도적으로 눈에 띄지 않게 우측 하단에 둔다 ════════ */}
      <div className="container mt-16 flex justify-end">
        <button
          id="my-account-deletion-link"
          onClick={() => navigate("/account/deletion")}
          className="text-[12px] text-ink-5 hover:text-ink-3 transition-colors"
        >
          회원 탈퇴
        </button>
      </div>
    </div>
  );
}
