// =============================================================================
// 리포트 만족도 설문 정의 — 정본
// =============================================================================
// 문항 키·점수 범위·주관식 최소 길이는 여기서만 정의한다. 클라이언트는
// client/src/constants/labels.ts 에 질문 문구를 두고 키만 맞추며,
// feedbackSurvey.singleSource.test.ts 가 두 쪽이 어긋나면 실패한다.
//
// 키를 바꾸면 저장된 과거 응답과 비교가 끊긴다. 문항을 교체할 때는 컬럼
// 추가/폐기를 동반한 마이그레이션으로 다루고, 조용히 의미만 바꾸지 않는다.

/** 설문 문항 키. 순서가 화면에 보이는 순서다. */
export const SURVEY_QUESTION_KEYS = Object.freeze([
  "reflection",
  "improvement",
  "recommend",
]);

/** 문항 키 → Prisma Feedback 필드명. */
export const SURVEY_SCORE_FIELDS = Object.freeze({
  reflection: "scoreReflection",
  improvement: "scoreImprovement",
  recommend: "scoreRecommend",
});

export const SURVEY_SCORE_MIN = 1;
export const SURVEY_SCORE_MAX = 10;

/** 주관식 최소 길이. 이 길이를 채워야 설문이 완료된 것으로 본다. */
export const SURVEY_MIN_COMMENT_LENGTH = 50;
export const SURVEY_MAX_COMMENT_LENGTH = 2000;

function isScore(value) {
  return (
    Number.isInteger(value)
    && value >= SURVEY_SCORE_MIN
    && value <= SURVEY_SCORE_MAX
  );
}

/**
 * 요청 본문의 scores 가 5개 문항을 모두, 1~10 정수로 담고 있는지 검사한다.
 * 알 수 없는 키가 섞여 있으면 거절한다 — 오타 난 키가 조용히 무시되면
 * 사용자는 답했는데 서버에는 빈 값이 남는다.
 */
export function isCompleteScoreSet(scores) {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return false;
  const keys = Object.keys(scores);
  if (keys.length !== SURVEY_QUESTION_KEYS.length) return false;
  return SURVEY_QUESTION_KEYS.every(
    (key) => Object.hasOwn(scores, key) && isScore(scores[key]),
  );
}

/** scores 를 Prisma 필드명으로 옮긴다. */
export function toScoreColumns(scores) {
  const columns = {};
  for (const key of SURVEY_QUESTION_KEYS) {
    columns[SURVEY_SCORE_FIELDS[key]] = scores[key];
  }
  return columns;
}

/** 저장된 행에서 문항별 점수를 읽어낸다. 과거 👍/👎 응답은 전부 null 이다. */
export function readScores(row) {
  const scores = {};
  for (const key of SURVEY_QUESTION_KEYS) {
    const value = row?.[SURVEY_SCORE_FIELDS[key]];
    scores[key] = Number.isInteger(value) ? value : null;
  }
  return scores;
}

/** 응답한 문항들의 평균. 점수가 하나도 없으면 null. */
export function averageScore(row) {
  const values = Object.values(readScores(row)).filter((value) => value !== null);
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}
