import { parseHighlightedText } from "@/pages/reportFirstImpression";

type Segments = ReturnType<typeof parseHighlightedText>;

/** 형광펜: 글자 아래 절반만 연하게 칠한다. 줄이 바뀌어도 줄마다 따로 칠해진다. */
export const MARKER_CLASS = {
  ok: "bg-[linear-gradient(transparent_56%,#D3F0DF_56%)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
  fix: "bg-[linear-gradient(transparent_56%,#FFE8A3_56%)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
} as const;

/** `**강조**` 세그먼트를 굵은 글씨 + 형광펜으로 그린다. emphasize=false 면 강조 표시 없이 평문으로만 그린다. */
export function renderTextSegments(segments: Segments, emphasize = true) {
  return segments.map((segment, index) => {
    if (emphasize && segment.kind === "bold") {
      return (
        <strong key={`${segment.text}-${index}`} className={`font-bold text-ink ${MARKER_CLASS.ok}`}>
          {segment.text}
        </strong>
      );
    }

    return <span key={`${segment.text}-${index}`}>{segment.text}</span>;
  });
}

/** 마크업은 벗기되 강조는 하지 않는다. 본문 대부분이 이걸 쓴다. */
export function renderRichText(text: string) {
  return renderTextSegments(parseHighlightedText(text), false);
}

/** 상단 리포트 카드용. 강조 표시를 절대 넣지 않는다. */
export function renderCleanText(text: string) {
  return renderTextSegments(parseHighlightedText(text), false);
}

/** 면접 답변·코멘트처럼 핵심 문장을 살릴 곳. */
export function renderEmphasizedText(text: string) {
  return renderTextSegments(parseHighlightedText(text), true);
}
