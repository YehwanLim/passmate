import { cn } from "@/lib/utils";

type BrandVariant = "default" | "inverse";

type BrandNameProps = {
  className?: string;
  variant?: BrandVariant;
  /**
   * 바로 옆에 같은 이름을 텍스트(sr-only 등)로 이미 적었을 때. 워드마크를 장식으로 두어 보조기기·크롤러가
   * "Pre:View" 를 두 번 읽지 않게 한다.
   */
  decorative?: boolean;
};

// ?v= 쿼리는 워드마크 교체 시 브라우저 캐시를 무효화한다. 이미지가 바뀌면 값을 올린다.
const WORDMARK_SOURCE: Record<BrandVariant, string> = {
  default: "/pre-view-wordmark.png?v=2",
  inverse: "/pre-view-wordmark-white.png?v=2",
};

export function BrandName({
  className,
  variant = "inverse",
  decorative = false,
}: BrandNameProps) {
  return (
    <img
      alt={decorative ? "" : "Pre:View"}
      aria-hidden={decorative || undefined}
      className={cn("inline-block h-[0.85em] w-auto align-[-0.08em]", className)}
      src={WORDMARK_SOURCE[variant]}
    />
  );
}
