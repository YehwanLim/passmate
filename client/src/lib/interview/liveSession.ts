// 면접 한 번의 실시간 연결을 맡는다: 마이크·카메라 → Gemini Live(WebSocket) → 스피커, 받아쓰기 → 대화 글 저장.
// 서버 입장권(토큰)으로만 붙고, 약 10분마다 오는 끊김 신호(goAway)에 재발급·이어받기로 다시 붙는다.
// 화면은 이 모듈이 내보내는 상태만 그린다. 오디오 본문은 어디에도 저장하지 않는다.

import { INTERVIEW_KICKOFF_TEXT, INTERVIEW_WRAP_UP_TEXT } from "@shared/prompts/interviewPrompt.js";

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
const SPEAKING_THRESHOLD = 0.012;
const FRAME_WIDTH = 480;

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
  /** 카메라를 켰으면 이 비디오 요소에서 1초에 1장씩 사진을 찍어 AI 에 보내고 피드백용 표본을 모은다. */
  videoElement: HTMLVideoElement | null;
  authHeader: { Authorization: string };
  onChange: (state: LiveState) => void;
};

export type LiveSessionHandle = {
  stop: (reason?: InterviewEndReason) => Promise<void>;
  photos: () => string[];
};

export async function startLiveSession(options: LiveSessionOptions): Promise<LiveSessionHandle> {
  const { sessionId, mode, micStream, videoElement, onChange } = options;
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
  let authHeader = options.authHeader;
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
  capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
    const block = event.data;
    const level = rootMeanSquare(block);
    state.micLevel = level;
    const now = performance.now();
    if (level >= SPEAKING_THRESHOLD) lastSpeechAt = now;
    state.candidateSpeaking = now - lastSpeechAt < 600;
    pendingBlocks.push(block);
    pendingSamples += block.length;
    if (pendingSamples < (inputRate * CHUNK_MS) / 1000) return;
    const pcm = int16ToBase64(downsampleToInt16(concatFloat32(pendingBlocks, pendingSamples), inputRate, LIVE_INPUT_SAMPLE_RATE));
    pendingBlocks = [];
    pendingSamples = 0;
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
  if (videoElement) {
    const canvas = document.createElement("canvas");
    timers.push(setInterval(() => {
      if (stopped || reconnecting || !videoElement.videoWidth) return;
      canvas.width = FRAME_WIDTH;
      canvas.height = Math.round((FRAME_WIDTH * videoElement.videoHeight) / videoElement.videoWidth);
      canvas.getContext("2d")?.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
      if (!data) return;
      send(buildVideoMessage(data));
      photos.offer(data, Math.round(performance.now() - startedAt), state.candidateSpeaking);
    }, 1000));
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
      await saveInterviewTurns(sessionId, batch, { authHeader, keepalive });
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
  const openSocket = async () => {
    const token = await issueInterviewToken(sessionId);
    model = token.model;
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(token.socketUrl);
      let opened = false;
      socket.onopen = () => {
        opened = true;
        ws = socket;
        socket.send(JSON.stringify(buildSetupMessage({ model, resumeHandle })));
        resolve();
      };
      socket.onmessage = (message) => {
        const text = typeof message.data === "string" ? message.data : null;
        if (text === null) {
          void (message.data as Blob).text().then((decoded) => handleEvents(JSON.parse(decoded)));
          return;
        }
        handleEvents(JSON.parse(text));
      };
      socket.onerror = () => {
        if (!opened) reject(new Error("SOCKET_OPEN_FAILED"));
      };
      socket.onclose = () => {
        if (!opened) {
          reject(new Error("SOCKET_CLOSED"));
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
    await flushTurns(keepalive);
    try {
      const result = await endInterviewSession(sessionId, reason, usage, { authHeader, keepalive });
      state.refunded = result.refunded;
      state.phase = "ended";
    } catch (error) {
      state.phase = "failed";
      state.error = error instanceof Error ? error.message : "END_FAILED";
    }
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
