import { parseHighlightedText } from "@/pages/reportFirstImpression";
import { HIGHLIGHT_UNDERLINE_STYLES, type HighlightTone } from "@/pages/reportStyles";

type Segments = ReturnType<typeof parseHighlightedText>;

/** `**강조**` 세그먼트를 톤별 밑줄로 그린다. emphasize=false 면 강조 표시 없이 평문으로만 그린다. */
export function renderTextSegments(segments: Segments, tone: HighlightTone = "interview", emphasize = true) {
  return segments.map((segment, index) => {
    if (emphasize && segment.kind === "bold") {
      return (
        <strong
          key={`${segment.text}-${index}`}
          className="rounded-[2px] font-semibold text-zinc-100"
          style={HIGHLIGHT_UNDERLINE_STYLES[tone]}
        >
          {segment.text}
        </strong>
      );
    }

    return <span key={`${segment.text}-${index}`}>{segment.text}</span>;
  });
}

/** 마크업은 벗기되 강조는 하지 않는다. 본문 대부분이 이걸 쓴다. */
export function renderRichText(text: string, tone: HighlightTone = "interview") {
  return renderTextSegments(parseHighlightedText(text), tone, false);
}

/** 상단 리포트 카드용. 강조 표시를 절대 넣지 않는다. */
export function renderCleanText(text: string) {
  return renderTextSegments(parseHighlightedText(text), "interview", false);
}

/** 면접 답변·코멘트처럼 핵심 문장 밑줄을 살릴 곳. */
export function renderEmphasizedText(text: string, tone: HighlightTone = "interview") {
  return renderTextSegments(parseHighlightedText(text), tone, true);
}
