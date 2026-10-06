import { Check, X } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import type { CompanyInsight } from "@/types/report";
import { renderRichText } from "../richText";

/** 합격 기준: 회사 요약, 인재상, 합격 기준, 탈락 요인, 조직 문화. "더 자세히" 칸 안에 들어간다. */
export function CompanyInsightSection({ companyInsight }: { companyInsight: CompanyInsight }) {
  return (
    <div id="section-company-insight" className="report-section-anchor">
      <p className="max-w-3xl text-[16px] leading-[1.75] text-ink-3">{renderRichText(companyInsight.summary)}</p>

      <div className="mt-7 grid grid-cols-1 gap-x-10 gap-y-7 md:grid-cols-2">
        <div>
          <p className="mb-3 text-[14px] font-bold text-ink-4">{UI_LABELS.TALENT_PROFILE}</p>
          <p className="text-[16px] font-bold leading-[1.6] text-ink">{companyInsight.talentKeywords.join(" · ")}</p>
        </div>

        <div>
          <p className="mb-3 text-[14px] font-bold text-ok">{UI_LABELS.ACCEPTANCE_CRITERIA}</p>
          <ul className="space-y-2.5">
            {companyInsight.hiringSignals.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.65] text-ink-2">
                <Check className="mt-1 size-3.5 shrink-0 text-ok" strokeWidth={3} />{renderRichText(s)}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-[14px] font-bold text-danger">{UI_LABELS.REJECTION_TRIGGERS}</p>
          <ul className="space-y-2.5">
            {companyInsight.rejectionTriggers.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.65] text-ink-2">
                <X className="mt-1 size-3.5 shrink-0 text-danger" strokeWidth={3} />{renderRichText(r)}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-[14px] font-bold text-ink-4">{UI_LABELS.CULTURE_SIGNALS}</p>
          <ul className="space-y-2.5">
            {companyInsight.cultureSignals.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.65] text-ink-3">
                <span aria-hidden="true" className="mt-[10px] size-[5px] shrink-0 rounded-full bg-ink-5" />{renderRichText(c)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
