export interface QuestionItem {
  id: string;
  question: string;
  answer: string;
}

export interface SavedAnalysisDetail {
  question_text: string;
  input_text: string;
  company_name: string | null;
  job_role: string | null;
}

export function createEmptyQuestion(): QuestionItem {
  return {
    id: crypto.randomUUID(),
    question: "",
    answer: "",
  };
}

function splitSavedQuestionSections(text: string): Map<number, string> {
  const marker = /(?:^|\n{2,})\[문항\s*(\d+)\]\s*/g;
  const matches = Array.from(text.matchAll(marker));

  return new Map(
    matches.map((match, index) => [
      Number(match[1]),
      text
        .slice(
          (match.index ?? 0) + match[0].length,
          matches[index + 1]?.index ?? text.length
        )
        .trim(),
    ])
  );
}

/**
 * 저장된 분석의 question_text / input_text 를 폼 문항으로 되돌린다.
 * lib/analysisSections.parseAnalysisSections 와 비슷하지만 빈 질문을 "문항 N" 으로 채운다.
 */
export function parseSavedQuestions(questionText: string, inputText: string) {
  const savedQuestions = splitSavedQuestionSections(questionText);
  const savedAnswers = splitSavedQuestionSections(inputText);
  const indexes = Array.from(
    new Set([
      ...Array.from(savedQuestions.keys()),
      ...Array.from(savedAnswers.keys()),
    ])
  ).sort((a, b) => a - b);

  if (indexes.length === 0) {
    const question = questionText.trim();
    const answer = inputText.trim();
    return question || answer
      ? [{ question: question || "문항 1", answer }]
      : [];
  }

  return indexes.map(index => ({
    question: savedQuestions.get(index) || `문항 ${index}`,
    answer: savedAnswers.get(index) || "",
  }));
}
