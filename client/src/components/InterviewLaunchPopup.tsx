import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Link, useLocation } from "wouter";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fetchSalesAvailability } from "@/lib/entitlements";
import { PRICING, formatKrw } from "@/lib/pricing";
import { sendFunnelEvent } from "@/lib/siteVisits";

/* ─────────────────────────────────────────────────────────
   InterviewLaunchPopup — AI 모의 면접 출시 안내 팝업(2026-11-08 시안 확정)
   관리자 공지(SiteNotices)와 별개의 전용 디자인이다. 랜딩(/)·마이페이지(/my…)·공고(/jobs…)·가이드(/guide…)에서,
   들어오고 2초 뒤에, 면접 이용권을 실제로 살 수 있을 때만 띄운다. 기념가가 끝나면 더 안 뜬다.
   ───────────────────────────────────────────────────────── */

/** 기념가 마지막 날(12월 8일, 한국 시각) 자정까지 띄운다. 가격은 pricing.ts(그로블 상품 가격과 같아야 함)에서 읽는다. */
export const INTERVIEW_LAUNCH_ENDS_AT = Date.parse("2026-12-09T00:00:00+09:00");
export const INTERVIEW_LAUNCH_DELAY_MS = 2_000;
const HIDE_AFTER_CLOSE_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = "preview:interview-launch-popup:hidden-until";

/** 팝업을 띄울 화면: 랜딩·마이페이지·공고·가이드(하위 포함). 면접 화면 안에서는 띄우지 않는다. */
export function isInterviewLaunchPopupPath(path: string): boolean {
  if (path === "/") return true;
  if (["/jobs", "/guide"].some((base) => path === base || path.startsWith(`${base}/`))) return true;
  if (path.startsWith("/my/interview-practice")) return false;
  return path === "/my" || path.startsWith("/my/");
}

function readHiddenUntil(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeHiddenUntil(until: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(until));
  } catch {
    // 저장이 막힌 브라우저에서는 이번 방문 동안만 닫힌다.
  }
}

/** 지금 띄워도 되는지(기간 안이고, 닫은 지 7일이 지났거나 다시 보지 않기를 안 눌렀는지). */
export function isInterviewLaunchPopupDue(now: number = Date.now()): boolean {
  return now < INTERVIEW_LAUNCH_ENDS_AT && now >= readHiddenUntil();
}

export function InterviewLaunchPopupCard({ onClose, onNeverShow, onGo }: { onClose: () => void; onNeverShow: () => void; onGo: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[min(86vw,360px)] max-w-none gap-0 overflow-hidden rounded-[20px] border-0 bg-[#0b1020] p-0 text-white shadow-2xl outline-none sm:w-[400px] sm:max-w-none"
        showCloseButton={false}
        // 뜨자마자 버튼에 포커스 테가 그려지지 않게, 포커스는 창 자체에 둔다.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="relative">
          <img src="/interview/popup-interviewer.jpg" alt="" className="block aspect-[16/10] w-full object-cover" />
          <div className="absolute inset-x-0 -bottom-px h-[45%] bg-gradient-to-b from-transparent to-[#0b1020]" />
          <div aria-hidden="true" className="absolute left-3 top-3 rounded-[10px] rounded-br-[3px] bg-black/60 px-2 py-1.5 backdrop-blur-sm">
            <p className="whitespace-nowrap text-[10px] font-semibold leading-[1.45] text-white sm:text-[11px]">
              다른 완성차 회사가 아니라
              <br />
              현대자동차여야 하는 이유는
              <br />
              무엇입니까?
            </p>
          </div>
        </div>
        <div className="px-5 pb-4 pt-1 sm:px-6">
          <DialogTitle className="text-[20px] font-bold leading-[1.4] tracking-[-0.02em] text-white">AI 모의 면접이 새로 나왔어요</DialogTitle>
          <DialogDescription className="mt-1.5 text-[15px] leading-[1.6] text-white/65">
            면접장에서 처음 말해 보면 늦습니다.
            <br />
            내 자소서를 파고드는 면접관과
            <br />
            압박 면접에 미리 대비해보세요.
          </DialogDescription>
          <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-3">
            <span className="text-[13px] text-white/50">
              <span aria-hidden="true" className="mr-1.5">
                🎉
              </span>
              출시 기념 한 달간
            </span>
            <span className="text-[14px] text-white/70">
              1회 <b className="text-[19px] font-extrabold tracking-[-0.02em] text-white">{formatKrw(PRICING.interview.salePrice)}</b>
            </span>
          </div>
          <div className="mt-4 flex justify-center">
            <Link
              href="/my/interview-practice"
              onClick={onGo}
              className="inline-flex h-11 items-center rounded-[12px] bg-brand px-10 text-[15px] font-bold text-white"
            >
              면접 보러 가기
            </Link>
          </div>
          <button type="button" onClick={onNeverShow} className="mt-3 text-[11px] text-white/40 hover:text-white/70">
            다시 보지 않기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InterviewLaunchPopup() {
  const [location] = useLocation();
  const onTargetPath = isInterviewLaunchPopupPath(location);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!onTargetPath || open || !isInterviewLaunchPopupDue()) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchSalesAvailability()
        .then((availability) => {
          if (cancelled || !availability.purchasable.interview || !isInterviewLaunchPopupDue()) return;
          setOpen(true);
          void sendFunnelEvent("content_cta_click", "interview-popup:open");
        })
        .catch(() => {
          // 안내 팝업은 부가 기능이다. 실패하면 조용히 넘어간다.
        });
    }, INTERVIEW_LAUNCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [onTargetPath, open]);

  if (!open || !onTargetPath) return null;

  const hide = (until: number, where: string) => {
    writeHiddenUntil(until);
    setOpen(false);
    void sendFunnelEvent("content_cta_click", `interview-popup:${where}`);
  };

  return (
    <InterviewLaunchPopupCard
      onClose={() => hide(Date.now() + HIDE_AFTER_CLOSE_MS, "close")}
      onNeverShow={() => hide(INTERVIEW_LAUNCH_ENDS_AT, "never")}
      onGo={() => hide(Date.now() + HIDE_AFTER_CLOSE_MS, "go")}
    />
  );
}
