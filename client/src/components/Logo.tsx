type BrandVariant = "default" | "inverse";

type LogoProps = {
  className?: string;
  variant?: BrandVariant;
};

const WORDMARK_SOURCE: Record<BrandVariant, string> = {
  default: "/pre-view-wordmark.png",
  inverse: "/pre-view-wordmark-white.png",
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
