// 인스타 자동 DM 문구. 기본 문구는 계정 주인 검수 전에는 바꾸지 않는다(설계 문서 2026-10-23 초안).
// 노션 "DM 자료" 행에 "첫 DM 문구"·"링크 DM 문구"를 쓰면 그 자료는 그 문구를 쓰고, 비어 있으면 기본 문구를 쓴다.
export const FOLLOW_BUTTON_TITLE = "팔로우했어요 ✅";
const FOLLOW_TEXT_HINT = "팔로우 완료";

export function gateText(title, custom) {
  if (custom) return custom;
  return `안녕하세요 한시예요! 댓글 감사드려요. '${title}' 바로 보내 드릴게요. @hansionair 팔로우하고 아래 버튼만 눌러 주세요!`;
}

/** 댓글 답장 DM 에 버튼을 못 붙일 때(메타가 템플릿을 거절할 때) 쓰는 글자 안내. */
export function gateTextFallback(title, custom) {
  if (custom) return `${custom}\n\n버튼이 안 보이면 이 DM에 '${FOLLOW_TEXT_HINT}'라고 답장해 주세요!`;
  return `안녕하세요 한시예요! 댓글 감사드려요. '${title}' 바로 보내 드릴게요. @hansionair 팔로우하고 이 DM에 '${FOLLOW_TEXT_HINT}'라고 답장해 주세요!`;
}

/** 링크는 항상 문구 다음 줄에 붙인다(노션 문구에 링크를 따로 적지 않아도 되게). */
export function linkText(title, url, custom) {
  if (custom) return `${custom}\n${url}`;
  return `📩 ${title}\n${url}\n저장해 두고 필요할 때 꺼내 보세요!`;
}

// 첫 DM 을 보낸 댓글에 다는 공개 대댓글. 똑같은 답글이 줄줄이 달리면 스팸으로 보일 수 있어 돌려 쓴다.
export const COMMENT_REPLIES = [
  "감사합니다! DM으로 자료 보내드렸어요 📩",
  "댓글 감사해요! DM 확인해 주세요 🙌",
  "보내드렸어요! DM 한번 확인해 주세요 🕺",
];

/** 댓글 ID 로 고르므로 같은 댓글은 늘 같은 문구, 댓글마다는 골고루 섞인다. */
export function commentReplyText(commentId) {
  let hash = 0;
  for (const char of String(commentId)) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return COMMENT_REPLIES[hash % COMMENT_REPLIES.length];
}

export const NOT_FOLLOWING_TEXT = "아직 팔로우가 안 보여요 🥲 @hansionair 팔로우하고 다시 눌러 주세요!";
export const NOT_FOLLOWING_TEXT_FALLBACK = `아직 팔로우가 안 보여요 🥲 @hansionair 팔로우하고 다시 '${FOLLOW_TEXT_HINT}'라고 답장해 주세요!`;
