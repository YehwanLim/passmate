import type { GuideCoverText } from "@shared/guideFrontmatter";
import type { GuideCoverStyle } from "@/lib/guideSummaries";
import { cn } from "@/lib/utils";

/**
 * 가이드 커버(가로 16:10). 블로그 커버와 같은 틀이라 목록에서 무엇을 눌러야 할지 큰 키워드로 보인다(10-06).
 * 세로 4:5 는 정보량에 비해 커서 가로로 바꿨다(10-06 피드백).
 * - 글자 커버: (로고) → 작은 분류 줄 → 큰 키워드 → 부제 → 가로선 → 강조 줄. 글자 크기는 cqw 라 어느 너비에서도 같은 비율이다.
 *   면접 후기도 같은 틀로 그리고 회사 색·흰 로고만 다르다(이미지 커버는 글씨 크기가 달라 일관성이 깨졌다, 10-06).
 * - image 는 글자 커버가 없는 글을 위한 예비 경로다.
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
      className={cn("relative aspect-[16/10] overflow-hidden rounded-2xl [container-type:inline-size]", mini && "rounded-md", className)}
      style={{ backgroundColor: tone.background, color: tone.ink }}
    >
      {image ? (
        <img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        text &&
        !mini && (
          <div className="flex h-full flex-col justify-center px-[7cqw] tracking-[-0.02em] [word-break:keep-all]">
            {text.logo && <img src={text.logo} alt="" className="mb-[3.2cqw] h-[3.4cqw] w-auto self-start" />}
            {text.label && (
              <p className="text-[2.8cqw] font-semibold" style={{ color: tone.label }}>
                {text.label}
              </p>
            )}
            <p className="mt-[0.8cqw] text-[9cqw] font-extrabold leading-[1.1] tracking-[-0.04em]">{text.title}</p>
            <p className="mt-[0.5cqw] text-[5cqw] font-bold leading-[1.25]">{text.sub}</p>
            <div className="mb-[2.4cqw] mt-[3.4cqw] border-t-[0.25cqw]" style={{ borderColor: tone.ink }} />
            <p className="text-[5.4cqw] font-extrabold leading-[1.2]" style={{ color: tone.accent }}>
              {text.point}
              {text.pointNote && (
                <span className="ml-[1.2cqw] text-[2.6cqw] font-semibold opacity-75" style={{ color: tone.ink }}>
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
