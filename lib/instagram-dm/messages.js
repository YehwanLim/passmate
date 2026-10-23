// 인스타 자동 DM 문구. 계정 주인 검수 전에는 바꾸지 않는다(설계 문서 2026-10-23 초안).
export const FOLLOW_BUTTON_TITLE = "팔로우했어요 ✅";
const FOLLOW_TEXT_HINT = "팔로우 완료";

export function gateText(title) {
  return `안녕하세요! 한시예요 🙌 댓글 고마워요. '${title}' 바로 보내 드릴게요. @hansionair 팔로우하고 아래 버튼만 눌러 주세요!`;
}

/** 댓글 답장 DM 에 버튼을 못 붙일 때(메타가 템플릿을 거절할 때) 쓰는 글자 안내. */
export function gateTextFallback(title) {
  return `안녕하세요! 한시예요 🙌 댓글 고마워요. '${title}' 바로 보내 드릴게요. @hansionair 팔로우하고 이 DM에 '${FOLLOW_TEXT_HINT}'라고 답장해 주세요!`;
}

export function linkText(title, url) {
  return `📩 ${title}\n${url}\n저장해 두고 필요할 때 꺼내 보세요!`;
}

export const NOT_FOLLOWING_TEXT = "아직 팔로우가 안 보여요 🥲 @hansionair 팔로우하고 다시 눌러 주세요!";
export const NOT_FOLLOWING_TEXT_FALLBACK = `아직 팔로우가 안 보여요 🥲 @hansionair 팔로우하고 다시 '${FOLLOW_TEXT_HINT}'라고 답장해 주세요!`;
