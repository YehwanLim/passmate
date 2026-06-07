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

// =============================================================================
// Mock Data — API 연동 실패 시 Fallback (최소 유지)
// =============================================================================
const MOCK_PROJECT: ProjectSummary = {
  id: "mock-proj-1",
  title: "현대자동차 서비스 PM 지원",
  company_name: "현대자동차",
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
    question_text: "직무 경험을 중심으로 본인을 어필해주세요.",
    input_text: "3,000건의 데이터로 사용자 맞춤 추천을 개선하다\n\n교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영한 경험이 있습니다. 런칭 초기, 유저들이 메인 화면에서 탐색하다가 이탈하는 비율이 매우 높다는 문제를 발견했습니다. 이를 해결하기 위해 직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다. 유저의 클릭 패턴과 체류 시간을 분석한 결과, 개인화가 부족하다는 점을 파악했습니다.\n\n이를 해결하기 위해 로직을 개선하고 A/B 테스트를 진행했습니다. 결과적으로 메인 화면 이탈률을 35%에서 18%로 낮출 수 있었으며, 일간 활성 사용자 수(DAU)도 20% 증가했습니다. 이러한 데이터 기반의 문제 해결 경험을 살려 현대자동차에서도 글로벌 고객들에게 최적화된 모빌리티 경험을 제공하는 데 기여하고 싶습니다.",
    status: "SUCCESS",
    created_at: "2026-05-05T14:32:00Z",
  },
  {
    id: "mock-analysis-2",
    question_text: "팀 프로젝트나 협업 과정에서 발생한 갈등을 극복하고 성과를 이끌어낸 경험을 설명해 주세요.",
    input_text: "학교 프로젝트에서 서비스 기획을 맡아 개발팀, 디자인팀과 협업했습니다. 당시 저희 팀은 일정 지연과 소통 부족이라는 문제를 겪고 있었습니다. 저는 기획자로서 이 문제를 해결하기 위해 적극적으로 나섰습니다. 프로젝트를 진행하며 많은 것을 배웠고 좋은 결과를 얻었습니다. 다양한 팀원들과 협업하며 서로의 입장을 이해하는 법을 배웠습니다. 결국 지속적인 회의와 일정 관리를 통해 프로젝트를 기한 내에 마칠 수 있었습니다.",
    status: "SUCCESS",
    created_at: "2026-05-05T14:35:00Z",
  }
];

// =============================================================================
// Page Component
// =============================================================================
export default function MyAnalyses() {
  const [, setLocation] = useLocation();
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
              onClick={() => setLocation("/my")}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
              <Logo className="w-6 h-6" textClassName="text-lg md:text-xl text-white" />
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
