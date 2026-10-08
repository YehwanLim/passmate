/**
 * 관리자 화면(홈 표·사용 행동)이 같이 쓰는 기간. 모든 경계는 KST 자정이다.
 * - 7d / 30d: 오늘 포함 최근 N일, 한 칸 = 하루("MM/DD")
 * - lastWeek: 지난주 월요일 00:00 ~ 이번 주 월요일 00:00, 한 칸 = 하루
 * - months: 이번 달 포함 최근 6개월, 한 칸 = 한 달("YYYY-MM")
 * end 가 null 이면 지금까지 열려 있는 기간이다(지난주만 끝이 있다).
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_COUNT = 6;

export const ADMIN_PERIODS = Object.freeze(["7d", "lastWeek", "30d", "months"]);
const DEFAULT_PERIOD = "7d";

function toKst(value) {
  return new Date(new Date(value).getTime() + KST_OFFSET_MS);
}

export function kstDayStart(now = new Date()) {
  const kst = toKst(now);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS);
}

export function kstLabel(value) {
  const date = toKst(value);
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function kstMonthLabel(value) {
  const date = toKst(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayPeriod(key, start, count, end) {
  const labels = Array.from({ length: count }, (_, index) => kstLabel(new Date(start.getTime() + index * DAY_MS)));
  return { key, start, end, labels, bucketOf: kstLabel };
}

/** 허용 목록 밖의 값은 기본(최근 7일)으로 돌려 쿼리 범위가 임의로 커지지 않게 한다. */
export function readPeriod(query, now = new Date()) {
  const key = ADMIN_PERIODS.includes(query?.period) ? query.period : DEFAULT_PERIOD;
  const todayStart = kstDayStart(now);

  if (key === "lastWeek") {
    const daysSinceMonday = (toKst(now).getUTCDay() + 6) % 7;
    const thisMonday = new Date(todayStart.getTime() - daysSinceMonday * DAY_MS);
    return dayPeriod(key, new Date(thisMonday.getTime() - 7 * DAY_MS), 7, thisMonday);
  }
  if (key === "months") {
    const kst = toKst(now);
    const start = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - (MONTH_COUNT - 1), 1) - KST_OFFSET_MS);
    const labels = Array.from({ length: MONTH_COUNT }, (_, index) => {
      const month = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - (MONTH_COUNT - 1) + index, 1));
      return `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
    });
    return { key, start, end: null, labels, bucketOf: kstMonthLabel };
  }
  const days = key === "30d" ? 30 : 7;
  return dayPeriod(key, new Date(todayStart.getTime() - (days - 1) * DAY_MS), days, null);
}

/** 기간 [start, end) 안에 드는지. */
export function inPeriod(period, value) {
  const time = new Date(value).getTime();
  return time >= period.start.getTime() && (period.end == null || time < period.end.getTime());
}

/** Prisma where 용 createdAt 조건. */
export function periodWhere(period, start = period.start) {
  return period.end == null ? { gte: start } : { gte: start, lt: period.end };
}

/** 칸마다 valueOf(row) 를 더한다. 기간 밖이거나 칸이 없는 행은 버린다. */
export function sumByBucket(rows, period, valueOf = () => 1, dateOf = (row) => row.createdAt) {
  const totals = new Map(period.labels.map((label) => [label, 0]));
  rows.forEach((row) => {
    const date = dateOf(row);
    if (!inPeriod(period, date)) return;
    const label = period.bucketOf(date);
    if (totals.has(label)) totals.set(label, totals.get(label) + (valueOf(row) ?? 0));
  });
  return period.labels.map((date) => ({ date, value: totals.get(date) ?? 0 }));
}
