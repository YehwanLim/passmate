import { describe, expect, it } from "vitest";

import {
  BUDGET_KRW,
  base64ToFloat32,
  buildSessionConfig,
  buildSetupMessage,
  buildTokenBody,
  canReserve,
  createSpeechTracker,
  downsampleTo16k,
  evaluateGate,
  int16ToBase64,
  percentile,
  readServerMessage,
  redactAudio,
  rootMeanSquare,
  spentKrw,
  summarizeUsage,
  worstCaseKrw,
} from "./probe-core.js";

describe("오디오 변환", () => {
  it("48kHz 를 16kHz 로 줄이면 길이가 3분의 1이 되고 구간 평균을 쓴다", () => {
    const input = new Float32Array([0.3, 0.3, 0.3, -0.6, -0.6, -0.6]);
    const output = downsampleTo16k(input, 48000);
    expect(output.length).toBe(2);
    expect(output[0]).toBe(Math.round(0.3 * 32767));
    expect(output[1]).toBe(Math.round(-0.6 * 32768));
  });

  it("16kHz 는 그대로 두고 범위를 넘는 값은 자른다", () => {
    expect(Array.from(downsampleTo16k(new Float32Array([2, -2]), 16000))).toEqual([32767, -32768]);
  });

  it("16kHz 미만 입력은 거부한다", () => {
    expect(() => downsampleTo16k(new Float32Array(10), 8000)).toThrow("INPUT_RATE_TOO_LOW");
  });

  it("PCM 을 base64 로 보냈다가 받으면 값이 유지된다", () => {
    const decoded = base64ToFloat32(int16ToBase64(new Int16Array([0, 16384, -16384, -32768])));
    expect(Array.from(decoded)).toEqual([0, 0.5, -0.5, -1]);
  });

  it("음량을 계산한다", () => {
    expect(rootMeanSquare(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
    expect(rootMeanSquare(new Float32Array())).toBe(0);
  });
});

describe("연결 설정", () => {
  const config = buildSessionConfig({ systemInstruction: "면접관", silenceMs: 800, triggerTokens: 100000 });

  it("면접에 필요한 설정을 모두 담는다", () => {
    expect(config.generationConfig.responseModalities).toEqual(["AUDIO"]);
    expect(config.inputAudioTranscription).toEqual({});
    expect(config.outputAudioTranscription).toEqual({});
    expect(config.contextWindowCompression).toEqual({ slidingWindow: {}, triggerTokens: "100000" });
    expect(config.realtimeInputConfig.automaticActivityDetection.silenceDurationMs).toBe(800);
    expect(config.systemInstruction.parts[0].text).toBe("면접관");
  });

  it("재연결이면 이어받기 값을 setup 에 넣는다", () => {
    const message = buildSetupMessage({ resumeHandle: "abc" });
    expect(message.setup.model).toBe("models/gemini-3.8-live");
    expect(message.setup.sessionResumption).toEqual({ handle: "abc" });
  });

  it("토큰은 1회용이고 만료 시각을 분 단위로 계산한다", () => {
    const now = Date.UTC(2026, 10, 4);
    const body = buildTokenBody({ now, expireMinutes: 17, config });
    expect(body.uses).toBe(1);
    expect(body.expireTime).toBe(new Date(now + 17 * 60_000).toISOString());
    expect(body.liveConnectConstraints.config).toBe(config);
  });

  it("SDK 형태 토큰 본문은 잠글 필드 목록을 함께 보낸다", () => {
    const body = buildTokenBody({ now: 0, expireMinutes: 1, config, variant: "sdk" });
    expect(body.bidiGenerateContentSetup.setup.systemInstruction).toBeTruthy();
    expect(body.fieldMask).toContain("systemInstruction");
  });
});

describe("서버 메시지 읽기", () => {
  it("한 메시지의 음성·받아쓰기·턴 종료를 사건으로 편다", () => {
    const events = readServerMessage({
      usageMetadata: { totalTokenCount: 3 },
      serverContent: {
        outputTranscription: { text: "안녕" },
        modelTurn: { parts: [{ inlineData: { data: "AAAA" } }] },
        turnComplete: true,
      },
    });
    expect(events.map((event) => event.type)).toEqual(["usage", "outputText", "audio", "turnComplete"]);
  });

  it("끊기기 전 신호와 이어받기 값을 읽는다", () => {
    expect(readServerMessage({ goAway: { timeLeft: "30s" } })).toEqual([{ type: "goAway", timeLeft: "30s" }]);
    expect(readServerMessage({ sessionResumptionUpdate: { newHandle: "h", resumable: true } })).toEqual([
      { type: "resumption", newHandle: "h", resumable: true },
    ]);
  });

  it("기록에는 음성 본문 대신 길이만 남긴다", () => {
    const redacted = redactAudio({ serverContent: { modelTurn: { parts: [{ inlineData: { data: "AAAA" } }] } } });
    expect(redacted.serverContent.modelTurn.parts[0].inlineData.data).toBe("<4 chars>");
  });
});

describe("측정", () => {
  it("백분위를 구한다", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
    expect(percentile([], 0.5)).toBeNull();
  });

  it("쉬고 다시 말했는데 그 사이 AI가 시작했으면 끼어듦으로 세고 지연값에서 뺀다", () => {
    const tracker = createSpeechTracker();
    tracker.onMicLevel(0.1, 1000);
    tracker.onModelTurnStart(2500);
    tracker.onMicLevel(0.1, 4000);
    expect(tracker.snapshot()).toEqual({ pauses: 1, cutIns: 1, latencies: [] });
  });

  it("AI가 기다렸으면 끼어듦이 아니고, 말이 끝난 뒤 시작은 지연값이 된다", () => {
    const tracker = createSpeechTracker();
    tracker.onMicLevel(0.1, 1000);
    tracker.onMicLevel(0.1, 4000);
    tracker.onModelTurnStart(5200);
    expect(tracker.snapshot()).toEqual({ pauses: 1, cutIns: 0, latencies: [1200] });
  });

  it("토큰 사용량을 종류별로 합치고 가격표로 금액을 낸다", () => {
    const summary = summarizeUsage([
      {
        promptTokenCount: 1_000_000,
        responseTokenCount: 1_000_000,
        promptTokensDetails: [
          { modality: "AUDIO", tokenCount: 500_000 },
          { modality: "VIDEO", tokenCount: 500_000 },
        ],
        responseTokensDetails: [{ modality: "AUDIO", tokenCount: 1_000_000 }],
      },
    ]);
    expect(summary.last.usd).toBeCloseTo(1.5 + 0.5 + 12);
    expect(summary.sum.input.VIDEO).toBe(500_000);
  });
});

describe("통과 판정", () => {
  const good = {
    heldMs: 15 * 60_000,
    speech: { pauses: 10, cutIns: 2, latencies: [1000, 1200, 1400, 1500, 1500, 1500, 1500, 1500, 2000, 2500] },
  };

  it("기준을 넘겨도 청구액이 없으면 통과라고 하지 않는다", () => {
    const gate = evaluateGate(good);
    expect(gate.passed).toBe(false);
    expect(gate.pendingBilling).toBe(true);
    expect(gate.checks.held.pass).toBe(true);
    expect(gate.checks.noCutIn.pass).toBe(true);
  });

  it("청구액까지 맞으면 통과한다", () => {
    expect(evaluateGate(good, { billedUsd: 0.5 }).passed).toBe(true);
  });

  it("15분을 못 버티거나 쉼 표본이 적거나 비싸면 실패다", () => {
    expect(evaluateGate({ ...good, heldMs: 60_000 }, { billedUsd: 0.1 }).checks.held.pass).toBe(false);
    expect(evaluateGate({ ...good, speech: { ...good.speech, pauses: 3, cutIns: 0 } }).checks.noCutIn.pass).toBe(false);
    expect(evaluateGate(good, { billedUsd: 0.61 }).passed).toBe(false);
  });
});

describe("비용 차단", () => {
  it("끝난 세션은 실제 시간, 안 끝난 세션은 예약 시간으로 친다", () => {
    const spent = spentKrw([{ reservedMinutes: 16, actualMinutes: 2 }, { reservedMinutes: 16 }]);
    expect(spent).toBeCloseTo(worstCaseKrw(18));
  });

  it("상한을 넘길 예약은 거부한다", () => {
    const fullMinutes = Math.floor(BUDGET_KRW / worstCaseKrw(1));
    expect(canReserve([{ reservedMinutes: fullMinutes - 16 }], 16)).toBe(true);
    expect(canReserve([{ reservedMinutes: fullMinutes }], 16)).toBe(false);
  });
});
