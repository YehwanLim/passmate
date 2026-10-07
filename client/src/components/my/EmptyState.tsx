import { FileText, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

interface EmptyStateProps {
  /** 상단 아이콘 (기본: FileText) */
  icon?: React.ReactNode;
  /** 주제목 */
  title?: string;
  /** 부제목/설명 */
  description?: string;
  /** CTA 버튼 텍스트 */
  ctaLabel?: string;
  /** CTA 클릭 시 이동 경로 */
  ctaHref?: string;
}

export default function EmptyState({
  icon,
  title = "아직 분석 이력이 없어요",
  description = "자소서를 분석하면 여기에 결과가 저장됩니다.",
  ctaLabel = "첫 번째 자소서 분석하기",
  ctaHref = "/analyze",
}: EmptyStateProps) {
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-fill flex items-center justify-center mb-5">
        {icon ?? <FileText className="w-6 h-6 text-ink-4" />}
      </div>

      {/* Text */}
      <h3 className="text-[18px] font-bold text-ink mb-2">{title}</h3>
      <p className="text-[14px] text-ink-4 leading-relaxed max-w-sm mb-7">
        {description}
      </p>

      {/* CTA */}
      <button
        onClick={() => navigate(ctaHref)}
        className="group inline-flex items-center gap-2 bg-brand text-white h-11 px-5 rounded-xl text-[14px] font-semibold transition-colors duration-200 hover:bg-brand-hover"
      >
        {ctaLabel}
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
      </button>
    </div>
  );
}
