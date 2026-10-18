import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Link } from "wouter";

import ExperienceImportDialog from "@/components/my/ExperienceImportDialog";
import { parseAnalysisSections } from "@/lib/analysisSections";
import { EXTRACT_TEXT_MAX, EXTRACT_TEXT_MIN } from "@/lib/experienceImport";
import { sendFunnelEvent } from "@/lib/siteVisits";
import { listExperiences } from "@/lib/workspace";

const EXPERIENCES_PATH = "/my#experiences";

/** 분석 원문(input_text)에서 [문항 N] 표시를 지운 답변만 이어 붙인다. 가져오기 최소 길이보다 짧으면 "" — 카드를 숨긴다. */
export function resumeTextForExtract(inputText: string | null | undefined): string {
  const text = parseAnalysisSections(null, inputText)
    .map((section) => section.answer)
    .filter(Boolean)
    .join("\n\n")
    .slice(0, EXTRACT_TEXT_MAX);
  return text.length >= EXTRACT_TEXT_MIN ? text : "";
}

// 리포트 끝 버튼 셋(의견 남기기·경험 저장·기업 분석)이 모두 진한 파랑이면 반복돼 보여, 파랑 안에서 한 단계씩 낮춘다:
// 의견 = 진한 파랑, 경험 저장 = 연한 파랑 바탕, 기업 분석(ReportClosing) = 흰 바탕 파란 테두리.

/**
 * 리포트 끝: 방금 진단한 자소서의 경험을 내 경험에 저장해 두게 하는 카드.
 * 가져오기 창(마이페이지와 같은 것)을 리포트 원문으로 바로 열어, 다음 지원서의 경험 → 초안으로 이어 준다.
 */
export default function SaveExperiencesCard({ resumeText }: { resumeText: string }) {
  const [opening, setOpening] = useState(false);
  const [dialog, setDialog] = useState<{ existingTitles: string[]; ownedCount: number } | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const open = async () => {
    void sendFunnelEvent("report_experience_save_click", "report");
    setOpening(true);
    setMessage(null);
    try {
      // 겹치는 경험 표시와 100개 한도 계산에 지금 담긴 경험이 필요하다.
      const owned = await listExperiences();
      setDialog({ existingTitles: owned.map((item) => item.title), ownedCount: owned.length });
    } catch {
      setMessage("내 경험을 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    } finally {
      setOpening(false);
    }
  };

  if (savedCount !== null) {
    return (
      <section className="print:hidden rounded-3xl bg-surface px-6 py-8 md:px-10 md:py-9">
        <h3 className="flex items-center gap-2 text-[20px] font-bold text-ink">
          <Check className="size-5 text-ok" aria-hidden="true" />
          {`경험 ${savedCount}개를 저장했어요`}
        </h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-ink-3 text-pretty">
          다음 회사 지원서를 만들면, 문항마다 이 경험으로 초안을 받을 수 있어요.
        </p>
        <Link
          href={EXPERIENCES_PATH}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-soft px-6 py-3.5 font-bold text-brand-ink transition-colors hover:bg-[#dbe9ff] sm:w-auto"
        >
          <span>내 경험 보기</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return (
    <section className="print:hidden rounded-3xl bg-surface px-6 py-8 md:px-10 md:py-9">
      <p className="text-[14px] font-bold text-brand-ink">다음 지원서를 위해</p>
      <h3 className="mt-2 text-[20px] font-bold text-ink text-balance">이 자소서에 쓴 경험, 저장해 둘까요?</h3>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink-3 text-pretty">
        다음 지원서에서 이 경험으로 바로 초안을 받을 수 있어요. 적힌 내용만 옮기고, 없는 건 빈칸으로 둬요.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
        <button
          type="button"
          disabled={opening}
          onClick={() => void open()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-soft px-6 py-3.5 font-bold text-brand-ink transition-colors hover:bg-[#dbe9ff] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {opening && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          <span>경험 저장해 두기</span>
        </button>
        <span className="text-[13px] text-ink-4">무료 · 하루 3번</span>
      </div>
      {message && <p role="alert" className="mt-3 text-[14px] leading-relaxed text-danger">{message}</p>}

      <ExperienceImportDialog
        open={dialog !== null}
        initialText={resumeText}
        existingTitles={dialog?.existingTitles ?? []}
        ownedCount={dialog?.ownedCount ?? 0}
        onClose={() => setDialog(null)}
        onSaved={(created) => {
          setSavedCount(created.length);
          void sendFunnelEvent("report_experience_saved", String(created.length));
        }}
      />
    </section>
  );
}
