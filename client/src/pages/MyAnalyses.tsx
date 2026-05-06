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
// Mock Data — API 응답과 동일한 형태 (연동 후 제거)
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
      "발로 뛰어 얻은 3,000개의 데이터, 정확도 87%를 달성하다\n\n교내 캡스톤 디자인 프로젝트에서 소상공인을 위한 매출 예측 모델을 개발했습니다. 초기에는 공공 데이터만으로 모델링을 시도했으나, 지역별 특성이 반영되지 않아 예측 정확도가 60%에 머물렀습니다. 이를 해결하기 위해 팀원들과 직접 50곳 이상의 매장을 방문하여 인터뷰를 진행하고 신뢰를 쌓았습니다.\n\n결과적으로 3,000건 이상의 실제 매출 데이터를 수집할 수 있었습니다. 수집된 데이터를 바탕으로 Python과 scikit-learn을 활용하여 예측 모델을 고도화했습니다. 예측 정확도 87%를 달성했으며, 이 성과를 인정받아 교내 캡스톤 디자인 경진대회에서 최우수상을 수상했습니다.",
    status: "SUCCESS",
    created_at: "2026-05-05T14:32:00Z",
  },
  {
    id: "mock-analysis-2",
    question_text:
      "팀 프로젝트에서 갈등 상황을 해결한 경험을 작성해 주세요.",
    input_text:
      "개발과 디자인 팀 간의 우선순위 충돌을 중재한 경험\n\n졸업 프로젝트에서 프로젝트 매니저 역할을 맡았습니다. 프론트엔드 개발팀은 기능 구현을 우선시했고, 디자인팀은 UX 완성도를 강조하면서 일정이 지연되고 있었습니다.\n\n양 팀의 입장을 개별 면담으로 파악한 후, '사용자 테스트 기반 우선순위 매트릭스'를 제안했습니다. 핵심 사용자 시나리오 5개를 정의하고, 각 시나리오에서 가장 임팩트가 큰 기능과 디자인 요소를 함께 선정하는 워크숍을 진행했습니다. 결과적으로 양 팀이 합의된 기준으로 작업하게 되어 2주 내에 프로젝트를 정상 궤도에 올릴 수 있었습니다.",
    status: "SUCCESS",
    created_at: "2026-05-05T14:34:00Z",
  },
  {
    id: "mock-analysis-3",
    question_text:
      "데이터 기반 의사결정을 통해 성과를 개선한 경험이 있다면 상세히 기술해 주세요.",
    input_text:
      "A/B 테스트를 통한 이탈률 개선\n\n동아리에서 운영하던 온라인 커뮤니티의 가입 전환율이 낮아 문제를 분석했습니다. Google Analytics 데이터를 확인한 결과, 가입 페이지에서의 이탈률이 35%에 달하는 것을 발견했습니다.\n\n가설을 세우고 A/B 테스트를 설계했습니다. 기존 3단계 가입 프로세스를 1단계 간소화 버전과 비교한 결과, 이탈률이 18%로 감소했습니다.",
    status: "FAILED",
    created_at: "2026-05-05T14:36:00Z",
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
        // TODO: API 연동 시 아래 URL을 실제 엔드포인트로 교체
        const [projRes, analysesRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          fetch(`/api/projects/${projectId}/analyses`),
        ]);

        if (!projRes.ok || !analysesRes.ok)
          throw new Error("API fetch failed");

        const projData: ProjectSummary = await projRes.json();
        const analysesData: AnalysisSummary[] = await analysesRes.json();

        setProject(projData);
        setAnalyses(analysesData);
      } catch (e) {
        console.warn("[MyAnalyses] API 미연동 — Mock 데이터로 대체:", e);
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
