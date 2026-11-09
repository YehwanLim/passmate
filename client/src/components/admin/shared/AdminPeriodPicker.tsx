import { Button } from "@/components/ui/button";
import { ADMIN_PERIOD_OPTIONS, type AdminPeriod } from "@/lib/adminPeriod";

interface AdminPeriodPickerProps {
  value: AdminPeriod;
  onChange: (period: AdminPeriod) => void;
  /** 버튼 id 앞부분(화면마다 다르게) */
  idPrefix: string;
}

/** 홈 표와 사용 행동 화면이 같이 쓰는 기간 버튼(최근 7일·지난주·최근 30일·월별). */
export function AdminPeriodPicker({ value, onChange, idPrefix }: AdminPeriodPickerProps) {
  return (
    <div className="flex items-center rounded-md border bg-card p-0.5" role="group" aria-label="기간">
      {ADMIN_PERIOD_OPTIONS.map((option) => (
        <Button
          key={option.key}
          type="button"
          size="sm"
          variant={option.key === value ? "secondary" : "ghost"}
          className="h-7 px-2.5 text-xs"
          aria-pressed={option.key === value}
          onClick={() => onChange(option.key)}
          id={`${idPrefix}-period-${option.key}`}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
