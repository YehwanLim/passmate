import { describe, expect, it } from "vitest";

import { parseSession } from "./interviewApi";
import { buildAudioMessage, buildSetupMessage, buildTextMessage, buildVideoMessage, readServerMessage } from "./liveProtocol";
import { base64ToFloat32, concatFloat32, downsampleToInt16, int16ToBase64, rootMeanSquare } from "./pcm";
import { createPhotoSampler } from "./photoSampler";
import { createTranscriptAssembler } from "./transcriptAssembler";

describe("오디오 변환", () => {
  it("48kHz 를 16kHz 로 줄이면 길이가 3분의 1이 되고 구간 평균을 쓴다", () => {
    const output = downsampleToInt16(new Float32Array([0.3, 0.3, 0.3, -0.6, -0.6, -0.6]), 48000);
    expect(Array.from(output)).toEqual([Math.round(0.3 * 32767), Math.round(-0.6 * 32768)]);
    expect(() => downsampleToInt16(new Float32Array(4), 8000)).toThrow("INPUT_RATE_TOO_LOW");
  });

  it("PCM 을 base64 로 보냈다가 받으면 값이 유지된다", () => {
    expect(Array.from(base64ToFloat32(int16ToBase64(new Int16Array([0, 16384, -16384, -32768]))))).toEqual([0, 0.5, -0.5, -1]);
  });

  it("음량과 이어 붙이기", () => {
    expect(rootMeanSquare(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
    expect(Array.from(concatFloat32([new Float32Array([1]), new Float32Array([2, 3])], 3))).toEqual([1, 2, 3]);
  });
});

describe("Live 메시지", () => {
  it("보내는 메시지는 모델·이어받기·음성·사진·글 모양을 지킨다", () => {
    expect(buildSetupMessage({ model: "gemini-3.8-live", resumeHandle: null })).toEqual({ setup: { model: "models/gemini-3.8-live" } });
    expect(buildSetupMessage({ model: "m", resumeHandle: "h" }).setup).toMatchObject({ sessionResumption: { handle: "h" } });
    expect(buildAudioMessage("AA").realtimeInput.audio).toEqual({ data: "AA", mimeType: "audio/pcm;rate=16000" });
    expect(buildVideoMessage("BB").realtimeInput.video).toEqual({ data: "BB", mimeType: "image/jpeg" });
    expect(buildTextMessage("안녕", false).clientContent).toEqual({ turns: [{ role: "user", parts: [{ text: "안녕" }] }], turnComplete: false });
  });

  it("받은 메시지를 사건 목록으로 편다", () => {
    const events = readServerMessage({
      usageMetadata: { totalTokenCount: 3 },
      serverContent: {
        inputTranscription: { text: "저는" },
        outputTranscription: { text: "네" },
        modelTurn: { parts: [{ inlineData: { data: "AAAA" } }] },
        turnComplete: true,
      },
    });
    expect(events.map((event) => event.type)).toEqual(["usage", "inputText", "outputText", "audio", "turnComplete"]);
    expect(readServerMessage({ goAway: { timeLeft: "30s" } })).toEqual([{ type: "goAway", timeLeft: "30s" }]);
    expect(readServerMessage({ sessionResumptionUpdate: { newHandle: "h", resumable: true } })).toEqual([{ type: "resumption", newHandle: "h", resumable: true }]);
    expect(readServerMessage({ setupComplete: {} })).toEqual([{ type: "setupComplete" }]);
    expect(readServerMessage(null)).toEqual([]);
  });
});

describe("대화 글 모으기", () => {
  it("화자가 바뀌면 앞 발언을 확정하고, 턴 종료로 면접관 발언을 확정한다", () => {
    const assembler = createTranscriptAssembler();
    assembler.interviewer("지원 동기를 ", 1000);
    assembler.interviewer("말씀해 주세요.", 1200);
    assembler.turnComplete();
    assembler.candidate("저는 ", 4000);
    assembler.candidate("동아리에서", 4500);
    expect(assembler.draftText).toBe("저는 동아리에서");
    assembler.interviewer("네.", 9000);
    expect(assembler.turns.map((turn) => [turn.seq, turn.speaker, turn.text, turn.offsetMs])).toEqual([
      [0, "INTERVIEWER", "지원 동기를 말씀해 주세요.", 1000],
      [1, "CANDIDATE", "저는 동아리에서", 4000],
    ]);
    expect(assembler.candidateTurnCount()).toBe(1);
  });

  it("끊김은 면접관 발언에 표시되고, 연결이 끊기면 미완성으로 확정하며, 보낼 목록은 꺼낸 뒤 비워진다", () => {
    const assembler = createTranscriptAssembler();
    assembler.interviewer("긴 질문을", 0);
    assembler.interrupted();
    assembler.candidate("잠깐", 500);
    assembler.flushPartial();
    const pending = assembler.takePending();
    expect(pending.map((turn) => [turn.speaker, turn.interrupted, turn.partial])).toEqual([["INTERVIEWER", true, false], ["CANDIDATE", false, true]]);
    expect(assembler.takePending()).toEqual([]);
    assembler.requeue(pending);
    expect(assembler.takePending()).toHaveLength(2);
    assembler.flushPartial();
    expect(assembler.turns).toHaveLength(2);
  });
});

describe("사진 표본", () => {
  it("말할 때만 담고, 12장을 넘으면 가장 촘촘한 사진을 빼서 시간이 고르게 퍼진다", () => {
    const sampler = createPhotoSampler(4);
    sampler.offer("silent", 0, false);
    for (let second = 1; second <= 10; second += 1) sampler.offer(`p${second}`, second * 1000, true);
    expect(sampler.size).toBe(4);
    const kept = sampler.take();
    expect(kept[0]).toBe("p1");
    expect(kept[kept.length - 1]).toBe("p10");
    expect(kept).not.toContain("silent");
  });
});

describe("세션 응답 읽기", () => {
  it("서버 필드명을 화면 모양으로 바꾸고 모르는 값은 기본값으로 둔다", () => {
    const session = parseSession({
      id: "s1",
      analysis_id: "a1",
      mode: "SHORT",
      status: "ENDED",
      company: "한빛",
      job_role: null,
      first_token_at: "2026-11-04T10:00:00.000Z",
      token_issue_count: 2,
      created_at: "2026-11-04T09:59:00.000Z",
      feedback_status: "SUCCEEDED",
      feedback: { summary: "좋아요" },
      turns: [{ seq: 0, speaker: "INTERVIEWER", text: "안녕", offset_ms: 5 }],
    });
    expect(session).toMatchObject({ id: "s1", mode: "SHORT", status: "ENDED", company: "한빛", jobRole: null, tokenIssueCount: 2, feedbackStatus: "SUCCEEDED" });
    expect(session.feedback).toEqual({ summary: "좋아요" });
    expect(session.turns).toEqual([{ seq: 0, speaker: "INTERVIEWER", text: "안녕", interrupted: false, partial: false, offsetMs: 5 }]);
    expect(() => parseSession(null)).toThrow();
  });
});
