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
import { applicationStatus, sortApplications } from "@/lib/workspace";
import { WORKSPACE_COPY } from "./workspaceCopy";

type Tab = "applications" | "experiences" | "company";
type Filter = "all" | "draft" | "done";
const TAB_BY_HASH: Record<string, Tab> = { "#experiences": "experiences", "#company": "company" };
const HASH_BY_TAB: Record<Tab, string> = { applications: "", experiences: "#experiences", company: "#company" };

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
  // 경험 카드 제목 옆 숫자. 금고(ExperienceVault)가 불러오고 바뀔 때마다 알려 준다.
  const [experienceCount, setExperienceCount] = useState<number | null>(null);

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
        {/* ════════ 머리말: 지금 보는 칸 이름 | 남은 이용권 한 줄 ════════ */}
        {/* 칸 바꾸기는 상단 '마이페이지' 펼침 메뉴가 맡는다(10-09). 여기엔 제목 하나만 둔다. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-ink sm:text-[28px]">
            {WORKSPACE_COPY.tabs[tab]}
            {counts[tab] !== null && <span className="ml-2 text-brand">{counts[tab]}</span>}
          </h1>
          {/* 경험 카드 칸은 이용권을 쓰지 않아 띠를 두지 않는다(무료 횟수는 각 창 안에서 보인다) */}
          {tab !== "experiences" && <MyCreditsPanel kind={tab === "company" ? "company" : "essay"} />}
        </div>

        <div className="pt-6">
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
