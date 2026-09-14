import { useState } from "react";
import { ChevronDown, Pin } from "lucide-react";

import { cn } from "@/lib/utils";
import type { JobPostingRecord } from "@/types/jobPosting";

import { BulletList } from "./JobPostingSection";

/** 키워드가 비면 자격요건 첫 어절들로 칩을 채운다. */
function pickChips(record: JobPostingRecord): string[] {
  const { keywords, requirements } = record.summary;
  if (keywords.length > 0) return keywords;
  return requirements
    .map(item => item.trim().split(/\s+/).slice(0, 3).join(" "))
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * 문항을 쓰는 동안 공고 요구사항이 눈에서 사라지지 않도록 문항 목록 위에 붙는 바.
 * top 은 AnalyzeNav(h-16, 64px) 아래 8px 여백. 상태는 펼침/접힘만 지역으로 가진다.
 */
export default function JobPostingStickyBar({ record }: { record: JobPostingRecord }) {
  const [expanded, setExpanded] = useState(false);
  const chips = pickChips(record);
  const { requirements, preferred, responsibilities } = record.summary;
  const hasLists = requirements.length > 0 || preferred.length > 0;

  return (
    <div
      role="region"
      aria-label="채용공고 요약"
      className="sticky top-[72px] z-20 mb-5 rounded-xl border border-white/[0.1] bg-[#141416]/95 backdrop-blur"
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Pin className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
        <span className="shrink-0 text-xs font-medium text-zinc-400">공고 요구사항</span>
        {!expanded && (
          <ul className="flex min-w-0 flex-1 gap-1.5 overflow-hidden whitespace-nowrap" aria-label="공고 키워드">
            {chips.map(chip => (
              <li
                key={chip}
                className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.05] px-2 py-0.5 text-[11.5px] text-zinc-300"
              >
                {chip}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          aria-expanded={expanded}
          className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-white"
        >
          {expanded ? "접기" : "펼치기"}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </div>

      {expanded && (
        <div className="grid gap-5 border-t border-white/[0.06] px-4 py-4 md:grid-cols-2">
          {requirements.length > 0 && <BulletList title="자격요건" items={requirements} />}
          {preferred.length > 0 && <BulletList title="우대사항" items={preferred} />}
          {!hasLists && responsibilities.length > 0 && (
            <BulletList title="담당 업무" items={responsibilities} />
          )}
        </div>
      )}
    </div>
  );
}
