import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 가이드 커버. 사진 없이 어두운 바탕에 옅은 색조(oklch)와 큰 번호 윤곽선만으로 글을 구분한다.
 * 색·번호는 lib/guideSummaries.ts 의 guideCoverStyle(목록 인덱스)에서 온다.
 * 제목은 text-balance 로 줄 길이를 고르게 나눈다. keep-all 만 있으면 마지막 어절 하나만 다음 줄로 떨어진다.
 */
type CoverSize = "featured" | "card" | "band" | "mini";

type GuideCoverProps = {
  hue: number;
  number: string;
  size: CoverSize;
  /** featured·card 에서 플레이트 안에 넣는 제목 */
  title?: string;
  /** band 에서 번호 옆에 넣는 메타 줄 등 */
  children?: ReactNode;
  className?: string;
};

const PLATE_CLASS: Record<CoverSize, string> = {
  featured: "h-[300px] rounded-xl p-7 md:h-[420px] md:p-8",
  card: "h-[220px] rounded-[10px] p-5 md:h-[240px]",
  band: "h-[180px] rounded-xl p-6 md:h-[220px] md:p-7",
  mini: "h-14 w-[72px] flex-none rounded-md p-2",
};

const TITLE_CLASS: Record<CoverSize, string> = {
  featured: "max-w-[520px] text-[28px] leading-[1.2] md:text-[44px]",
  card: "max-w-[300px] text-[21px] leading-[1.3] md:text-[22px]",
  band: "",
  mini: "",
};

const NUMBER_STYLE: Record<CoverSize, CSSProperties> = {
  featured: { fontSize: 168, right: 24, bottom: -22 },
  card: { fontSize: 120, right: 18, bottom: -16 },
  band: { fontSize: 200, right: 22, bottom: -30 },
  mini: { fontSize: 22, right: 8, bottom: 6 },
};

export function GuideCover({ hue, number, size, title, children, className }: GuideCoverProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-end overflow-hidden border border-white/[0.08] text-white",
        PLATE_CLASS[size],
        className
      )}
      style={{ backgroundColor: `oklch(0.26 0.022 ${hue})` }}
    >
      {title && (
        <h3 className={cn("relative z-10 m-0 font-bold tracking-[-0.02em] text-balance [word-break:keep-all]", TITLE_CLASS[size])}>
          {title}
        </h3>
      )}
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute font-bold leading-none tracking-[-0.06em]"
        style={{
          ...NUMBER_STYLE[size],
          color: "transparent",
          WebkitTextStroke: `1px oklch(0.84 0.04 ${hue})`,
        }}
      >
        {number}
      </span>
    </div>
  );
}
