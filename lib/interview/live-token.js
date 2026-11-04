// Gemini Live 임시 토큰(입장권) 발급. 면접관 지시와 자료는 토큰에 잠가 브라우저로 내려가지 않게 한다.
// 토큰 이름은 비밀값이다: 로그·감사 이벤트에 남기지 않고 응답에는 Cache-Control: no-store 를 붙인다.

export const LIVE_MODEL = "gemini-3.8-live";
export const LIVE_VOICE = "Kore";
/** 말이 멈추고 이만큼 조용하면 답변이 끝난 것으로 본다. 생각하며 쉬는 시간을 끊지 않게 넉넉히 둔다. 1단계 실측 뒤 조정한다. */
export const LIVE_SILENCE_MS = 1200;
/** 대화 압축 시작 토큰. 영상 때문에 128k 에 빨리 닿아 여유를 둔다. */
export const LIVE_COMPRESSION_TRIGGER_TOKENS = 100_000;
const TOKEN_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/auth_tokens";
const SOCKET_BASE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

export class LiveTokenError extends Error {
  constructor(code, httpStatus = null) {
    super(code);
    this.name = "LiveTokenError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** 면접 세션 설정. 토큰에 잠긴다. */
export function buildLiveSessionConfig({ systemInstruction, silenceMs = LIVE_SILENCE_MS, triggerTokens = LIVE_COMPRESSION_TRIGGER_TOKENS, voiceName = LIVE_VOICE }) {
  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: silenceMs } },
    contextWindowCompression: { slidingWindow: {}, triggerTokens: String(triggerTokens) },
    sessionResumption: {},
  };
}

export function buildLiveTokenBody({ config, expireAt, newSessionExpireAt, model = LIVE_MODEL }) {
  return {
    uses: 1,
    expireTime: expireAt.toISOString(),
    newSessionExpireTime: newSessionExpireAt.toISOString(),
    liveConnectConstraints: { model: `models/${model}`, config },
  };
}

export function liveSocketUrl(token) {
  return `${SOCKET_BASE}?access_token=${encodeURIComponent(token)}`;
}

/**
 * 토큰을 하나 발급한다. 실패 시 응답 본문은 버리고 상태 코드만 남긴다(본문에 설정이 되돌아올 수 있다).
 * @returns {Promise<{ token: string }>}
 */
export async function issueLiveToken({ apiKey, config, expireAt, newSessionExpireAt, model = LIVE_MODEL, fetcher = globalThis.fetch, timeoutMs = 10_000 }) {
  if (!apiKey) throw new LiveTokenError("LIVE_API_KEY_MISSING");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetcher(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(buildLiveTokenBody({ config, expireAt, newSessionExpireAt, model })),
      signal: controller.signal,
    });
  } catch (error) {
    throw new LiveTokenError(error?.name === "AbortError" ? "LIVE_TOKEN_TIMEOUT" : "LIVE_TOKEN_NETWORK");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new LiveTokenError("LIVE_TOKEN_REJECTED", response.status);
  const payload = await response.json().catch(() => null);
  if (typeof payload?.name !== "string" || payload.name.length === 0) throw new LiveTokenError("LIVE_TOKEN_MALFORMED", response.status);
  return { token: payload.name };
}

export function readLiveApiKey(env = process.env) {
  return env.INTERVIEW_GEMINI_API_KEY || env.GEMINI_API_KEY || null;
}
