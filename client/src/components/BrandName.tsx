import { cn } from "@/lib/utils";

type BrandVariant = "default" | "inverse";

type BrandNameProps = {
  className?: string;
  variant?: BrandVariant;
};

// ?v= 쿼리는 워드마크 교체 시 브라우저 캐시를 무효화한다. 이미지가 바뀌면 값을 올린다.
const WORDMARK_SOURCE: Record<BrandVariant, string> = {
  default: "/pre-view-wordmark.png?v=2",
  inverse: "/pre-view-wordmark-white.png?v=2",
};

export function BrandName({
  className,
  variant = "inverse",
}: BrandNameProps) {
  return (
    <img
      alt="Pre:View"
      className={cn("inline-block h-[0.85em] w-auto align-[-0.08em]", className)}
      src={WORDMARK_SOURCE[variant]}
    />
  );
}
