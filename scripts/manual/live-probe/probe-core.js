// Gemini Live 시험 도구의 순수 함수. 브라우저와 Node 양쪽에서 쓴다(DOM·네트워크 없음).

export const LIVE_MODEL = "gemini-3.8-live";
export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;

// 공식 가격표(2026-11-04 확인) 기준 100만 토큰당 달러.
const PRICE_PER_MILLION = {
  input: { TEXT: 0.75, AUDIO: 3, VIDEO: 1, IMAGE: 1 },
  output: { TEXT: 4.5, AUDIO: 12 },
};

/** 브라우저 마이크(보통 48kHz)를 16kHz 16비트로 줄인다. 구간 평균이라 간단한 저역 통과 효과가 있다. */
export function downsampleTo16k(samples, inputRate) {
  if (inputRate < INPUT_SAMPLE_RATE) throw new Error("INPUT_RATE_TOO_LOW");
  const ratio = inputRate / INPUT_SAMPLE_RATE;
  const length = Math.floor(samples.length / ratio);
  const output = new Int16Array(length);
  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) sum += samples[cursor];
    const value = Math.max(-1, Math.min(1, sum / (end - start)));
    output[index] = value < 0 ? Math.round(value * 32768) : Math.round(value * 32767);
  }
  return output;
}

export function int16ToBase64(samples) {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

/** 서버가 보낸 16비트 PCM(base64)을 Web Audio 가 쓰는 -1~1 실수로 바꾼다. */
export function base64ToFloat32(data) {
  const binary = atob(data);
  const output = new Float32Array(Math.floor(binary.length / 2));
  for (let index = 0; index < output.length; index += 1) {
    const low = binary.charCodeAt(index * 2);
    const high = binary.charCodeAt(index * 2 + 1);
    const value = (high << 8) | low;
    output[index] = (value >= 0x8000 ? value - 0x10000 : value) / 32768;
  }
  return output;
}

export function rootMeanSquare(samples) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
  return Math.sqrt(sum / samples.length);
}

/** 면접 세션 설정. 토큰에 잠글 때와 브라우저 setup 으로 보낼 때 같은 모양을 쓴다. */
export function buildSessionConfig({ systemInstruction, silenceMs, triggerTokens, voiceName = "Kore", turnCoverage }) {
  const config = {
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
  if (systemInstruction) config.systemInstruction = { parts: [{ text: systemInstruction }] };
  if (turnCoverage) config.realtimeInputConfig.turnCoverage = turnCoverage;
  return config;
}

/** 브라우저가 보내는 setup. 이어받기(sessionResumption)는 토큰에 잠기지 않아 여기서 보내야 한다. */
export function buildSetupMessage({ model = LIVE_MODEL, config = {}, resumeHandle = null }) {
  const setup = { model: `models/${model}`, ...config, sessionResumption: resumeHandle ? { handle: resumeHandle } : {} };
  return { setup };
}

/**
 * 임시 토큰 요청 본문. REST 는 문서 예시의 liveConnectConstraints 가 아니라
 * bidiGenerateContentSetup(setup 내용을 바로 펼침) + fieldMask 를 받는다(2026-11-04 실측, v1beta discovery 문서와 일치).
 * fieldMask 에 적은 필드는 토큰 값이 브라우저 setup 을 덮어쓴다. sessionResumption 은 빼서 브라우저가 이어받기 handle 을 보낼 수 있게 한다.
 */
export function buildTokenBody({ now, expireMinutes, model = LIVE_MODEL, config }) {
  const expireTime = new Date(now + expireMinutes * 60_000).toISOString();
  const newSessionExpireTime = new Date(now + 2 * 60_000).toISOString();
  const { sessionResumption: _unlocked, ...locked } = config;
  return {
    uses: 1,
    expireTime,
    newSessionExpireTime,
    bidiGenerateContentSetup: { model: `models/${model}`, ...locked },
    fieldMask: ["model", ...Object.keys(locked)].join(","),
  };
}

export function liveSocketUrls(token) {
  const query = `access_token=${encodeURIComponent(token)}`;
  // 공식 문서는 v1beta, SDK 참조는 v1alpha 라고 적어 서로 다르다. 앞에서부터 시도한다.
  return ["v1beta", "v1alpha"].map(
    (version) =>
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${version}.GenerativeService.BidiGenerateContentConstrained?${query}`,
  );
}

/** 서버 메시지를 다루기 쉬운 사건 목록으로 편다. 음성 본문은 audio 사건에만 남는다. */
export function readServerMessage(message) {
  const events = [];
  if (message.setupComplete) events.push({ type: "setupComplete" });
  if (message.goAway) events.push({ type: "goAway", timeLeft: message.goAway.timeLeft ?? null });
  if (message.sessionResumptionUpdate) {
    const { newHandle = null, resumable = false } = message.sessionResumptionUpdate;
    events.push({ type: "resumption", newHandle, resumable });
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

/** 기록용으로 메시지를 복사하되 음성 본문은 길이만 남긴다. 나중에 가짜 소켓 재생 자료로 쓴다. */
export function redactAudio(message) {
  return JSON.parse(
    JSON.stringify(message, (key, value) => (key === "data" && typeof value === "string" ? `<${value.length} chars>` : value)),
  );
}

export function percentile(values, ratio) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function tokensByModality(details = []) {
  const totals = {};
  for (const { modality, tokenCount = 0 } of details) totals[modality] = (totals[modality] ?? 0) + tokenCount;
  return totals;
}

function priceOf(totals, table) {
  return Object.entries(totals).reduce((sum, [modality, count]) => sum + (count / 1_000_000) * (table[modality] ?? 0), 0);
}

/**
 * usageMetadata 를 두 가지로 합산한다. 값이 메시지마다 누적인지 턴별인지 문서에 없어서,
 * 마지막 값과 전체 합을 모두 남기고 실제 청구액과 대조해 어느 쪽이 맞는지 판단한다.
 */
export function summarizeUsage(samples) {
  const empty = { promptTokens: 0, responseTokens: 0, input: {}, output: {}, usd: 0 };
  const sum = { ...empty, input: {}, output: {} };
  let last = empty;
  for (const usage of samples) {
    const input = tokensByModality(usage.promptTokensDetails);
    const output = tokensByModality(usage.responseTokensDetails);
    last = {
      promptTokens: usage.promptTokenCount ?? 0,
      responseTokens: usage.responseTokenCount ?? 0,
      input,
      output,
      usd: priceOf(input, PRICE_PER_MILLION.input) + priceOf(output, PRICE_PER_MILLION.output),
    };
    sum.promptTokens += last.promptTokens;
    sum.responseTokens += last.responseTokens;
    sum.usd += last.usd;
    for (const [key, count] of Object.entries(input)) sum.input[key] = (sum.input[key] ?? 0) + count;
    for (const [key, count] of Object.entries(output)) sum.output[key] = (sum.output[key] ?? 0) + count;
  }
  return { samples: samples.length, last, sum };
}

/**
 * 말하다 쉰 구간을 세어 AI가 끼어든 비율을 잰다. 2.5~4.5초 쉬고 다시 말하면 "쉼" 1회이고,
 * 그 사이 AI가 말을 시작했으면 끼어듦이다.
 */
export function createSpeechTracker({ threshold = 0.012, minPauseMs = 2500, maxPauseMs = 4500 } = {}) {
  const state = { speaking: false, lastSpeechAt: null, modelStartedAt: null, pauses: 0, cutIns: 0, latencies: [] };
  return {
    onMicLevel(level, at) {
      if (level < threshold) return;
      if (state.lastSpeechAt !== null) {
        const gap = at - state.lastSpeechAt;
        if (gap >= minPauseMs && gap <= maxPauseMs) {
          state.pauses += 1;
          if (state.modelStartedAt !== null && state.modelStartedAt > state.lastSpeechAt) {
            state.cutIns += 1;
            state.latencies.pop();
          }
        }
      }
      state.lastSpeechAt = at;
    },
    onModelTurnStart(at) {
      state.modelStartedAt = at;
      if (state.lastSpeechAt !== null) state.latencies.push(at - state.lastSpeechAt);
    },
    snapshot() {
      return { pauses: state.pauses, cutIns: state.cutIns, latencies: [...state.latencies] };
    },
  };
}

/** 계획서의 통과 기준. 비용 기준은 Cloud Billing 값이 있어야 판정한다. */
export function evaluateGate(result, { billedUsd = null, expectedUsd = 0.2 } = {}) {
  const heldMinutes = result.heldMs / 60_000;
  const latencyP50 = percentile(result.speech.latencies, 0.5);
  const latencyP90 = percentile(result.speech.latencies, 0.9);
  const { pauses, cutIns } = result.speech;
  const checks = {
    held: { pass: heldMinutes >= 15, value: Number(heldMinutes.toFixed(1)), needs: "15분 유지" },
    latencyP50: { pass: latencyP50 !== null && latencyP50 <= 1500, value: latencyP50, needs: "1,500ms 이하" },
    latencyP90: { pass: latencyP90 !== null && latencyP90 <= 3000, value: latencyP90, needs: "3,000ms 이하" },
    noCutIn: {
      pass: pauses >= 10 && (pauses - cutIns) / pauses >= 0.8,
      value: `${pauses - cutIns}/${pauses}`,
      needs: "쉼 10회 이상 중 80% 이상 안 끊김",
    },
    cost: {
      pass: billedUsd === null ? null : billedUsd <= expectedUsd * 3,
      value: billedUsd,
      needs: `실제 청구 $${(expectedUsd * 3).toFixed(2)} 이하 (Cloud Billing 확인 필요)`,
    },
  };
  const values = Object.values(checks).map((check) => check.pass);
  return { checks, passed: values.every((value) => value === true), pendingBilling: billedUsd === null };
}

// 비용 차단. 11-04 실측: 매 턴 대화 전체(사진 포함)가 다시 청구된다. 1초 1장이면 2분에 $0.094, 대화가 길어질수록
// 턴당 금액이 커져 15분은 약 $2.8 로 추정된다. 그 값을 분당으로 올려 잡는다(사진 간격을 늘리면 실제는 훨씬 적다).
export const WORST_USD_PER_MINUTE = 0.2;
export const KRW_PER_USD = 1400;
export const BUDGET_KRW = 10_000;

/** 분당 최악 단가. 글·음성 몫 $0.06 + 사진 몫 $0.14(1초 1장 기준, 간격에 비례해 줄어든다). 영상을 끄면 글·음성 몫만. */
export function worstUsdPerMinute({ video = true, frameMs = 1000 } = {}) {
  if (!video) return 0.06;
  return 0.06 + 0.14 * Math.min(1, 1000 / Math.max(1000, Number(frameMs) || 1000));
}

export function worstCaseKrw(minutes, usdPerMinute = WORST_USD_PER_MINUTE) {
  return minutes * usdPerMinute * KRW_PER_USD;
}

/** 원장 항목을 합산한다. 끝난 세션은 실제 분, 안 끝난 세션은 예약한 분으로 친다. 단가를 안 적은 옛 항목은 최악 단가다. */
export function spentKrw(entries) {
  return entries.reduce((sum, entry) => sum + worstCaseKrw(entry.actualMinutes ?? entry.reservedMinutes, entry.usdPerMinute ?? WORST_USD_PER_MINUTE), 0);
}

export function canReserve(entries, minutes, usdPerMinute = WORST_USD_PER_MINUTE) {
  return spentKrw(entries) + worstCaseKrw(minutes, usdPerMinute) <= BUDGET_KRW;
}
