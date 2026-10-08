import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLocationProperty } from "wouter/use-browser-location";
import type { ProjectSummary } from "@/types/my";
import ApplicationList from "@/components/my/ApplicationList";
import CompanyAnalysisList from "@/components/my/CompanyAnalysisList";
import EmptyState from "@/components/my/EmptyState";
import SkeletonCard from "@/components/my/SkeletonCard";
import SiteHeader from "@/components/SiteHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthenticationRequiredError, getAuthorizationHeader } from "@/lib/apiAuth";
import ExperienceVault from "@/components/my/ExperienceVault";
import MyCreditsPanel from "@/components/my/MyCreditsPanel";
import { applicationStatus, listExperiences, sortApplications } from "@/lib/workspace";
import { WORKSPACE_COPY } from "./workspaceCopy";

type Tab = "applications" | "experiences" | "company";
type Filter = "all" | "draft" | "done";
const TAB_BY_HASH: Record<string, Tab> = { "#experiences": "experiences", "#company": "company" };
const HASH_BY_TAB: Record<Tab, string> = { applications: "", experiences: "#experiences", company: "#company" };
const TABS: Tab[] = ["applications", "experiences", "company"];

// =============================================================================
// Page Component
// =============================================================================
export default function MyProjects() {
  const [, navigate] = useLocation();
  // 탭은 주소의 해시(#experiences·#company)를 따른다. 이미 이 화면에 있을 때 편집기의 경험 링크 등으로 바뀌어도 바로 따라간다.
  const hash = useLocationProperty(() => window.location.hash, () => "");
  const tab: Tab = TAB_BY_HASH[hash] ?? "applications";
  const { user, isLoading: authLoading } = useRequireAuth({ redirectPath: `/my${HASH_BY_TAB[tab]}` }); // 미인증 시 /login 리다이렉트
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [experienceCount, setExperienceCount] = useState<number | null>(null);

  // 내 경험 탭 숫자. 금고를 열기 전에도 보이게 한 번 센다(못 세면 숫자만 뺀다).
  useEffect(() => {
    if (authLoading || !user?.id) return;
    let alive = true;
    listExperiences().then((items) => { if (alive) setExperienceCount(items.length); }).catch(() => {});
    return () => { alive = false; };
  }, [authLoading, user?.id]);

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

  const applications = projects.filter((project) => project.kind !== "COMPANY");
  const companies = projects.filter((project) => project.kind === "COMPANY");
  const draftCount = applications.filter((project) => applicationStatus(project) === "draft").length;
  const doneCount = applications.filter((project) => applicationStatus(project) === "done").length;
  const filtered =
    filter === "all" ? applications : applications.filter((project) => applicationStatus(project) === filter);
  const counts: Record<Tab, number | null> = {
    applications: isLoading ? null : applications.length,
    experiences: experienceCount,
    company: isLoading ? null : companies.length,
  };

  const loadingOrError = isLoading ? (
    <div className="grid gap-3">
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} variant="project" />
      ))}
    </div>
  ) : loadError ? (
    <p role="alert" className="py-10 text-center text-sm text-danger">
      {loadError}
    </p>
  ) : null;

  const openCompany = (project: ProjectSummary) => {
    if (project.latest_analysis_id) {
      navigate(`/company-report?analysisId=${encodeURIComponent(project.latest_analysis_id)}`);
    } else {
      navigate(`/my/${project.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-stage pb-28">
      {/* ════════ GNB ════════ */}
      <SiteHeader variant="light" />

      <div className="container pt-10">
        {/* ════════ 머리말: 제목 | 남은 이용권 한 줄 ════════ */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-[-0.03em] text-ink">{WORKSPACE_COPY.page.title}</h1>
            <p className="mt-1.5 text-[15px] text-ink-4">{WORKSPACE_COPY.page.subtitle}</p>
          </div>
          <div className="sm:pt-2.5">
            <MyCreditsPanel />
          </div>
        </div>

        {/* ════════ 큰 탭: 내 지원서 · 내 경험 · 기업 분석 ════════ */}
        <div role="tablist" className="mt-7 flex gap-5 border-b border-line sm:gap-7">
          {TABS.map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              type="button"
              onClick={() => window.history.replaceState(null, "", HASH_BY_TAB[key] || window.location.pathname)}
              className={`-mb-px border-b-[3px] pb-3 text-[17px] font-bold tracking-[-0.02em] transition-colors sm:text-[22px] ${
                tab === key ? "border-ink text-ink" : "border-transparent text-ink-5 hover:text-ink-3"
              }`}
            >
              {WORKSPACE_COPY.tabs[key]}
              {counts[key] !== null && (
                <span className={`ml-1.5 text-[15px] sm:text-[18px] ${tab === key ? "text-brand" : "text-ink-5"}`}>{counts[key]}</span>
              )}
            </button>
          ))}
        </div>

        <div className="pt-5">
          {tab === "experiences" ? (
            <ExperienceVault onCountChange={setExperienceCount} />
          ) : tab === "company" ? (
            <>
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate("/company-analysis")}
                  className="h-10 rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
                >
                  + {WORKSPACE_COPY.companyTab.start}
                </button>
              </div>
              {loadingOrError ??
                (companies.length === 0 ? (
                  <EmptyState
                    title={WORKSPACE_COPY.companyTab.emptyTitle}
                    description={WORKSPACE_COPY.companyTab.emptyDescription}
                    ctaLabel={WORKSPACE_COPY.companyTab.start}
                    ctaHref="/company-analysis"
                  />
                ) : (
                  <CompanyAnalysisList projects={companies} onOpen={openCompany} onDelete={(project) => handleDelete(project.id)} />
                ))}
            </>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                {/* 상태로만 거른다. 회색 판 위에서 고른 칸만 흰색 */}
                <div role="group" aria-label="지원서 거르기" className="inline-flex gap-0.5 rounded-xl bg-fill p-1">
                  {(
                    [
                      ["all", applications.length],
                      ["draft", draftCount],
                      ["done", doneCount],
                    ] as const
                  ).map(([key, count]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                      className={`h-8 rounded-[9px] px-3 text-[13.5px] transition-colors sm:h-9 sm:px-3.5 sm:text-[14px] ${
                        filter === key ? "bg-surface font-bold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "font-semibold text-ink-4 hover:text-ink-2"
                      }`}
                    >
                      {WORKSPACE_COPY.filters[key]}
                      <span className={`ml-1.5 ${filter === key ? "text-brand" : "text-ink-5"}`}>{count}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/my/new")}
                  className="h-10 rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
                >
                  + {WORKSPACE_COPY.newApplication}
                </button>
              </div>
              {loadingOrError ??
                (applications.length === 0 ? (
                  <EmptyState
                    title="아직 지원서가 없어요"
                    description="새 지원서를 만들거나 자소서를 분석하면 여기에 모여요."
                    ctaLabel="자소서 분석하러 가기"
                  />
                ) : (
                  <ApplicationList
                    projects={filtered}
                    onOpen={(project) => navigate(`/my/${project.id}`)}
                    onDelete={(project) => handleDelete(project.id)}
                  />
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
