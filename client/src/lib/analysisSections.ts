// =============================================================================
// 분석 원문 파서 — analyses.question_text / input_text 를 문항별로 분리
// =============================================================================
// 서버(api/analyze.js)는 여러 문항을 하나의 Analysis 행에 합쳐 저장한다:
//   questionText: "[문항 1] 질문1\n\n[문항 2] 질문2"
//   inputText:    "[문항 1]\n답변1\n\n[문항 2]\n답변2"
// 이 유틸은 그 형식을 다시 문항 단위로 분해한다. 마커가 없으면
// 전체 텍스트를 단일 문항으로 취급한다(구버전/예외 데이터 안전망).
// =============================================================================

export interface AnalysisSection {
  /** 문항 질문 (마커 제거, 없으면 빈 문자열) */
  question: string;
  /** 사용자가 작성한 답변 원문 (없으면 빈 문자열) */
  answer: string;
}

/** 줄 시작의 "[문항 N]" 마커 기준으로 텍스트를 분리한다. */
function splitByMarker(text: string): Map<number, string> {
  const sections = new Map<number, string>();
  const pattern = /(?:^|\n)\[문항 (\d+)\][ \t]*\n?/g;
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match);
  }
  if (matches.length === 0) return sections;

  matches.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    sections.set(Number(m[1]), text.slice(start, end).trim());
  });
  return sections;
}

/**
 * question_text / input_text 를 문항 번호로 짝지어 섹션 배열로 만든다.
 * input_text 가 아직 없으면(목록 응답) 질문만 채워진 섹션을 돌려준다.
 */
export function parseAnalysisSections(
  questionText: string | null | undefined,
  inputText?: string | null,
): AnalysisSection[] {
  const questions = splitByMarker(questionText ?? "");
  const answers = splitByMarker(inputText ?? "");

  const numberSet = new Set<number>();
  questions.forEach((_, key) => numberSet.add(key));
  answers.forEach((_, key) => numberSet.add(key));
  const numbers = Array.from(numberSet).sort((a, b) => a - b);
  if (numbers.length === 0) {
    // 마커가 전혀 없는 데이터: 통짜 텍스트를 단일 문항으로
    const question = (questionText ?? "").trim();
    const answer = (inputText ?? "").trim();
    if (!question && !answer) return [];
    return [{ question, answer }];
  }

  return numbers.map((n) => ({
    question: questions.get(n) ?? "",
    answer: answers.get(n) ?? "",
  }));
}
