import type { GuideCoverText } from "@shared/guideFrontmatter";
import type { GuideCoverStyle } from "@/lib/guideSummaries";
import { cn } from "@/lib/utils";

/**
 * 가이드 커버(4:5). 블로그 커버와 같은 틀이라 목록에서 무엇을 눌러야 할지 큰 키워드로 보인다(10-06).
 * - image 가 있으면 그 이미지(면접 후기: 회사 색 커버).
 * - 없으면 글자 커버: 작은 분류 줄 → 큰 키워드 → 부제 → 가로선 → 강조 줄. 글자 크기는 cqw 라 어느 너비에서도 같은 비율이다.
 * 너비는 부모가 정한다(카드는 w-full, 본문 머리는 고정 너비).
 */
type GuideCoverProps = {
  tone: GuideCoverStyle;
  text?: GuideCoverText | null;
  image?: string | null;
  /** mini: 이어서 읽기 썸네일. 글자를 그리지 않는다 */
  mini?: boolean;
  className?: string;
};

export function GuideCover({ tone, text, image, mini = false, className }: GuideCoverProps) {
  return (
    <div
      className={cn("relative aspect-[4/5] overflow-hidden rounded-2xl [container-type:inline-size]", mini && "rounded-md", className)}
      style={{ backgroundColor: tone.background, color: tone.ink }}
    >
      {image ? (
        <img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        text &&
        !mini && (
          <div className="flex h-full flex-col justify-center px-[9cqw] tracking-[-0.02em] [word-break:keep-all]">
            {text.label && (
              <p className="text-[3.4cqw] font-semibold" style={{ color: tone.label }}>
                {text.label}
              </p>
            )}
            <p className="mt-[1cqw] text-[12.5cqw] font-extrabold leading-[1.1] tracking-[-0.04em]">{text.title}</p>
            <p className="mt-[0.6cqw] text-[7cqw] font-bold leading-[1.25]">{text.sub}</p>
            <div className="mb-[3.2cqw] mt-[4.5cqw] border-t-[0.3cqw]" style={{ borderColor: tone.ink }} />
            <p className="text-[7.4cqw] font-extrabold leading-[1.2]" style={{ color: tone.accent }}>
              {text.point}
              {text.pointNote && (
                <span className="ml-[1.4cqw] text-[3.3cqw] font-semibold opacity-75" style={{ color: tone.ink }}>
                  {text.pointNote}
                </span>
              )}
            </p>
          </div>
        )
      )}
    </div>
  );
}
