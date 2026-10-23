// 인스타 자동 DM 공용 오류. transient=true 면 웹훅이 5xx 로 답해 메타가 다시 보내게 하고,
// false 면 기록만 남기고 200 으로 끝낸다(댓글 답장 DM 은 1통뿐이라 다시 보내도 소용없는 경우).
export class InstagramDmError extends Error {
  constructor(code, { transient = false } = {}) {
    super(code);
    this.name = "InstagramDmError";
    this.code = code;
    this.transient = transient;
  }
}
