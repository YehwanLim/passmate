type BrandVariant = "default" | "inverse";

type LogoProps = {
  className?: string;
  variant?: BrandVariant;
};

// ?v= 쿼리는 워드마크 교체 시 브라우저 캐시를 무효화한다. 이미지가 바뀌면 값을 올린다.
const WORDMARK_SOURCE: Record<BrandVariant, string> = {
  default: "/pre-view-wordmark.png?v=2",
  inverse: "/pre-view-wordmark-white.png?v=2",
};

export default function Logo({
  className = "h-6 w-auto",
  variant = "inverse",
}: LogoProps) {
  return (
    <img
      alt="Pre:View"
      className={className}
      src={WORDMARK_SOURCE[variant]}
    />
  );
}
