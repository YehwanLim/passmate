import { cn } from "@/lib/utils";
import type { AdminPageMeta } from "@/types/admin";

interface AdminPageHeaderProps extends AdminPageMeta {
  /** 우측에 배치할 액션 버튼 등 */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * AdminPageHeader
 *
 * 관리자 각 페이지 상단의 타이틀 + 설명 + 액션 버튼 영역.
 *
 * @example
 * <AdminPageHeader
 *   title="Users"
 *   description="전체 가입 사용자를 관리합니다."
 *   actions={<Button size="sm">내보내기</Button>}
 * />
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-6",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight truncate">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2 mt-2 sm:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
}
