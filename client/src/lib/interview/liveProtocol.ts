// Gemini Live WebSocket 메시지 모양. 보내는 쪽은 만들고, 받는 쪽은 다루기 쉬운 사건 목록으로 편다.
// 면접관 지시·자료는 입장권(토큰)에 잠겨 있어 브라우저는 모델 이름과 이어받기 값만 보낸다.

export type LiveServerEvent =
  | { type: "setupComplete" }
  | { type: "audio"; data: string }
  | { type: "inputText"; text: string }
  | { type: "outputText"; text: string }
  | { type: "interrupted" }
  | { type: "generationComplete" }
  | { type: "turnComplete" }
  | { type: "usage"; usage: Record<string, unknown> }
  | { type: "resumption"; newHandle: string | null; resumable: boolean }
  | { type: "goAway"; timeLeft: string | null };

export function buildSetupMessage({ model, resumeHandle }: { model: string; resumeHandle: string | null }) {
  const setup: Record<string, unknown> = { model: `models/${model}` };
  if (resumeHandle) setup.sessionResumption = { handle: resumeHandle };
  return { setup };
}

export function buildAudioMessage(base64Pcm16k: string) {
  return { realtimeInput: { audio: { data: base64Pcm16k, mimeType: "audio/pcm;rate=16000" } } };
}

export function buildVideoMessage(base64Jpeg: string) {
  return { realtimeInput: { video: { data: base64Jpeg, mimeType: "image/jpeg" } } };
}

/** 글 한 줄을 사용자 발언으로 넣는다. turnComplete 가 true 면 모델이 바로 답한다(진행 중 생성은 끊긴다). */
export function buildTextMessage(text: string, turnComplete = true) {
  return { clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete } };
}

type ServerMessage = {
  setupComplete?: unknown;
  goAway?: { timeLeft?: string };
  sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean };
  usageMetadata?: Record<string, unknown>;
  serverContent?: {
    interrupted?: boolean;
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
    generationComplete?: boolean;
    turnComplete?: boolean;
  };
};

export function readServerMessage(raw: unknown): LiveServerEvent[] {
  const message = (raw ?? {}) as ServerMessage;
  const events: LiveServerEvent[] = [];
  if (message.setupComplete !== undefined) events.push({ type: "setupComplete" });
  if (message.goAway) events.push({ type: "goAway", timeLeft: message.goAway.timeLeft ?? null });
  if (message.sessionResumptionUpdate) {
    events.push({
      type: "resumption",
      newHandle: message.sessionResumptionUpdate.newHandle ?? null,
      resumable: message.sessionResumptionUpdate.resumable === true,
    });
  }
  if (message.usageMetadata) events.push({ type: "usage", usage: message.usageMetadata });
  const content = message.serverContent;
  if (content) {
    if (content.interrupted) events.push({ type: "interrupted" });
    if (content.inputTranscription?.text) events.push({ type: "inputText", text: content.inputTranscription.text });
    if (content.outputTranscription?.text) events.push({ type: "outputText", text: content.outputTranscription.text });
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) events.push({ type: "audio", data: part.inlineData.data });
    }
    if (content.generationComplete) events.push({ type: "generationComplete" });
    if (content.turnComplete) events.push({ type: "turnComplete" });
  }
  return events;
}
