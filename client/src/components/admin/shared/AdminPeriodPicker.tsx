import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ADMIN_PERIOD_OPTIONS,
  adjustDateRange,
  kstDateString,
  shiftDateRange,
  type AdminDateRange,
  type AdminPeriod,
} from "@/lib/adminPeriod";

interface AdminPeriodPickerProps {
  value: AdminPeriod;
  onChange: (period: AdminPeriod) => void;
  /** 버튼 id 앞부분(화면마다 다르게) */
  idPrefix: string;
  /** 있으면 '날짜 지정' 버튼과 날짜 칸을 보인다. range 가 null 이면 위 기간 버튼이 선택된 상태. */
  custom?: {
    range: AdminDateRange | null;
    onRangeChange: (range: AdminDateRange) => void;
  };
}

/** 홈 표와 사용 행동 화면이 같이 쓰는 기간 버튼(최근 7일·지난주·최근 30일·월별 + 사용 행동은 날짜 지정). */
export function AdminPeriodPicker({ value, onChange, idPrefix, custom }: AdminPeriodPickerProps) {
  const range = custom?.range ?? null;
  const today = kstDateString();
  const dateInput = "h-7 rounded-md border bg-card px-2 text-xs tabular-nums";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-md border bg-card p-0.5" role="group" aria-label="기간">
        {ADMIN_PERIOD_OPTIONS.map((option) => {
          const pressed = !range && option.key === value;
          return (
            <Button
              key={option.key}
              type="button"
              size="sm"
              variant={pressed ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              aria-pressed={pressed}
              onClick={() => onChange(option.key)}
              id={`${idPrefix}-period-${option.key}`}
            >
              {option.label}
            </Button>
          );
        })}
        {custom && (
          <Button
            type="button"
            size="sm"
            variant={range ? "secondary" : "ghost"}
            className="h-7 px-2.5 text-xs"
            aria-pressed={Boolean(range)}
            onClick={() => custom.onRangeChange(range ?? { from: today, to: today })}
            id={`${idPrefix}-period-custom`}
          >
            날짜 지정
          </Button>
        )}
      </div>

      {custom && range && (
        <div className="flex items-center gap-1" role="group" aria-label="날짜 범위">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="이전 기간"
            onClick={() => custom.onRangeChange(shiftDateRange(range, -1, today))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="date"
            aria-label="시작 날짜"
            className={dateInput}
            value={range.from}
            max={today}
            onChange={(event) => custom.onRangeChange(adjustDateRange(range, "from", event.target.value, today))}
          />
          <span className="text-xs text-muted-foreground">~</span>
          <input
            type="date"
            aria-label="끝 날짜"
            className={dateInput}
            value={range.to}
            max={today}
            onChange={(event) => custom.onRangeChange(adjustDateRange(range, "to", event.target.value, today))}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="다음 기간"
            disabled={range.to >= today}
            onClick={() => custom.onRangeChange(shiftDateRange(range, 1, today))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
