// 서버(lib/admin-period.js 의 ADMIN_PERIODS)와 같은 목록. 밖의 값은 서버가 최근 7일로 되돌린다.
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
