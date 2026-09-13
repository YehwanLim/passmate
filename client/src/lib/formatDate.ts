// 화면마다 복사돼 있던 ko-KR 날짜 포맷을 한 곳에 모은다. 프리셋 이름은 출력 단위를 그대로 읽는다
// (y=년 m=월 d=일 / h=시 m=분 s=초). "ymd-dot" 은 마이페이지 카드의 2026.09.12 표기다.
const PRESETS = {
  "md-hm": { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" },
  "md-hms": { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" },
  ymd: { year: "numeric", month: "2-digit", day: "2-digit" },
  "ymd-hm": { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" },
  "ymd-hms": {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DatePreset = keyof typeof PRESETS | "ymd-dot";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 비어 있거나 파싱할 수 없는 값은 fallback 으로 그린다. */
export function formatDate(
  value: string | Date | null | undefined,
  preset: DatePreset = "ymd-hm",
  fallback = "–"
): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  if (preset === "ymd-dot") {
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
  }
  return date.toLocaleString("ko-KR", PRESETS[preset]);
}
