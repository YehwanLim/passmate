import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  closeNoticeForSession,
  fetchLiveNotices,
  hideNoticeForToday,
  isExternalLink,
  isNoticeHidden,
  type SiteNotice,
} from "@/lib/siteNotices";

function NoticeLink({ notice, className, onNavigate }: { notice: SiteNotice; className?: string; onNavigate?: () => void }) {
  if (!notice.linkUrl) return null;
  const external = isExternalLink(notice.linkUrl);
  return (
    <a
      href={notice.linkUrl}
      className={className}
      onClick={onNavigate}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {notice.linkLabel || "자세히 보기"}
    </a>
  );
}

/** 화면 맨 위 띠. 닫으면 이번 방문 동안 안 보인다. 헤더(sticky) 위에 놓여 스크롤하면 함께 올라간다. */
function NoticeBanner({ notice, onClose }: { notice: SiteNotice; onClose: () => void }) {
  return (
    <div role="region" aria-label="공지" className="relative bg-foreground text-background">
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-x-3 gap-y-1 px-10 py-2 text-center text-[13px] leading-snug flex-wrap">
        <span className="font-semibold">{notice.title}</span>
        {notice.body && <span className="opacity-80">{notice.body}</span>}
        <NoticeLink notice={notice} className="font-medium underline underline-offset-2" />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="공지 닫기"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 opacity-70 hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function NoticePopup({ notice, onClose, onHideToday }: { notice: SiteNotice; onClose: () => void; onHideToday: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(92vw,420px)] gap-0 overflow-hidden p-0" showCloseButton={false}>
        {notice.imageUrl && <img src={notice.imageUrl} alt="" className="block max-h-[50vh] w-full object-cover" />}
        <div className="space-y-2 px-6 pb-5 pt-6">
          <DialogTitle className="text-lg font-semibold leading-snug">{notice.title}</DialogTitle>
          <DialogDescription className={notice.body ? "whitespace-pre-line text-sm text-muted-foreground" : "sr-only"}>
            {notice.body || notice.title}
          </DialogDescription>
          {notice.linkUrl && (
            <Button asChild className="mt-3 w-full">
              <NoticeLink notice={notice} onNavigate={onClose} />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm">
          <button type="button" onClick={onHideToday} className="text-muted-foreground hover:text-foreground">
            오늘 하루 보지 않기
          </button>
          <button type="button" onClick={onClose} className="font-medium">
            닫기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 관리자가 켠 공지(lib/siteNotices.ts). 관리자 화면에서는 띄우지 않는다.
 * 프리렌더 HTML 에는 없고(마운트 후 받아 옴), 받지 못하면 아무것도 그리지 않는다.
 */
export function SiteNotices() {
  const [location] = useLocation();
  const isAdmin = location === "/admin" || location.startsWith("/admin/");
  const [banner, setBanner] = useState<SiteNotice | null>(null);
  const [popup, setPopup] = useState<SiteNotice | null>(null);

  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    fetchLiveNotices()
      .then((notices) => {
        if (cancelled) return;
        setBanner(notices.banner && !isNoticeHidden(notices.banner.id) ? notices.banner : null);
        setPopup(notices.popup && !isNoticeHidden(notices.popup.id) ? notices.popup : null);
      })
      .catch(() => {
        // 공지는 부가 기능이다. 실패하면 조용히 넘어간다.
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (isAdmin) return null;
  return (
    <>
      {banner && (
        <NoticeBanner
          notice={banner}
          onClose={() => {
            closeNoticeForSession(banner.id);
            setBanner(null);
          }}
        />
      )}
      {popup && (
        <NoticePopup
          notice={popup}
          onClose={() => {
            closeNoticeForSession(popup.id);
            setPopup(null);
          }}
          onHideToday={() => {
            hideNoticeForToday(popup.id);
            setPopup(null);
          }}
        />
      )}
    </>
  );
}
