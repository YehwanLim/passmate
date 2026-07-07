import { cn } from "@/lib/utils";

interface AdminContentProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * AdminContent
 *
 * 관리자 레이아웃의 주 콘텐츠 영역 래퍼.
 * - flex-1로 사이드바 외 나머지 공간을 모두 차지합니다.
 * - overflow-y-auto로 콘텐츠가 길어질 경우 스크롤을 담당합니다.
 * - 각 페이지의 콘텐츠는 이 컴포넌트 안에서 렌더링됩니다.
 */
export function AdminContent({ children, className }: AdminContentProps) {
  return (
    <main
      className={cn(
        "flex-1 overflow-y-auto",
        "p-4 sm:p-6",
        className
      )}
    >
      {children}
    </main>
  );
}
