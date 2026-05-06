/**
 * 텍스트 유사도 검사 유틸리티
 * Bigram 기반 Sørensen–Dice coefficient 알고리즘 사용
 */

/**
 * 문자열에서 bigram 집합 생성
 */
function getBigrams(str: string): Map<string, number> {
  const normalized = str.replace(/\s+/g, "").toLowerCase();
  const bigrams = new Map<string, number>();

  for (let i = 0; i < normalized.length - 1; i++) {
    const bigram = normalized.substring(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
  }

  return bigrams;
}

/**
 * Sørensen–Dice coefficient를 사용하여 두 문자열의 유사도를 0~1 사이 값으로 반환
 * 1에 가까울수록 유사
 */
export function textSimilarity(a: string, b: string): number {
  if (!a.trim() || !b.trim()) return 0;
  if (a === b) return 1;

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersectionSize = 0;
  let sizeA = 0;
  let sizeB = 0;

  bigramsA.forEach((count) => {
    sizeA += count;
  });

  bigramsB.forEach((count) => {
    sizeB += count;
  });

  bigramsA.forEach((countA, bigram) => {
    const countB = bigramsB.get(bigram) || 0;
    intersectionSize += Math.min(countA, countB);
  });

  if (sizeA + sizeB === 0) return 0;

  return (2 * intersectionSize) / (sizeA + sizeB);
}

/**
 * 여러 답변 간의 중복 여부 검사
 * threshold(기본 0.9) 이상 유사한 쌍이 있으면 해당 인덱스 쌍을 반환
 * 없으면 null 반환
 */
export function checkDuplicateQuestions(
  answers: string[],
  threshold = 0.9
): [number, number] | null {
  // 빈 답변 제거한 유효 답변만 비교
  const validAnswers = answers
    .map((a, i) => ({ text: a.trim(), index: i }))
    .filter((a) => a.text.length > 0);

  for (let i = 0; i < validAnswers.length; i++) {
    for (let j = i + 1; j < validAnswers.length; j++) {
      const similarity = textSimilarity(
        validAnswers[i].text,
        validAnswers[j].text
      );
      if (similarity >= threshold) {
        return [validAnswers[i].index, validAnswers[j].index];
      }
    }
  }

  return null;
}
