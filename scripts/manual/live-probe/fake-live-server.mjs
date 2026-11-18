// 비용 없이 페이지 동작을 확인하는 가짜 Gemini Live 서버. 실제 모델의 품질·지연은 전혀 대변하지 않는다.
// 메시지 모양은 공식 API 참조의 필드 이름을 따른다. 소리가 끝나면 짧은 음성으로 답하고, 일정 시간 뒤 끊기기 전 신호를 보낸다.
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const GO_AWAY_AFTER_MS = Number(process.env.FAKE_GO_AWAY_MS ?? 25_000);
const SPEECH_LEVEL = 300;
const SILENCE_MS = 800;

function encodeFrame(text) {
  const payload = Buffer.from(text);
  let header;
  if (payload.length < 126) header = Buffer.from([0x81, payload.length]);
  else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

/** 브라우저가 보낸 프레임(항상 마스킹됨)을 푼다. 남은 바이트는 다음 호출로 넘긴다. */
export function decodeFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (buffer.length - offset >= 2) {
    const opcode = buffer[offset] & 0x0f;
    let length = buffer[offset + 1] & 0x7f;
    let cursor = offset + 2;
    if (length === 126) {
      if (buffer.length - offset < 4) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (buffer.length - offset < 10) break;
      length = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }
    if (buffer.length - cursor < length + 4) break;
    const mask = buffer.subarray(cursor, cursor + 4);
    cursor += 4;
    const payload = Buffer.alloc(length);
    for (let index = 0; index < length; index += 1) payload[index] = buffer[cursor + index] ^ mask[index % 4];
    messages.push({ opcode, text: payload.toString("utf8") });
    offset = cursor + length;
  }
  return { messages, rest: buffer.subarray(offset) };
}

function toneBase64(ms) {
  const samples = Math.floor((24000 * ms) / 1000);
  const pcm = Buffer.alloc(samples * 2);
  for (let index = 0; index < samples; index += 1) {
    pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * index) / 24000) * 4000), index * 2);
  }
  return pcm.toString("base64");
}

function levelOf(base64) {
  const pcm = Buffer.from(base64, "base64");
  let sum = 0;
  const count = Math.floor(pcm.length / 2);
  for (let index = 0; index < count; index += 1) sum += Math.abs(pcm.readInt16LE(index * 2));
  return count ? sum / count : 0;
}

function serveConnection(socket) {
  let pending = Buffer.alloc(0);
  let lastSpeechAt = null;
  let speaking = false;
  let speakTimer = null;
  const send = (message) => {
    if (!socket.destroyed) socket.write(encodeFrame(JSON.stringify(message)));
  };
  const finishTurn = () => {
    speaking = false;
    send({ serverContent: { turnComplete: true }, usageMetadata: { promptTokenCount: 100, responseTokenCount: 50, promptTokensDetails: [{ modality: "AUDIO", tokenCount: 100 }], responseTokensDetails: [{ modality: "AUDIO", tokenCount: 50 }] } });
    send({ sessionResumptionUpdate: { newHandle: randomUUID(), resumable: true } });
  };
  const answer = () => {
    speaking = true;
    send({ serverContent: { outputTranscription: { text: "가짜 면접관의 질문입니다." }, modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: toneBase64(600) } }] } } });
    speakTimer = setTimeout(finishTurn, 600);
  };
  const silenceCheck = setInterval(() => {
    if (lastSpeechAt !== null && !speaking && Date.now() - lastSpeechAt > SILENCE_MS) {
      lastSpeechAt = null;
      send({ serverContent: { inputTranscription: { text: "가짜 받아쓰기입니다." } } });
      answer();
    }
  }, 100);
  const goAway = setTimeout(() => send({ goAway: { timeLeft: "5s" } }), GO_AWAY_AFTER_MS);
  const closeTimers = () => {
    clearInterval(silenceCheck);
    clearTimeout(goAway);
    clearTimeout(speakTimer);
  };
  socket.on("close", closeTimers);
  socket.on("error", closeTimers);
  socket.on("data", (chunk) => {
    const decoded = decodeFrames(Buffer.concat([pending, chunk]));
    pending = decoded.rest;
    for (const { opcode, text } of decoded.messages) {
      if (opcode === 8) {
        socket.end();
        return;
      }
      if (opcode !== 1) continue;
      const message = JSON.parse(text);
      if (message.setup) {
        send({ setupComplete: {} });
        send({ sessionResumptionUpdate: { newHandle: randomUUID(), resumable: true } });
      }
      if (message.clientContent?.turnComplete) answer();
      const audio = message.realtimeInput?.audio?.data;
      if (audio && levelOf(audio) > SPEECH_LEVEL) {
        if (speaking) {
          clearTimeout(speakTimer);
          speaking = false;
          send({ serverContent: { interrupted: true } });
        }
        lastSpeechAt = Date.now();
      }
    }
  });
}

export async function startFakeLiveServer() {
  const server = createServer();
  server.on("upgrade", (req, socket) => {
    const accept = createHash("sha1").update(`${req.headers["sec-websocket-key"]}${WS_MAGIC}`).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    serveConnection(socket);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `ws://127.0.0.1:${server.address().port}/`, close: () => server.close() };
}
