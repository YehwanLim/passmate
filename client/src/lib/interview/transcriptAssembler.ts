// 받아쓰기 조각을 발언 단위로 모은다. 서비스의 정본은 서버에 저장되는 이 대화 글이다(Live 쪽 기억은 압축되어 지워질 수 있다).
// 지원자 조각은 면접관 발언이 시작될 때, 면접관 조각은 턴이 끝날 때 확정한다.

export type TranscriptSpeaker = "CANDIDATE" | "INTERVIEWER";

export type TranscriptTurn = {
  seq: number;
  speaker: TranscriptSpeaker;
  text: string;
  interrupted: boolean;
  partial: boolean;
  offsetMs: number;
};

type Draft = { speaker: TranscriptSpeaker; text: string; startedAt: number; interrupted: boolean } | null;

export function createTranscriptAssembler() {
  const turns: TranscriptTurn[] = [];
  const pending: TranscriptTurn[] = [];
  let draft: Draft = null;
  let seq = 0;

  const commit = (partial: boolean) => {
    if (!draft || !draft.text.trim()) {
      draft = null;
      return;
    }
    const turn: TranscriptTurn = { seq, speaker: draft.speaker, text: draft.text.trim(), interrupted: draft.interrupted, partial, offsetMs: draft.startedAt };
    seq += 1;
    turns.push(turn);
    pending.push(turn);
    draft = null;
  };

  const append = (speaker: TranscriptSpeaker, text: string, at: number) => {
    if (draft && draft.speaker !== speaker) commit(false);
    if (!draft) draft = { speaker, text: "", startedAt: at, interrupted: false };
    // 조각 사이에 공백이 빠져 오는 경우가 있어 한글·영문 경계에 공백을 넣지는 않고 그대로 이어 붙인다.
    draft.text += text;
  };

  return {
    /** 지원자 받아쓰기 조각. */
    candidate(text: string, at: number) {
      append("CANDIDATE", text, at);
    },
    /** 면접관 받아쓰기 조각. */
    interviewer(text: string, at: number) {
      append("INTERVIEWER", text, at);
    },
    /** 면접관 턴이 끝났다. 면접관 발언을 확정한다. */
    turnComplete() {
      if (draft?.speaker === "INTERVIEWER") commit(false);
    },
    /** 지원자가 끊었다. 면접관 발언에 끊김 표시를 하고 확정한다(재생되지 않은 글이 들어 있을 수 있다). */
    interrupted() {
      if (draft?.speaker === "INTERVIEWER") {
        draft.interrupted = true;
        commit(false);
      }
    },
    /** 연결이 끊겼다. 쓰다 만 발언을 미완성으로 확정해 잃지 않는다. */
    flushPartial() {
      commit(true);
    },
    /** 아직 서버에 보내지 않은 발언을 꺼낸다(비운다). 저장이 실패하면 다시 넣는다. */
    takePending(): TranscriptTurn[] {
      return pending.splice(0, pending.length);
    },
    requeue(items: TranscriptTurn[]) {
      pending.unshift(...items);
    },
    get turns(): readonly TranscriptTurn[] {
      return turns;
    },
    get draftText(): string {
      return draft?.text ?? "";
    },
    get draftSpeaker(): TranscriptSpeaker | null {
      return draft?.speaker ?? null;
    },
    candidateTurnCount(): number {
      return turns.filter((turn) => turn.speaker === "CANDIDATE").length;
    },
  };
}

export type TranscriptAssembler = ReturnType<typeof createTranscriptAssembler>;
