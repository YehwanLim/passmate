/** 관리자 공지 화면의 폼 ↔ API 변환과 상태 계산. 서버 검증(lib/site-notices.js)과 같은 규칙을 화면에서 먼저 보여 준다. */
export type NoticeKind = "POPUP" | "BANNER";

export interface AdminNotice {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  imageUrl: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface NoticeFormState {
  kind: NoticeKind;
  title: string;
  body: string;
  linkUrl: string;
  linkLabel: string;
  imageUrl: string;
  active: boolean;
  /** datetime-local 값(브라우저 로컬 = KST) */
  startsAt: string;
  endsAt: string;
}

export const EMPTY_NOTICE_FORM: NoticeFormState = {
  kind: "BANNER",
  title: "",
  body: "",
  linkUrl: "",
  linkLabel: "",
  imageUrl: "",
  active: false,
  startsAt: "",
  endsAt: "",
};

export const NOTICE_KIND_LABEL: Record<NoticeKind, string> = { POPUP: "팝업", BANNER: "상단 배너" };

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** ISO → datetime-local 입력값(브라우저 로컬 시각). */
export function isoToLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function noticeToForm(notice: AdminNotice): NoticeFormState {
  return {
    kind: notice.kind,
    title: notice.title,
    body: notice.body,
    linkUrl: notice.linkUrl ?? "",
    linkLabel: notice.linkLabel ?? "",
    imageUrl: notice.imageUrl ?? "",
    active: notice.active,
    startsAt: isoToLocalInput(notice.startsAt),
    endsAt: isoToLocalInput(notice.endsAt),
  };
}

/** 폼 → API 본문. 빈 칸은 null 로 보내 지운다. 배너는 이미지를 쓰지 않는다. */
export function formToBody(form: NoticeFormState) {
  return {
    kind: form.kind,
    title: form.title.trim(),
    body: form.body.trim(),
    linkUrl: form.linkUrl.trim() || null,
    linkLabel: form.linkLabel.trim() || null,
    imageUrl: form.kind === "POPUP" ? form.imageUrl.trim() || null : null,
    active: form.active,
    startsAt: localInputToIso(form.startsAt),
    endsAt: localInputToIso(form.endsAt),
  };
}

const isInternalPath = (value: string) => value.startsWith("/") && !value.startsWith("//") && !/[\s\\]/.test(value);

/** 화면에서 먼저 알려 줄 문제. 없으면 null. */
export function validateNoticeForm(form: NoticeFormState): string | null {
  if (!form.title.trim()) return "제목을 적어 주세요.";
  if (form.title.trim().length > 100) return "제목은 100자까지예요.";
  if (form.body.length > 1000) return "내용은 1,000자까지예요.";
  const link = form.linkUrl.trim();
  if (link && !isInternalPath(link) && !/^https:\/\//i.test(link)) return "버튼 링크는 /로 시작하는 사이트 안 경로나 https:// 주소여야 해요.";
  const image = form.imageUrl.trim();
  if (form.kind === "POPUP" && image && !isInternalPath(image) && !/^https:\/\/[a-z0-9-]+\.supabase\.co\//i.test(image)) {
    return "이미지는 사이트 안 경로(/images/…)나 Supabase 저장소 주소만 쓸 수 있어요(보안 정책).";
  }
  if (form.startsAt && form.endsAt && new Date(form.startsAt) >= new Date(form.endsAt)) return "끝 시각이 시작 시각보다 뒤여야 해요.";
  return null;
}

export type NoticeStatus = "live" | "scheduled" | "ended" | "off";
export const NOTICE_STATUS_LABEL: Record<NoticeStatus, string> = {
  live: "보이는 중",
  scheduled: "예약됨",
  ended: "기간 끝남",
  off: "꺼짐",
};

export function noticeStatus(notice: Pick<AdminNotice, "active" | "startsAt" | "endsAt">, now = new Date()): NoticeStatus {
  if (!notice.active) return "off";
  if (notice.endsAt && new Date(notice.endsAt) <= now) return "ended";
  if (notice.startsAt && new Date(notice.startsAt) > now) return "scheduled";
  return "live";
}

/** 같은 종류가 여러 개 "보이는 중"이면 가장 최근 것만 실제로 뜬다(서버 readLiveNotices 와 같은 규칙). */
export function shownNoticeIds(notices: AdminNotice[], now = new Date()): Set<string> {
  const shown = new Set<string>();
  (["POPUP", "BANNER"] as const).forEach((kind) => {
    const latest = notices
      .filter((notice) => notice.kind === kind && noticeStatus(notice, now) === "live")
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    if (latest) shown.add(latest.id);
  });
  return shown;
}
