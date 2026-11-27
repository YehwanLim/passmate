// 면접 후기 글(category: 면접 후기)에서 분석 폼으로 오는 입구 문구. 사용자 검수 전 임시안 — 여기만 고치면 띠·카드·폼이 같이 바뀐다.
// 서류에 붙어 면접을 준비하는 사람이 읽는 글이라 "내도 될까요?" 대신 이미 낸 자소서로 예상 질문을 보게 묻는다.
export const INTERVIEW_INTENT_COPY = {
  /** 폰 아래 띠·글 끝 카드 제목. 회사가 없으면 앞말 없이 묻는다 */
  question: (company: string | null) =>
    company
      ? `${company} 면접, 내 자소서로는 뭘 물어볼까요?`
      : "내 자소서로는 뭘 물어볼까요?",
  barButton: "예상 질문 보기",
  cardBody:
    "낸 자소서를 넣으면 면접관이 물을 질문을 뽑아 드려요. 첫 분석은 무료예요.",
  cardButton: "예상 질문 뽑기",
  /** /analyze?intent=interview 첫 화면의 안내 한 줄 */
  formNotice:
    "이미 낸 자소서를 그대로 넣으면 돼요. 리포트에서 예상 질문부터 보여 드릴게요.",
} as const;
