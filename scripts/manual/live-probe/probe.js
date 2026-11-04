// 시험 페이지 동작. 토큰·음성 본문은 화면·콘솔·결과 파일에 남기지 않는다.
import {
  LOCK_CLIENT_INSTRUCTION,
  KICKOFF_TEXT,
  MEMORY_QUESTION,
  FIXTURE,
} from "./fixture.js";
import {
  OUTPUT_SAMPLE_RATE,
  base64ToFloat32,
  buildSetupMessage,
  createSpeechTracker,
  downsampleTo16k,
  int16ToBase64,
  percentile,
  readServerMessage,
  redactAudio,
  rootMeanSquare,
  summarizeUsage,
} from "./probe-core.js";

const CHUNK_MS = 100;
const RING_MS = 3000;
const MAX_RECONNECTS = 6;
const MAX_SAMPLES = 400;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const state = {
  running: false,
  ws: null,
  urls: [],
  urlIndex: 0,
  token: null,
  handle: null,
  startedAt: 0,
  heldUntil: 0,
  micStream: null,
  micContext: null,
  playContext: null,
  playCursor: 0,
  sources: new Set(),
  pending: [],
  pendingSamples: 0,
  ring: [],
  tracker: createSpeechTracker(),
  modelSpeaking: false,
  kickedOff: false,
  frameTimer: null,
  video: null,
  canvas: null,
  reconnectCount: 0,
  reconnecting: false,
  usageSamples: [],
  result: null,
};

function log(line) {
  const seconds = state.startedAt ? ((performance.now() - state.startedAt) / 1000).toFixed(1) : "0.0";
  $("log").textContent = `[${seconds}s] ${line}\n${$("log").textContent}`.slice(0, 6000);
}

function note(event) {
  state.result.events.push({ at: Math.round(performance.now() - state.startedAt), ...event });
}

function readSettings() {
  const pick = (key, element) => (params.has(key) ? params.get(key) : element);
  return {
    scenario: pick("scenario", $("scenario").value),
    minutes: Number(pick("minutes", $("minutes").value)),
    video: pick("video", $("video").checked ? "1" : "0") === "1",
    silenceMs: Number(pick("silenceMs", $("silenceMs").value)),
    triggerTokens: Number(pick("triggerTokens", $("triggerTokens").value)),
    turnCoverage: pick("turnCoverage", $("turnCoverage").value) || null,
    auto: params.get("auto") === "1",
    fake: params.get("fake") === "1",
  };
}

async function postJson(path, body) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
  return payload;
}

function send(message) {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}

function sendAudio(samples) {
  return send({ realtimeInput: { audio: { data: int16ToBase64(samples), mimeType: "audio/pcm;rate=16000" } } });
}

function onMicBlock(block, inputRate) {
  state.tracker.onMicLevel(rootMeanSquare(block), performance.now());
  state.pending.push(block);
  state.pendingSamples += block.length;
  if (state.pendingSamples < (inputRate * CHUNK_MS) / 1000) return;
  const merged = new Float32Array(state.pendingSamples);
  let offset = 0;
  for (const part of state.pending) {
    merged.set(part, offset);
    offset += part.length;
  }
  state.pending = [];
  state.pendingSamples = 0;
  const pcm = downsampleTo16k(merged, inputRate);
  // 재연결 중인 목소리는 약 3초까지 담아 두었다가 다시 보낸다.
  if (state.reconnecting || !sendAudio(pcm)) {
    state.ring.push(pcm);
    if (state.ring.length > RING_MS / CHUNK_MS) state.ring.shift();
    state.result.bufferedChunks += 1;
  }
}

function flushRing() {
  for (const pcm of state.ring) sendAudio(pcm);
  state.ring = [];
}

function playChunk(data) {
  const samples = base64ToFloat32(data);
  const context = state.playContext;
  const buffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
  buffer.copyToChannel(samples, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  const startAt = Math.max(context.currentTime + 0.02, state.playCursor);
  source.start(startAt);
  state.playCursor = startAt + buffer.duration;
  state.sources.add(source);
  source.onended = () => state.sources.delete(source);
}

function stopPlayback() {
  for (const source of state.sources) {
    try {
      source.stop();
    } catch {
      // 이미 끝난 음성은 무시한다.
    }
  }
  state.sources.clear();
  state.playCursor = 0;
  state.modelSpeaking = false;
}

function handleEvent(event) {
  switch (event.type) {
    case "setupComplete":
      log("연결 준비 완료");
      note({ type: "setupComplete" });
      state.reconnecting = false;
      flushRing();
      if (!state.kickedOff) {
        state.kickedOff = true;
        send({ clientContent: { turns: [{ role: "user", parts: [{ text: KICKOFF_TEXT }] }], turnComplete: true } });
      }
      break;
    case "audio":
      if (!state.modelSpeaking) {
        state.modelSpeaking = true;
        state.result.modelTurns += 1;
        // 첫 인사는 말이 끝난 뒤의 지연이 아니므로 재지 않는다.
        if (state.result.modelTurns > 1) state.tracker.onModelTurnStart(performance.now());
      }
      state.result.audioChunks += 1;
      playChunk(event.data);
      break;
    case "interrupted":
      state.result.interrupted += 1;
      note({ type: "interrupted" });
      stopPlayback();
      break;
    case "turnComplete":
      state.modelSpeaking = false;
      state.result.transcript.push({ speaker: "turn", text: "" });
      break;
    case "inputText":
      state.result.transcript.push({ speaker: "candidate", text: event.text });
      break;
    case "outputText":
      state.result.transcript.push({ speaker: "interviewer", text: event.text });
      break;
    case "usage":
      state.usageSamples.push(event.usage);
      break;
    case "resumption":
      if (event.resumable && event.newHandle) state.handle = event.newHandle;
      state.result.resumptionUpdates += 1;
      break;
    case "goAway":
      log(`끊기기 전 신호: ${event.timeLeft}`);
      note({ type: "goAway", timeLeft: event.timeLeft });
      void reconnect("goAway");
      break;
    default:
      break;
  }
}

function setupMessage(settings) {
  // 토큰에 잠근 설정이 정본이다. 브라우저는 모델과 이어받기 값만 보낸다.
  // 지시 잠금 시험만 일부러 다른 지시를 보내 어느 쪽이 적용되는지 본다.
  const config = settings.scenario === "lock" ? { systemInstruction: { parts: [{ text: LOCK_CLIENT_INSTRUCTION }] } } : {};
  return buildSetupMessage({ config, resumeHandle: state.handle });
}

function openSocket(settings) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(state.urls[state.urlIndex]);
    ws.binaryType = "arraybuffer";
    let opened = false;
    let lastSample = performance.now();
    ws.onopen = () => {
      opened = true;
      state.ws = ws;
      send(setupMessage(settings));
      resolve();
    };
    ws.onmessage = (message) => {
      const text = typeof message.data === "string" ? message.data : new TextDecoder().decode(message.data);
      const parsed = JSON.parse(text);
      if (state.result.messageSamples.length < MAX_SAMPLES) {
        state.result.messageSamples.push({ at: Math.round(performance.now() - state.startedAt), message: redactAudio(parsed) });
      }
      lastSample = performance.now();
      for (const event of readServerMessage(parsed)) handleEvent(event);
    };
    ws.onerror = () => {
      if (!opened) reject(new Error("SOCKET_OPEN_FAILED"));
    };
    ws.onclose = (close) => {
      note({ type: "close", code: close.code, reason: close.reason.slice(0, 200), sinceLastMessageMs: Math.round(performance.now() - lastSample) });
      log(`연결 종료 ${close.code} ${close.reason.slice(0, 120)}`);
      if (!opened) {
        reject(new Error(`SOCKET_CLOSED_${close.code}`));
        return;
      }
      if (state.ws === ws && state.running && !state.reconnecting) void reconnect("unexpected-close");
    };
  });
}

async function reconnect(reason) {
  if (state.reconnecting || !state.running) return;
  if (state.reconnectCount >= MAX_RECONNECTS || !state.handle) {
    note({ type: "reconnectGivenUp", reason, hasHandle: Boolean(state.handle) });
    log(`재연결 불가: ${reason}`);
    await finish(`reconnect-failed:${reason}`);
    return;
  }
  state.reconnecting = true;
  state.reconnectCount += 1;
  const startedAt = performance.now();
  const previous = state.ws;
  stopPlayback();
  try {
    previous?.close();
    await openSocket(readSettings());
    note({ type: "reconnected", reason, gapMs: Math.round(performance.now() - startedAt) });
    log(`재연결 ${state.reconnectCount}회 (${reason})`);
  } catch (error) {
    state.reconnecting = false;
    note({ type: "reconnectFailed", reason, error: error.message });
    await finish(`reconnect-failed:${reason}`);
  }
}

async function connectFirstAvailable(settings) {
  for (state.urlIndex = 0; state.urlIndex < state.urls.length; state.urlIndex += 1) {
    try {
      await openSocket(settings);
      state.result.socketVersionIndex = state.urlIndex;
      return;
    } catch (error) {
      note({ type: "socketAttemptFailed", index: state.urlIndex, error: error.message });
    }
  }
  throw new Error("ALL_SOCKETS_FAILED");
}

function startFrames(settings) {
  state.video = $("self");
  state.canvas = document.createElement("canvas");
  state.frameTimer = setInterval(() => {
    const { video, canvas } = state;
    if (state.reconnecting) return;
    if (settings.auto) {
      // 자동 시험은 얼굴 없는 합성 그림을 보낸다. 사진 크기는 실제와 비슷하게 맞춘다.
      canvas.width = 480;
      canvas.height = 270;
      const context = canvas.getContext("2d");
      context.fillStyle = `hsl(${Math.round(performance.now() / 100) % 360} 40% 60%)`;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#222";
      context.font = "28px sans-serif";
      context.fillText(`시험 화면 ${Math.round(performance.now() / 1000)}초`, 40, 140);
    } else {
      if (!video.videoWidth) return;
      canvas.width = 480;
      canvas.height = Math.round((480 * video.videoHeight) / video.videoWidth);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    const data = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
    if (send({ realtimeInput: { video: { data, mimeType: "image/jpeg" } } })) state.result.framesSent += 1;
  }, 1000);
}

/**
 * 자동 시험은 실제 마이크 대신 합성 음성 파일(16kHz 16비트)을 실제 시간에 맞춰 흘려보낸다.
 * 크롬 가짜 마이크가 이 환경에서 시작되지 않아서다. 실제 마이크 경로는 직접 말하는 시험이 맡는다.
 */
async function startSyntheticMic() {
  const response = await fetch("/spoken-answers.wav");
  const pcm = new Int16Array((await response.arrayBuffer()).slice(44));
  const blockSize = 1600;
  let cursor = 0;
  const startedAt = performance.now();
  state.syntheticTimer = setInterval(() => {
    const target = Math.floor(((performance.now() - startedAt) / 1000) * 16000);
    while (cursor + blockSize <= target && cursor + blockSize <= pcm.length) {
      const block = new Float32Array(blockSize);
      for (let index = 0; index < blockSize; index += 1) block[index] = pcm[cursor + index] / 32768;
      cursor += blockSize;
      onMicBlock(block, 16000);
    }
  }, 50);
  state.playContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
  await state.playContext.resume();
}

async function startMic(settings) {
  if (settings.auto) {
    await startSyntheticMic();
    return;
  }
  const constraints = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: settings.video ? { width: 640, height: 360 } : false,
  };
  state.micStream = await navigator.mediaDevices.getUserMedia(constraints);
  if (settings.video) $("self").srcObject = state.micStream;
  state.micContext = new AudioContext();
  await state.micContext.audioWorklet.addModule("./capture-worklet.js");
  const source = state.micContext.createMediaStreamSource(state.micStream);
  const node = new AudioWorkletNode(state.micContext, "capture-processor");
  const inputRate = state.micContext.sampleRate;
  node.port.onmessage = (event) => onMicBlock(event.data, inputRate);
  source.connect(node);
  node.connect(state.micContext.destination);
  await state.micContext.resume();
  state.playContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
  await state.playContext.resume();
}

function renderStatus() {
  if (!state.running) return;
  const speech = state.tracker.snapshot();
  const elapsed = (performance.now() - state.startedAt) / 60000;
  $("status").textContent = [
    `경과 ${elapsed.toFixed(1)}분 / 재연결 ${state.reconnectCount}회 / AI 발화 ${state.result.modelTurns}회`,
    `지연 중간값 ${percentile(speech.latencies, 0.5) ?? "-"}ms / 느린 경우 ${percentile(speech.latencies, 0.9) ?? "-"}ms`,
    `쉼 ${speech.pauses}회 중 끼어듦 ${speech.cutIns}회 / 서버가 끊음 ${state.result.interrupted}회`,
    `전송한 사진 ${state.result.framesSent}장 / 토큰 표본 ${state.usageSamples.length}개`,
  ].join("\n");
}

async function finish(reason) {
  if (!state.running) return;
  state.running = false;
  const heldMs = Math.round(performance.now() - state.startedAt);
  clearInterval(state.frameTimer);
  clearInterval(state.syntheticTimer);
  stopPlayback();
  state.ws?.close();
  state.micStream?.getTracks().forEach((track) => track.stop());
  await state.micContext?.close();
  await state.playContext?.close();
  Object.assign(state.result, {
    endReason: reason,
    heldMs,
    reconnects: state.reconnectCount,
    speech: state.tracker.snapshot(),
    usage: summarizeUsage(state.usageSamples),
    usageLastSamples: state.usageSamples.slice(-3),
  });
  const saved = await postJson("/results", state.result);
  $("status").textContent = `끝남: ${reason}\n결과 파일: ${saved.file}\n이번 세션 기록 뒤 누적 최악 추정: 약 ${Math.round(saved.spentKrw)}원`;
  document.title = `done:${saved.file}`;
  $("start").disabled = false;
  $("stop").disabled = true;
}

function scheduleScenario(settings) {
  const end = setTimeout(() => void finish("time-up"), settings.minutes * 60_000);
  const timers = [end];
  if (settings.scenario === "full") {
    // 12분쯤 기억 시험. 모델이 말하는 중이면 끊기지만 턴 완료로 답을 바로 받는다.
    timers.push(setTimeout(() => askMemory(), Math.min(12, settings.minutes * 0.8) * 60_000));
  }
  return timers;
}

function askMemory() {
  note({ type: "memoryQuestion", keywords: [FIXTURE.firstAnswerKeyword, FIXTURE.company] });
  state.result.memoryAskedAtIndex = state.result.transcript.length;
  send({ clientContent: { turns: [{ role: "user", parts: [{ text: MEMORY_QUESTION }] }], turnComplete: true } });
  log("기억 질문을 보냄");
}

async function start() {
  const settings = readSettings();
  $("start").disabled = true;
  state.result = {
    settings,
    startedAtIso: new Date().toISOString(),
    events: [],
    transcript: [],
    marks: [],
    messageSamples: [],
    modelTurns: 0,
    audioChunks: 0,
    interrupted: 0,
    framesSent: 0,
    bufferedChunks: 0,
    resumptionUpdates: 0,
    socketVersionIndex: null,
    tokenVariant: null,
    sessionId: null,
  };
  try {
    const token = await postJson("/token", {
      scenario: settings.scenario,
      minutes: settings.minutes,
      silenceMs: settings.silenceMs,
      triggerTokens: settings.triggerTokens,
      turnCoverage: settings.turnCoverage,
    });
    state.urls = token.urls;
    state.result.tokenVariant = token.variant;
    state.result.sessionId = token.sessionId;
    log(`입장권 받음 (${token.variant})`);
    await startMic(settings);
    log("마이크·카메라 준비됨");
    state.startedAt = performance.now();
    state.running = true;
    await connectFirstAvailable(settings);
    if (settings.video) startFrames(settings);
    scheduleScenario(settings);
    setInterval(renderStatus, 1000);
    $("stop").disabled = false;
    $("forceReconnect").disabled = false;
    $("memoryNow").disabled = false;
    log("시험 시작");
  } catch (error) {
    $("status").textContent = `시작 실패: ${error.message}`;
    document.title = `failed:${error.message}`;
    state.running = false;
    state.micStream?.getTracks().forEach((track) => track.stop());
    if (state.result.sessionId) {
      Object.assign(state.result, { endReason: `start-failed:${error.message}`, heldMs: 0, speech: state.tracker.snapshot(), usage: summarizeUsage([]) });
      await postJson("/results", state.result).catch(() => {});
    }
    $("start").disabled = false;
  }
}

$("start").addEventListener("click", () => void start());
$("stop").addEventListener("click", () => void finish("user-stop"));
$("forceReconnect").addEventListener("click", () => void reconnect("manual"));
$("memoryNow").addEventListener("click", askMemory);
for (const button of document.querySelectorAll(".mark")) {
  button.addEventListener("click", () => {
    const mark = button.dataset.mark;
    state.result?.marks.push({ at: Math.round(performance.now() - state.startedAt), mark });
    log(`표시: ${mark}`);
  });
}
if (params.get("auto") === "1") void start();
