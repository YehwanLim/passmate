import { useState } from "react";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BEHAVIOR_RANGE_PRESETS,
  adjustDateRange,
  adminDateRangeTitle,
  kstDateString,
  presetRange,
  shiftDateRange,
  type AdminDateRange,
} from "@/lib/adminPeriod";

/**
 * 사용 행동 날짜 막대. 기본은 오늘 하루, ◀ ▶ 로 하루씩(여러 날이면 그 길이만큼) 옮긴다.
 * 오른쪽 빠른 버튼(오늘·최근 7일·최근 30일)과 '기간 지정'(시작~끝 날짜 칸)을 둔다.
 */
export function BehaviorDateBar({ range, onChange }: { range: AdminDateRange; onChange: (range: AdminDateRange) => void }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const today = kstDateString();
  const isToday = range.from === today && range.to === today;
  const activePreset = BEHAVIOR_RANGE_PRESETS.find((preset) => {
    const target = presetRange(preset.days, today);
    return target.from === range.from && target.to === range.to;
  });
  const dateInput = "h-8 rounded-md border bg-card px-2 text-xs tabular-nums";

  return (
    <div className="space-y-2 rounded-lg border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="이전 날짜"
            onClick={() => onChange(shiftDateRange(range, -1, today))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="min-w-[132px] text-center text-sm font-semibold tabular-nums" aria-live="polite">
            {adminDateRangeTitle(range)}
            {isToday && <span className="ml-1.5 text-xs font-normal text-muted-foreground">오늘</span>}
          </p>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="다음 날짜"
            disabled={range.to >= today}
            onClick={() => onChange(shiftDateRange(range, 1, today))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center rounded-md border bg-background p-0.5" role="group" aria-label="빠른 기간">
          {BEHAVIOR_RANGE_PRESETS.map((preset) => {
            const pressed = activePreset?.key === preset.key;
            return (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant={pressed ? "secondary" : "ghost"}
                className="h-7 px-2.5 text-xs"
                aria-pressed={pressed}
                onClick={() => onChange(presetRange(preset.days, today))}
              >
                {preset.label}
              </Button>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant={filterOpen ? "secondary" : "ghost"}
            className="h-7 gap-1 px-2.5 text-xs"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((open) => !open)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            기간 지정
          </Button>
        </div>
      </div>

      {filterOpen && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-2" role="group" aria-label="기간 지정">
          <input
            type="date"
            aria-label="시작 날짜"
            className={dateInput}
            value={range.from}
            max={today}
            onChange={(event) => onChange(adjustDateRange(range, "from", event.target.value, today))}
          />
          <span className="text-xs text-muted-foreground">~</span>
          <input
            type="date"
            aria-label="끝 날짜"
            className={dateInput}
            value={range.to}
            max={today}
            onChange={(event) => onChange(adjustDateRange(range, "to", event.target.value, today))}
          />
          <span className="text-[11px] text-muted-foreground">최대 92일</span>
        </div>
      )}
    </div>
  );
}
