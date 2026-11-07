import { useEffect, useState } from "react";
import { Link } from "wouter";
import { sendFunnelEvent } from "@/lib/siteVisits";

/** 이만큼 내려야 띠가 올라온다. 제목·요약이 보이는 첫 화면은 가리지 않는다. */
export const CONTENT_CTA_BAR_SHOW_AFTER_PX = 360;

export function contentCtaBarText(company: string | null): string {
  return `${company ?? "내"} 자소서, 이대로 내도 될까요?`;
}

/**
 * 공고·가이드 글을 폰으로 읽는 사람에게 분석 폼 입구를 띄우는 아래 고정 띠(lg 미만에서만).
 * 글 끝의 원래 입구(`endId` 요소)가 화면에 들어오면 같은 버튼이 겹치지 않게 다시 숨는다.
 * 처음엔 숨긴 채로 그려서 프리렌더 HTML 과 하이드레이션 결과가 같다.
 */
export function ContentCtaBar({
  company,
  href,
  where,
  endId,
}: {
  company: string | null;
  href: string;
  /** 클릭 기록 위치. `job-bar:<slug>`·`guide-bar:<slug>` */
  where: string;
  endId: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const end = document.getElementById(endId);
      const endInView = end !== null && end.getBoundingClientRect().top < window.innerHeight;
      setVisible(window.scrollY > CONTENT_CTA_BAR_SHOW_AFTER_PX && !endInView);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [endId]);

  return (
    <div
      inert={!visible}
      aria-hidden={!visible}
      data-visible={visible}
      className={`fixed inset-x-0 bottom-0 z-40 bg-[#4d8eff] pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_rgba(25,31,40,0.08)] transition-transform duration-300 lg:hidden ${
        visible ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
    >
      <Link
        href={href}
        onClick={() => void sendFunnelEvent("content_cta_click", where)}
        className="flex items-center gap-3 px-5 py-3"
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">{contentCtaBarText(company)}</span>
        <span className="flex h-10 flex-none items-center rounded-[10px] bg-surface px-4 text-[14px] font-bold text-brand">
          무료 분석
        </span>
      </Link>
    </div>
  );
}
