import type { CSSProperties } from "react";

/** 현직자 코멘트 세 블록의 제목과 번호 색. 순서는 splitMentorComment 의 블록 순서와 같다. */
export const MENTOR_COMMENT_STYLES = [
  { title: "첫인상", numberClassName: "text-[#A7A8FF]" },
  { title: "보완하면 좋을 점", numberClassName: "text-[#D9B94B]" },
  { title: "면접 체크포인트", numberClassName: "text-[#69D5B1]" },
];

export type HighlightTone = "strength" | "gap" | "interview";

// 굵은 글씨 대신 문장 아래에 얇은 밑줄 띠를 깐다. 색만 톤별로 다르다.
function underline(rgba: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(to top, ${rgba} 0 6px, transparent 6px)`,
    backgroundPosition: "0 100%",
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
    borderRadius: "2px",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  };
}

export const HIGHLIGHT_UNDERLINE_STYLES: Record<HighlightTone, CSSProperties> = {
  strength: underline("rgba(105, 211, 177, 0.34)"),
  gap: underline("rgba(217, 185, 75, 0.32)"),
  interview: underline("rgba(123, 184, 255, 0.3)"),
};
