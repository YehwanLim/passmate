// 면접관 사진은 미리 만들어 둔 몇 장(client/public/interview/interviewer-N.jpg, 생성된 가상의 인물) 중 세션마다 하나를 고른다.
// 같은 세션이면 새로고침·재연결 뒤에도 같은 얼굴이 나오도록 세션 id 로 정한다.

export const INTERVIEWER_PHOTO_COUNT = 4;

export function pickInterviewerPhoto(sessionId: string | null | undefined, count = INTERVIEWER_PHOTO_COUNT): string {
  let hash = 0;
  for (const char of sessionId ?? "") hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `/interview/interviewer-${(hash % count) + 1}.jpg`;
}
