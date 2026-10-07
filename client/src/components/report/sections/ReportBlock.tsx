import type { ReactNode } from "react";

/**
 * 리포트 섹션 하나를 감싸는 흰 블록: 번호·이름(왼쪽 목차와 같은 말) + 큰 제목 + 본문.
 * 첫인상을 뺀 모든 섹션이 같은 틀을 써서 한 권의 문서처럼 읽히게 한다. id 는 왼쪽 목차가 따라간다.
 */
export function ReportBlock({
  id,
  index,
  label,
  count,
  title,
  description,
  children,
}: {
  id: string;
  /** 목차 번호(01, 02…). */
  index: string;
  label: string;
  /** 이름 옆 회색 숫자(질문 5개 등). 없으면 숨긴다. */
  count?: number;
  title: string;
  /** 제목 아래 한 줄 설명. */
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="report-section-anchor rounded-3xl bg-surface px-5 py-7 sm:px-10 sm:py-9">
      <p className="text-[14px] font-bold text-ink-4">
        <span className="mr-2 tabular-nums text-ink-5">{index}</span>
        {label}
        {typeof count === "number" ? <span className="ml-1.5 font-semibold text-ink-5">{count}</span> : null}
      </p>
      <h2 className="mt-1.5 text-[22px] font-bold leading-[1.35] tracking-[-0.02em] text-ink text-balance sm:text-[24px]">{title}</h2>
      {description ? <div className="mt-2 text-[15px] leading-[1.65] text-ink-4">{description}</div> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
