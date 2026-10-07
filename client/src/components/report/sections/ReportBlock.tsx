import type { ReactNode } from "react";

/**
 * 리포트 아래쪽 섹션 하나를 감싸는 흰 블록: 작은 이름(목차와 같은 말) + 큰 제목 + 본문.
 * 예상 질문·공고 적합도·합격 기준·다음 단계·실무자 코멘트가 같은 틀을 쓴다. id 는 왼쪽 목차가 따라간다.
 */
export function ReportBlock({
  id,
  label,
  count,
  title,
  children,
}: {
  id: string;
  label: string;
  /** 이름 옆 회색 숫자(질문 5개 등). 없으면 숨긴다. */
  count?: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="report-section-anchor rounded-3xl bg-surface px-5 py-7 sm:px-10 sm:py-9">
      <p className="text-[14px] font-bold text-ink-4">
        {label}
        {typeof count === "number" ? <span className="ml-1.5 text-ink-5">{count}</span> : null}
      </p>
      <h2 className="mt-1.5 text-[22px] font-bold leading-[1.35] tracking-[-0.02em] text-ink text-balance sm:text-[24px]">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}
