/**
 * 채용 공고 마감 계산. 마감은 "+09:00" ISO 문자열(constants/jobPostings.ts)이고 표시·D-n 은 한국 달력 기준이다.
 * "지금"에 달린 값(접수 중 여부·D-n)은 hooks/useNow 가 준 시각으로만 부른다 — 프리렌더 HTML 에 구워지면 안 된다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const pad = (n: number) => String(n).padStart(2, "0");
/** UTC 게터로 읽으면 KST 벽시계가 나오는 Date */
const kst = (iso: string) => new Date(new Date(iso).getTime() + KST_OFFSET_MS);
const kstDay = (date: Date) => Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_MS);
const time = (posting: { closesAt: string }) => new Date(posting.closesAt).getTime();

export function isOpen(closesAt: string, now: Date): boolean {
  return new Date(closesAt).getTime() > now.getTime();
}

/** 마감일까지 남은 날(한국 달력). 오늘 마감이면 0. */
export function daysLeft(closesAt: string, now: Date): number {
  return kstDay(new Date(closesAt)) - kstDay(now);
}

export function dDayLabel(closesAt: string, now: Date): string {
  const days = daysLeft(closesAt, now);
  return days <= 0 ? "오늘 마감" : `D-${days}`;
}

/** "10.12(월) 18:00" */
export function formatDeadline(closesAt: string): string {
  const d = kst(closesAt);
  return `${d.getUTCMonth() + 1}.${pad(d.getUTCDate())}(${WEEKDAYS[d.getUTCDay()]}) ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** <input type="date"> 값(YYYY-MM-DD, 한국 날짜) */
export function deadlineDateInput(closesAt: string): string {
  const d = kst(closesAt);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 접수 중인 공고, 마감 가까운 순 */
export function openPostings<T extends { closesAt: string }>(list: readonly T[], now: Date): T[] {
  return list.filter(posting => isOpen(posting.closesAt, now)).sort((a, b) => time(a) - time(b));
}

/** 마감된 공고, 최근 마감 순 */
export function closedPostings<T extends { closesAt: string }>(list: readonly T[], now: Date): T[] {
  return list.filter(posting => !isOpen(posting.closesAt, now)).sort((a, b) => time(b) - time(a));
}
