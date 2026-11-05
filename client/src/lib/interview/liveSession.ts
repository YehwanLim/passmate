// 면접 한 번의 실시간 연결을 맡는다: 마이크·카메라 → Gemini Live(WebSocket) → 스피커, 받아쓰기 → 대화 글 저장.
// 서버 입장권(토큰)으로만 붙고, 약 10분마다 오는 끊김 신호(goAway)에 재발급·이어받기로 다시 붙는다.
// 화면은 이 모듈이 내보내는 상태만 그린다. 오디오 본문은 어디에도 저장하지 않는다.

import type { RefObject } from "react";

import { INTERVIEW_KICKOFF_TEXT, INTERVIEW_WRAP_UP_TEXT } from "@shared/prompts/interviewPrompt.js";

import { getAuthorizationHeader } from "@/lib/apiAuth";

import { endInterviewSession, issueInterviewToken, saveInterviewTurns, type InterviewEndReason, type InterviewMode } from "./interviewApi";
import { buildAudioMessage, buildSetupMessage, buildTextMessage, buildVideoMessage, readServerMessage } from "./liveProtocol";
import { LIVE_INPUT_SAMPLE_RATE, LIVE_OUTPUT_SAMPLE_RATE, base64ToFloat32, concatFloat32, downsampleToInt16, int16ToBase64, rootMeanSquare } from "./pcm";
import { createPhotoSampler } from "./photoSampler";
import { createTranscriptAssembler, type TranscriptTurn } from "./transcriptAssembler";

export const INTERVIEW_TIMING = {
  FULL: { totalMs: 15 * 60_000, wrapUpAtMs: 13 * 60_000 },
  SHORT: { totalMs: 5 * 60_000, wrapUpAtMs: 4 * 60_000 },
} as const;

const CHUNK_MS = 100;
const RING_MS = 3000;
const SAVE_INTERVAL_MS = 15_000;
const MAX_RECONNECTS = 4;
/** 소켓은 열렸는데 setup 응답이 이만큼 안 오면 거절된 것으로 보고 끊는다(안 그러면 "다시 잇는 중"에 영원히 멈춘다). */
const SETUP_TIMEOUT_MS = 10_000;
const SPEAKING_THRESHOLD = 0.012;
const FRAME_WIDTH = 480;
/**
 * 사진 간격. 11-04 실측: AI 가 말할 차례마다 지금까지의 음성·사진 전체가 다시 청구돼, 보내는 양이 비용을 좌우한다.
 * 1초 1장이면 15분 약 $2.8, 10초 1장 + AI 말할 때 전송 멈춤이면 약 $0.4 로 추정. 시선·자세 표본은 10초 간격으로 충분하다.
 */
const FRAME_INTERVAL_MS = 10_000;

export type LivePhase = "connecting" | "live" | "reconnecting" | "ending" | "ended" | "failed";

export type LiveState = {
  phase: LivePhase;
  modelSpeaking: boolean;
  candidateSpeaking: boolean;
  micLevel: number;
  elapsedMs: number;
  reconnects: number;
  turns: readonly TranscriptTurn[];
  draftText: string;
  draftSpeaker: "CANDIDATE" | "INTERVIEWER" | null;
  error: string | null;
  endReason: InterviewEndReason | null;
  refunded: boolean | null;
};

export type LiveSessionOptions = {
  sessionId: string;
  mode: InterviewMode;
  micStream: MediaStream;
  /**
   * 카메라를 켰으면 이 ref 의 비디오 요소에서 10초에 1장씩(AI 가 말하는 동안은 빼고) 사진을 찍어 AI 에 보내고 피드백용 표본을 모은다.
   * 요소가 아니라 ref 를 받는다 — 통화 화면은 시작 직후에야 그려지므로 시작 시점에는 요소가 아직 없다(11-05 점검 B6).
   */
  videoRef: RefObject<HTMLVideoElement | null> | null;
  /** 탭이 닫히는 순간처럼 토큰을 새로 받을 수 없을 때 쓰는 마지막 인증 헤더. 평소 요청은 매번 새로 받는다. */
  authHeader: { Authorization: string };
  /** 테스트용. 기본은 Supabase 세션에서 새 헤더를 받는다. */
  readAuthHeader?: () => Promise<{ Authorization: string }>;
  onChange: (state: LiveState) => void;
};

export type LiveSessionHandle = {
  stop: (reason?: InterviewEndReason) => Promise<void>;
  photos: () => string[];
};

export async function startLiveSession(options: LiveSessionOptions): Promise<LiveSessionHandle> {
  const { sessionId, mode, micStream, videoRef, onChange, readAuthHeader = getAuthorizationHeader } = options;
  const timing = INTERVIEW_TIMING[mode];
  const transcript = createTranscriptAssembler();
  const photos = createPhotoSampler();
  const state: LiveState = {
    phase: "connecting",
    modelSpeaking: false,
    candidateSpeaking: false,
    micLevel: 0,
    elapsedMs: 0,
    reconnects: 0,
    turns: transcript.turns,
    draftText: "",
    draftSpeaker: null,
    error: null,
    endReason: null,
    refunded: null,
  };
  // 로그인 토큰은 면접 도중 만료될 수 있다(기본 1시간). 요청마다 새로 받고, 못 받을 때만 마지막 값을 쓴다.
  let authHeader = options.authHeader;
  const freshAuth = async () => {
    try {
      authHeader = await readAuthHeader();
    } catch {
      // 세션을 못 읽으면 마지막 헤더로 보낸다.
    }
    return authHeader;
  };
  let ws: WebSocket | null = null;
  let resumeHandle: string | null = null;
  let kickedOff = false;
  let reconnecting = false;
  let stopped = false;
  let wrapUpSent = false;
  let model = "";
  let lastSpeechAt = 0;
  let usage: Record<string, unknown> | null = null;
  const ring: string[] = [];
  const timers: ReturnType<typeof setInterval | typeof setTimeout>[] = [];
  const startedAt = performance.now();

  const emit = () => {
    state.elapsedMs = Math.round(performance.now() - startedAt);
    state.turns = transcript.turns;
    state.draftText = transcript.draftText;
    state.draftSpeaker = transcript.draftSpeaker;
    onChange({ ...state });
  };

  // ── 재생 ──
  const playContext = new AudioContext({ sampleRate: LIVE_OUTPUT_SAMPLE_RATE });
  await playContext.resume();
  let playCursor = 0;
  const sources = new Set<AudioBufferSourceNode>();
  const play = (data: string) => {
    const samples = base64ToFloat32(data);
    const buffer = playContext.createBuffer(1, samples.length, LIVE_OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const source = playContext.createBufferSource();
    source.buffer = buffer;
    source.connect(playContext.destination);
    const startAt = Math.max(playContext.currentTime + 0.02, playCursor);
    source.start(startAt);
    playCursor = startAt + buffer.duration;
    sources.add(source);
    source.onended = () => {
      sources.delete(source);
      if (sources.size === 0 && state.modelSpeaking) {
        state.modelSpeaking = false;
        emit();
      }
    };
  };
  const stopPlayback = () => {
    sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // 이미 끝난 소리는 무시한다.
      }
    });
    sources.clear();
    playCursor = 0;
    state.modelSpeaking = false;
  };

  // ── 보내기 ──
  const send = (message: unknown) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  };

  // ── 마이크 ──
  const micContext = new AudioContext();
  await micContext.audioWorklet.addModule("/interview/capture-worklet.js");
  const micSource = micContext.createMediaStreamSource(micStream);
  const capture = new AudioWorkletNode(micContext, "interview-capture");
  const inputRate = micContext.sampleRate;
  let pendingBlocks: Float32Array[] = [];
  let pendingSamples = 0;
  let lastLevelEmitAt = 0;
  capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
    const block = event.data;
    const level = rootMeanSquare(block);
    state.micLevel = level;
    const now = performance.now();
    if (level >= SPEAKING_THRESHOLD) lastSpeechAt = now;
    state.candidateSpeaking = now - lastSpeechAt < 600;
    // 화면의 내 목소리 막대와 "듣고 있어요" 표시가 따라오도록 0.1초마다 알린다(블록마다 알리면 너무 잦다).
    if (now - lastLevelEmitAt >= 100) {
      lastLevelEmitAt = now;
      emit();
    }
    pendingBlocks.push(block);
    pendingSamples += block.length;
    if (pendingSamples < (inputRate * CHUNK_MS) / 1000) return;
    const pcm = int16ToBase64(downsampleToInt16(concatFloat32(pendingBlocks, pendingSamples), inputRate, LIVE_INPUT_SAMPLE_RATE));
    pendingBlocks = [];
    pendingSamples = 0;
    // 면접관이 말하는 동안은 내 소리를 보내지 않는다(비용 절반, 대신 말을 끊고 들어가지 못한다 — 면접엔 자연스럽다).
    if (state.modelSpeaking) return;
    // 재연결 중인 목소리는 약 3초까지 담아 두었다가 다시 보낸다.
    if (reconnecting || !send(buildAudioMessage(pcm))) {
      ring.push(pcm);
      if (ring.length > RING_MS / CHUNK_MS) ring.shift();
    }
  };
  micSource.connect(capture);
  // 출력에 연결하지 않으면 일부 브라우저가 처리기를 멈춘다. 소리는 나지 않게 0 으로 줄인다.
  const mute = micContext.createGain();
  mute.gain.value = 0;
  capture.connect(mute);
  mute.connect(micContext.destination);
  await micContext.resume();

  // ── 카메라 사진 ──
  if (videoRef) {
    const canvas = document.createElement("canvas");
    timers.push(setInterval(() => {
      // 요소는 찍을 때마다 ref 에서 읽는다. 통화 화면이 그려진 뒤에야 들어온다.
      const videoElement = videoRef.current;
      // 면접관이 말하는 동안의 사진은 보내지도, 표본에 넣지도 않는다(지원자가 말하는 순간만 피드백에 쓴다).
      if (!videoElement || stopped || reconnecting || state.modelSpeaking || !videoElement.videoWidth) return;
      canvas.width = FRAME_WIDTH;
      canvas.height = Math.round((FRAME_WIDTH * videoElement.videoHeight) / videoElement.videoWidth);
      canvas.getContext("2d")?.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
      if (!data) return;
      send(buildVideoMessage(data));
      photos.offer(data, Math.round(performance.now() - startedAt), state.candidateSpeaking);
    }, FRAME_INTERVAL_MS));
  }

  // ── 대화 글 저장 ──
  let saving = false;
  const flushTurns = async (keepalive = false) => {
    const batch = transcript.takePending();
    if (batch.length === 0 || saving) {
      if (batch.length) transcript.requeue(batch);
      return;
    }
    saving = true;
    try {
      // 탭이 닫히는 순간에는 세션 읽기를 기다릴 수 없어 마지막 헤더를 그대로 쓴다.
      const auth = keepalive ? authHeader : await freshAuth();
      await saveInterviewTurns(sessionId, batch, { authHeader: auth, keepalive });
    } catch {
      transcript.requeue(batch);
    } finally {
      saving = false;
    }
  };
  timers.push(setInterval(() => void flushTurns(), SAVE_INTERVAL_MS));

  // ── 받은 메시지 ──
  const handleEvents = (raw: unknown) => {
    const at = Math.round(performance.now() - startedAt);
    for (const event of readServerMessage(raw)) {
      switch (event.type) {
        case "setupComplete":
          reconnecting = false;
          state.phase = "live";
          for (const pcm of ring.splice(0, ring.length)) send(buildAudioMessage(pcm));
          if (!kickedOff) {
            kickedOff = true;
            send(buildTextMessage(INTERVIEW_KICKOFF_TEXT, true));
          }
          break;
        case "audio":
          if (!state.modelSpeaking) state.modelSpeaking = true;
          play(event.data);
          break;
        case "inputText":
          transcript.candidate(event.text, at);
          break;
        case "outputText":
          transcript.interviewer(event.text, at);
          break;
        case "interrupted":
          stopPlayback();
          transcript.interrupted();
          break;
        case "turnComplete":
          transcript.turnComplete();
          void flushTurns();
          break;
        case "usage":
          usage = event.usage;
          break;
        case "resumption":
          if (event.resumable && event.newHandle) resumeHandle = event.newHandle;
          break;
        case "goAway":
          void reconnect("goAway");
          break;
        default:
          break;
      }
    }
    emit();
  };

  // ── 연결 ──
  // 소켓이 열리고 setup 응답(setupComplete)까지 받아야 연결된 것이다. 열렸지만 setup 이 거절돼 닫히면 reject 한다.
  const openSocket = async () => {
    const token = await issueInterviewToken(sessionId);
    model = token.model;
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(token.socketUrl);
      let opened = false;
      let settled = false;
      const settle = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(setupTimer);
        if (error) reject(error);
        else resolve();
      };
      const setupTimer = setTimeout(() => {
        if (settled) return;
        try {
          socket.close();
        } catch {
          // 이미 닫혔으면 무시한다.
        }
        settle(new Error("SETUP_TIMEOUT"));
      }, SETUP_TIMEOUT_MS);
      socket.onopen = () => {
        opened = true;
        ws = socket;
        socket.send(JSON.stringify(buildSetupMessage({ model, resumeHandle })));
      };
      const receive = (payload: unknown) => {
        if (!settled && readServerMessage(payload).some((event) => event.type === "setupComplete")) settle();
        handleEvents(payload);
      };
      socket.onmessage = (message) => {
        const text = typeof message.data === "string" ? message.data : null;
        if (text === null) {
          void (message.data as Blob).text().then((decoded) => receive(JSON.parse(decoded)));
          return;
        }
        receive(JSON.parse(text));
      };
      socket.onerror = () => {
        if (!opened) settle(new Error("SOCKET_OPEN_FAILED"));
      };
      socket.onclose = () => {
        if (!settled) {
          settle(new Error(opened ? "SETUP_REJECTED" : "SOCKET_CLOSED"));
          return;
        }
        if (ws === socket && !stopped && !reconnecting) void reconnect("closed");
      };
    });
  };

  const reconnect = async (reason: string) => {
    if (reconnecting || stopped) return;
    if (state.reconnects >= MAX_RECONNECTS || !resumeHandle) {
      await stop("reconnect-failed");
      return;
    }
    reconnecting = true;
    state.reconnects += 1;
    state.phase = "reconnecting";
    emit();
    transcript.flushPartial();
    stopPlayback();
    const previous = ws;
    try {
      previous?.close();
      await openSocket();
    } catch {
      reconnecting = false;
      await stop("reconnect-failed");
    }
  };

  // ── 종료 ──
  const stop = async (reason: InterviewEndReason = "user-stop", keepalive = false) => {
    if (stopped) return;
    stopped = true;
    state.phase = "ending";
    state.endReason = reason;
    emit();
    for (const timer of timers) clearInterval(timer as ReturnType<typeof setInterval>);
    stopPlayback();
    transcript.flushPartial();
    try {
      ws?.close();
    } catch {
      // 닫히는 중이면 무시한다.
    }
    micSource.disconnect();
    capture.disconnect();
    void micContext.close();
    void playContext.close();
    // 탭이 닫히는 순간에는 저장 응답을 기다릴 수 없다. 저장과 종료를 동시에 보내 종료가 빠지지 않게 한다.
    const flushing = flushTurns(keepalive);
    if (!keepalive) await flushing;
    try {
      const auth = keepalive ? authHeader : await freshAuth();
      const result = await endInterviewSession(sessionId, reason, usage, { authHeader: auth, keepalive });
      state.refunded = result.refunded;
      state.phase = "ended";
    } catch (error) {
      state.phase = "failed";
      state.error = error instanceof Error ? error.message : "END_FAILED";
    }
    await flushing;
    emit();
  };

  // 탭을 닫으면 저장할 수 있는 만큼 저장하고 종료를 알린다. keepalive 는 64KB 한도가 있어 마지막 15초 안쪽만 잃는다.
  const onPageHide = () => void stop("closed", true);
  window.addEventListener("pagehide", onPageHide);
  timers.push(setTimeout(() => {
    if (!wrapUpSent) {
      wrapUpSent = true;
      send(buildTextMessage(INTERVIEW_WRAP_UP_TEXT, false));
    }
  }, timing.wrapUpAtMs));
  timers.push(setTimeout(() => void stop("time-up"), timing.totalMs));
  timers.push(setInterval(emit, 1000));

  try {
    await openSocket();
  } catch {
    await stop("error");
  }
  emit();

  return {
    stop: async (reason = "user-stop") => {
      window.removeEventListener("pagehide", onPageHide);
      await stop(reason);
    },
    photos: () => photos.take(),
  };
}
