// Gemini Live 임시 토큰(입장권) 발급. 면접관 지시와 자료는 토큰에 잠가 브라우저로 내려가지 않게 한다.
// 토큰 이름은 비밀값이다: 로그·감사 이벤트에 남기지 않고 응답에는 Cache-Control: no-store 를 붙인다.

export const LIVE_MODEL = "gemini-3.8-live";
export const LIVE_VOICE = "Kore";
/** 말이 멈추고 이만큼 조용하면 답변이 끝난 것으로 본다. 생각하며 쉬는 시간을 끊지 않게 넉넉히 둔다. 1단계 실측 뒤 조정한다. */
export const LIVE_SILENCE_MS = 1200;
/**
 * 대화 압축(앞부분 버리기) 시작·목표 토큰. 11-04 실측: 매 턴 대화 전체가 다시 청구되므로 상한을 둬 뒤쪽 턴 비용을 막는다.
 * 사진 10초 간격 + AI 말할 때 전송 멈춤이면 15분 대화가 약 3만 토큰이라 보통은 발동하지 않고, 길어질 때만 앞부분을 버린다.
 * 버려진 답변은 면접관이 잊지만 피드백은 DB 의 대화 글로 만들어 영향이 없다.
 */
export const LIVE_COMPRESSION_TRIGGER_TOKENS = 40_000;
export const LIVE_COMPRESSION_TARGET_TOKENS = 20_000;
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
export function buildLiveSessionConfig({
  systemInstruction,
  silenceMs = LIVE_SILENCE_MS,
  triggerTokens = LIVE_COMPRESSION_TRIGGER_TOKENS,
  targetTokens = LIVE_COMPRESSION_TARGET_TOKENS,
  voiceName = LIVE_VOICE,
}) {
  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: silenceMs } },
    contextWindowCompression: { slidingWindow: { targetTokens: String(targetTokens) }, triggerTokens: String(triggerTokens) },
    // 도구(검색 등)는 쓰지 않는다. fieldMask 에 함께 잠가 입장권을 꺼낸 쪽이 setup 에 도구를 끼워 넣지 못하게 한다.
    tools: [],
    sessionResumption: {},
  };
}

/**
 * REST 는 문서 예시의 liveConnectConstraints 가 아니라 bidiGenerateContentSetup + fieldMask 를 받는다(2026-11-04 실측).
 * fieldMask 에 적은 필드는 토큰 값이 브라우저 setup 을 덮어쓴다. sessionResumption 은 빼서 브라우저가 이어받기 handle 을 보낼 수 있게 한다.
 */
export function buildLiveTokenBody({ config, expireAt, newSessionExpireAt, model = LIVE_MODEL }) {
  const { sessionResumption: _unlocked, ...locked } = config;
  return {
    uses: 1,
    expireTime: expireAt.toISOString(),
    newSessionExpireTime: newSessionExpireAt.toISOString(),
    bidiGenerateContentSetup: { model: `models/${model}`, ...locked },
    fieldMask: ["model", ...Object.keys(locked)].join(","),
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

/**
 * 면접용 Gemini 키. 운영(VERCEL_ENV=production)에서는 전용 키만 쓴다 — 분석용 키를 같이 쓰면 면접 비용 사고가
 * 자소서 분석까지 멈추고, 분리된 예산·한도를 걸 수 없다. 로컬·미리보기에서만 분석용 키로 대신한다.
 */
export function readLiveApiKey(env = process.env) {
  if (env.INTERVIEW_GEMINI_API_KEY) return env.INTERVIEW_GEMINI_API_KEY;
  if (env.VERCEL_ENV === "production") return null;
  return env.GEMINI_API_KEY || null;
}
