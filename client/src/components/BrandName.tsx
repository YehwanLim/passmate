import { cn } from "@/lib/utils";

type BrandVariant = "default" | "inverse";

type BrandNameProps = {
  className?: string;
  variant?: BrandVariant;
};

const WORDMARK_SOURCE: Record<BrandVariant, string> = {
  default: "/pre-view-wordmark.png",
  inverse: "/pre-view-wordmark-white.png",
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
