// 면접관 인물(사진 + 목소리) 단일 정의처. 서버는 목소리를 입장권에 잠그고, 브라우저는 사진을 보여 주므로
// 둘이 같은 규칙으로 골라야 얼굴과 목소리가 어긋나지 않는다. 사진은 client/public/interview/interviewer-N.jpg(생성된 가상의 인물).

export const INTERVIEWER_PERSONAS = Object.freeze([
  Object.freeze({ id: 1, photo: "/interview/interviewer-1.jpg", voice: "Charon" }),
  Object.freeze({ id: 2, photo: "/interview/interviewer-2.jpg", voice: "Kore" }),
  Object.freeze({ id: 3, photo: "/interview/interviewer-3.jpg", voice: "Charon" }),
  Object.freeze({ id: 4, photo: "/interview/interviewer-4.jpg", voice: "Kore" }),
]);

/** 세션 id 로 면접관을 정한다. 같은 세션이면 새로고침·재연결 뒤에도 같은 사람이다. */
export function pickInterviewer(sessionId, personas = INTERVIEWER_PERSONAS) {
  let hash = 0;
  for (const char of String(sessionId ?? "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return personas[hash % personas.length];
}
