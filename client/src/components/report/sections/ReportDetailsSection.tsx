import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";

export type ReportDetailItem = {
  key: string;
  title: string;
  /** 제목 옆 회색 숫자(질문 5개 등). 없으면 숨긴다. */
  count?: number;
  preview: string;
  content: ReactNode;
};

/**
 * 요약·문장 코멘트를 받치는 나머지 섹션(예상 질문·공고 적합도·합격 기준·다음 단계·실무자 코멘트)을
 * 접어 두는 칸. 처음엔 첫 줄만 펼치고, 인쇄할 때는 전부 펼친다.
 */
export function ReportDetailsSection({ items, isPrinting }: { items: ReportDetailItem[]; isPrinting: boolean }) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set(items[0] ? [items[0].key] : []));

  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section id="section-details" className="report-section-anchor rounded-3xl bg-surface px-5 pb-3 pt-7 sm:px-10 sm:pt-9">
      <h2 className="text-[22px] font-bold tracking-[-0.02em] text-ink sm:text-[24px]">{UI_LABELS.DETAILS_TITLE}</h2>
      <p className="mt-1.5 text-[15px] text-ink-4">{UI_LABELS.DETAILS_DESC}</p>

      <div className="mt-5">
        {items.map((item) => {
          const open = isPrinting || openKeys.has(item.key);
          const panelId = `report-detail-${item.key}`;
          return (
            <div key={item.key} className="border-t border-line-soft">
              <h3>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(item.key)}
                  className="flex w-full items-center gap-4 py-5 text-left sm:py-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-bold leading-[1.4] text-ink sm:text-[18px]">
                      {item.title}
                      {typeof item.count === "number" ? <span className="ml-1.5 font-semibold text-ink-5">{item.count}</span> : null}
                    </span>
                    <span className="mt-1 block text-[14px] leading-[1.55] text-ink-4">{item.preview}</span>
                  </span>
                  <ChevronDown aria-hidden="true" className={`size-[18px] shrink-0 text-ink-5 transition-transform print:hidden ${open ? "rotate-180" : ""}`} />
                </button>
              </h3>
              {open ? (
                <div id={panelId} className="pb-7">
                  {item.content}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
