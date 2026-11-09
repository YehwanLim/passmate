// 서버(lib/admin-handlers/admin-period.js 의 ADMIN_PERIODS)와 같은 목록(직접 지정 custom 은 아래 AdminDateRange 로 따로).
// 밖의 값은 서버가 최근 7일로 되돌린다.
export const ADMIN_PERIOD_OPTIONS = [
  { key: "7d", label: "최근 7일" },
  { key: "lastWeek", label: "지난주" },
  { key: "30d", label: "최근 30일" },
  { key: "months", label: "월별" },
] as const;

export type AdminPeriod = (typeof ADMIN_PERIOD_OPTIONS)[number]["key"];

export function adminPeriodLabel(period: AdminPeriod): string {
  const option = ADMIN_PERIOD_OPTIONS.find((item) => item.key === period);
  if (period === "lastWeek") return "지난주 월~일";
  if (period === "months") return "최근 6개월";
  return option?.label ?? "";
}

/** 사용 행동 화면의 직접 지정 기간. KST 날짜("YYYY-MM-DD"), 양 끝 포함. 서버 CUSTOM_MAX_DAYS 와 같은 상한. */
export interface AdminDateRange {
  from: string;
  to: string;
}
export const ADMIN_CUSTOM_MAX_DAYS = 92;
const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function kstDateString(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function shiftDate(value: string, days: number): string {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function spanDays({ from, to }: AdminDateRange): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/**
 * 한쪽 날짜를 바꾸면 다른 쪽을 맞춘다: 오늘 이후는 오늘로, 순서가 뒤집히면 같은 날로, 92일을 넘으면 92일로.
 * 서버는 이상한 범위를 최근 7일로 돌리므로 보내기 전에 여기서 맞춘다.
 */
export function adjustDateRange(range: AdminDateRange, changed: "from" | "to", value: string, today = kstDateString()): AdminDateRange {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return range;
  const picked = value > today ? today : value;
  if (changed === "from") {
    let to = range.to < picked ? picked : range.to;
    if (spanDays({ from: picked, to }) > ADMIN_CUSTOM_MAX_DAYS) to = shiftDate(picked, ADMIN_CUSTOM_MAX_DAYS - 1);
    return { from: picked, to: to > today ? today : to };
  }
  let from = range.from > picked ? picked : range.from;
  if (spanDays({ from, to: picked }) > ADMIN_CUSTOM_MAX_DAYS) from = shiftDate(picked, -(ADMIN_CUSTOM_MAX_DAYS - 1));
  return { from, to: picked };
}

/** ◀ ▶ — 같은 길이만큼 앞뒤로 옮긴다. 오늘을 넘기지 않는다(넘길 수 없으면 그대로). */
export function shiftDateRange(range: AdminDateRange, direction: -1 | 1, today = kstDateString()): AdminDateRange {
  const days = spanDays(range) * direction;
  const next = { from: shiftDate(range.from, days), to: shiftDate(range.to, days) };
  return next.to > today ? range : next;
}

export function adminDateRangeLabel({ from, to }: AdminDateRange): string {
  const short = (value: string) => `${value.slice(5, 7)}/${value.slice(8, 10)}`;
  return from === to ? `${short(from)} 하루` : `${short(from)} ~ ${short(to)} (${spanDays({ from, to })}일)`;
}
