import type { CSSProperties, ReactNode } from "react";
import type { GuideCoverText } from "@shared/guideFrontmatter";
import type { GuideCoverStyle } from "@/lib/guideSummaries";
import { cn } from "@/lib/utils";

/**
 * 가이드 커버(가로 16:10). 질문형 — 읽는 사람의 고민을 크게 쓰고, 아래에 답 줄을 붙인다(10-07).
 * 구성은 글마다 하나로 고정하고(frontmatter coverStyle), 목록에서 이웃끼리 겹치지 않게 배정한다.
 *   chat  고민 말풍선 + 답 말풍선   quote 큰따옴표 + 분류   plain 분류 + 질문만 크게   mark 질문 + 답 + 큰 물음표
 * 바탕·글꼴·크기 비율은 모든 구성이 같고, 면접 후기는 회사 색 판·흰 로고만 다르다. 글자는 cqw 라 어느 너비에서도 같은 비율이다.
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

// 두 줄짜리 로고(HYUNDAI / AutoEver)는 같은 높이면 작아 보여 따로 키운다(10-06).
const LOGO_HEIGHT_CQW: Record<string, number> = {
  "/guide/logos/autoever-white.svg": 5,
};

const PRE_LINE: CSSProperties = { whiteSpace: "pre-line" };

function Logo({ src }: { src: string | null }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      className="mb-[2.4cqw] w-auto self-start"
      style={{ height: `${LOGO_HEIGHT_CQW[src] ?? 3.2}cqw` }}
    />
  );
}

// 큰 글씨는 700·줄 간격 1.4, 답 줄은 500 으로 가볍게(10-07: 800 굵기에 줄 간격이 좁아 답답하다는 피드백).
function Question({ text, size, className }: { text: string; size: number; className?: string }) {
  return (
    <p className={cn("font-bold leading-[1.4] tracking-[-0.04em]", className)} style={{ ...PRE_LINE, fontSize: `${size}cqw` }}>
      {text}
    </p>
  );
}

function Answer({ text, size, color, className }: { text: string; size: number; color: string; className?: string }) {
  return (
    <p className={cn("font-medium leading-[1.5]", className)} style={{ ...PRE_LINE, fontSize: `${size}cqw`, color }}>
      {text}
    </p>
  );
}

function Body({ text, tone }: { text: GuideCoverText; tone: GuideCoverStyle }): ReactNode {
  // 면접 후기(로고 있음)는 줄이 하나 더 많아 빽빽하다 — 분류 줄을 빼고 글씨를 8% 줄인다(10-07 H2). 답은 한 줄로 쓴다.
  const compact = Boolean(text.logo);
  const k = compact ? 1 : 1.08;
  const label = compact ? "" : text.label;
  const bubble = tone.dark ? "rgba(255,255,255,0.14)" : "#ffffff";
  switch (text.style) {
    case "chat":
      return (
        <div className="flex h-full flex-col justify-center gap-[2cqw] px-[7cqw]">
          <Logo src={text.logo} />
          <p
            className="max-w-[82%] self-start rounded-[3.4cqw_3.4cqw_3.4cqw_1cqw] px-[3.4cqw] py-[2.2cqw] font-bold leading-[1.4]"
            style={{ ...PRE_LINE, fontSize: `${5 * k}cqw`, backgroundColor: bubble }}
          >
            {text.question}
          </p>
          <p
            className="max-w-[82%] self-end rounded-[3.4cqw_3.4cqw_1cqw_3.4cqw] px-[3.4cqw] py-[2.2cqw] font-medium leading-[1.45]"
            style={{
              ...PRE_LINE,
              fontSize: `${3.9 * k}cqw`,
              backgroundColor: tone.accent,
              color: tone.dark ? tone.background : "#ffffff",
            }}
          >
            {text.answer}
          </p>
        </div>
      );
    case "quote":
      return (
        <div className="flex h-full flex-col justify-center px-[7cqw]">
          <Logo src={text.logo} />
          <span
            aria-hidden="true"
            className="font-extrabold leading-[0.6]"
            style={{ fontSize: `${12 * k}cqw`, height: `${5 * k}cqw`, color: tone.accent }}
          >
            “
          </span>
          <Question text={text.question} size={7 * k} />
          <Answer text={text.answer} size={3.6 * k} color={tone.accent} className="mt-[2.4cqw]" />
          {label && (
            <p className="mt-[2cqw] text-[2.8cqw] font-semibold" style={{ color: tone.label }}>
              — {label}
            </p>
          )}
        </div>
      );
    case "mark":
      return (
        <div className="flex h-full items-center justify-between gap-[2cqw] px-[7cqw]">
          <div className="flex min-w-0 flex-col">
            <Logo src={text.logo} />
            <Question text={text.question} size={6.6 * k} />
            <Answer text={text.answer} size={3.6 * k} color={tone.accent} className="mt-[2.4cqw]" />
          </div>
          <span
            aria-hidden="true"
            className="-mr-[2cqw] flex-none text-[28cqw] font-extrabold leading-[0.8]"
            style={{ color: tone.dark ? "rgba(255,255,255,0.14)" : "#e2e6ea" }}
          >
            ?
          </span>
        </div>
      );
    default:
      return (
        <div className="flex h-full flex-col justify-center px-[7cqw]">
          <Logo src={text.logo} />
          {label && (
            <p className="mb-[1.2cqw] text-[2.8cqw] font-semibold" style={{ color: tone.label }}>
              {label}
            </p>
          )}
          <Question text={text.question} size={8 * k} />
          <Answer text={text.answer} size={3.6 * k} color={tone.accent} className="mt-[2.4cqw]" />
        </div>
      );
  }
}

export function GuideCover({ tone, text, image, mini = false, className }: GuideCoverProps) {
  return (
    <div
      className={cn(
        "relative aspect-[16/10] overflow-hidden rounded-2xl tracking-[-0.02em] [container-type:inline-size] [word-break:keep-all]",
        mini && "rounded-md",
        className
      )}
      style={{ backgroundColor: tone.background, color: tone.ink }}
    >
      {image ? (
        <img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        text && !mini && <Body text={text} tone={tone} />
      )}
    </div>
  );
}
