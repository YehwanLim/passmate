import { Check, X } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import type { CompanyInsight } from "@/types/report";
import { SectionNumber } from "../SectionNumber";
import { renderRichText } from "../richText";

/** ACT 1.5 — 합격 기준: 인재상 키워드, 합격 신호, 탈락 사유, 문화 시그널. */
export function CompanyInsightSection({
  targetCompany,
  companyInsight,
}: {
  targetCompany: string;
  companyInsight: CompanyInsight;
}) {
  return (
    <section id="section-company-insight" className="py-24 section-divider report-section-anchor">
      <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-6 tracking-tight"><SectionNumber value="02" />{UI_LABELS.HIRING_CRITERIA(targetCompany)}</h3>
      <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-[1.75]">{renderRichText(companyInsight.summary)}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Talent Keywords */}
        <div className="py-2">
          <p className="text-sm text-zinc-400 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.TALENT_PROFILE}</p>
          <div className="flex flex-wrap gap-2.5">
            {companyInsight.talentKeywords.map((kw) => (
              <span key={kw} className="px-4 py-2 text-sm text-zinc-200 bg-white/[0.04] border border-white/[0.05] rounded-lg font-medium">{kw}</span>
            ))}
          </div>
        </div>

        {/* Hiring Signals */}
        <div className="py-2">
          <p className="text-sm text-emerald-400/70 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.ACCEPTANCE_CRITERIA}</p>
          <ul className="space-y-3">
            {companyInsight.hiringSignals.map((s, i) => (
              <li key={i} className="text-[15px] text-zinc-200 leading-[1.7] flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-400/50 mt-0.5 shrink-0" />{renderRichText(s)}
              </li>
            ))}
          </ul>
        </div>

        {/* Rejection Triggers */}
        <div className="py-2">
          <p className="text-sm text-rose-400/60 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.REJECTION_TRIGGERS}</p>
          <ul className="space-y-3">
            {companyInsight.rejectionTriggers.map((r, i) => (
              <li key={i} className="text-[15px] text-zinc-400 leading-[1.7] flex items-start gap-2.5">
                <X className="w-4 h-4 text-rose-400/35 mt-0.5 shrink-0" />{renderRichText(r)}
              </li>
            ))}
          </ul>
        </div>

        {/* Culture Signals */}
        <div className="py-2">
          <p className="text-sm text-zinc-400 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.CULTURE_SIGNALS}</p>
          <ul className="space-y-3">
            {companyInsight.cultureSignals.map((c, i) => (
              <li key={i} className="text-[15px] text-zinc-400 leading-[1.7] flex items-start gap-2.5">
                <div className="w-[5px] h-[5px] rounded-full bg-zinc-600 mt-[9px] shrink-0"></div>{renderRichText(c)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
