// 합성 음성·합성 그림으로 시험을 자동 실행한다. 페이지가 결과를 저장하면 판정을 출력하고 끝낸다.
// 예: node scripts/manual/live-probe/run-auto.mjs --fake --minutes 1
//     node scripts/manual/live-probe/run-auto.mjs --scenario full --minutes 15 --video 1   (비용 발생)
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { SPOKEN_ANSWERS } from "./fixture.js";
import { evaluateGate } from "./probe-core.js";

const ROOT = import.meta.dirname;
const RESULTS = path.join(ROOT, "results");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = process.env.LIVE_PROBE_PORT ?? "5199";
const RATE = 16000;
const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : fallback;
};
const fake = argv.includes("--fake");
const scenario = option("scenario", "full");
const minutes = Number(option("minutes", "15"));
const video = option("video", "1");
const voice = option("voice", "Yuna");

function speak(text, tempDir, index) {
  const aiff = path.join(tempDir, `${index}.aiff`);
  const wav = path.join(tempDir, `${index}.wav`);
  execFileSync("say", ["-v", voice, "-o", aiff, text]);
  execFileSync("afconvert", ["-f", "WAVE", "-d", `LEI16@${RATE}`, "-c", "1", aiff, wav]);
  const file = readFileSync(wav);
  const dataAt = file.indexOf("data") + 8;
  return file.subarray(dataAt);
}

function silence(seconds) {
  return Buffer.alloc(Math.floor(RATE * seconds) * 2);
}

function wavHeader(byteLength) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + byteLength, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(byteLength, 40);
  return header;
}

/** 답변 앞부분 → 3초 쉼 → 뒷부분 → AI가 말할 시간. 첫 답변에만 기억 시험 단어가 있어 전체를 이어 붙인다. */
function buildAnswerTrack() {
  const file = path.join(RESULTS, "spoken-answers.wav");
  if (existsSync(file)) return file;
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "live-probe-"));
  const parts = [silence(10)];
  const targetBytes = RATE * 2 * 17 * 60;
  let total = parts[0].length;
  let index = 0;
  while (total < targetBytes) {
    const [first, second] = SPOKEN_ANSWERS[Math.min(index, SPOKEN_ANSWERS.length - 1 - (index % 2))];
    for (const buffer of [speak(first, tempDir, `${index}a`), silence(3), speak(second, tempDir, `${index}b`), silence(25)]) {
      parts.push(buffer);
      total += buffer.length;
    }
    index += 1;
  }
  const body = Buffer.concat(parts);
  writeFileSync(file, Buffer.concat([wavHeader(body.length), body]));
  rmSync(tempDir, { recursive: true });
  return file;
}

function listResults() {
  return existsSync(RESULTS) ? readdirSync(RESULTS).filter((name) => name.endsWith(".json")) : [];
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const server = spawn(process.execPath, [path.join(ROOT, "server.mjs"), ...(fake ? ["--fake"] : [])], {
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...process.env, LIVE_PROBE_PORT: PORT },
});
await wait(500);

buildAnswerTrack();
const profile = mkdtempSync(path.join(os.tmpdir(), "live-probe-chrome-"));
const before = new Set(listResults());
const url = `http://127.0.0.1:${PORT}/?auto=1&fake=${fake ? 1 : 0}&scenario=${scenario}&minutes=${minutes}&video=${video}`;
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--mute-audio",
    url,
  ],
  { stdio: "ignore" },
);

let resultFile = null;
const deadline = Date.now() + (minutes + 2) * 60_000;
while (Date.now() < deadline && !resultFile) {
  await wait(2000);
  resultFile = listResults().find((name) => !before.has(name)) ?? null;
}
chrome.kill();
server.kill();
await wait(300);
rmSync(profile, { recursive: true, force: true });

if (!resultFile) {
  console.error("결과 파일이 만들어지지 않았습니다. 시작 실패일 수 있습니다.");
  process.exit(1);
}
const result = JSON.parse(readFileSync(path.join(RESULTS, resultFile), "utf8"));
const gate = evaluateGate(result);
console.log(
  JSON.stringify(
    {
      resultFile,
      endReason: result.endReason,
      tokenVariant: result.tokenVariant,
      socketVersionIndex: result.socketVersionIndex,
      heldMinutes: Number((result.heldMs / 60000).toFixed(2)),
      reconnects: result.reconnects,
      modelTurns: result.modelTurns,
      framesSent: result.framesSent,
      interrupted: result.interrupted,
      speech: { pauses: result.speech.pauses, cutIns: result.speech.cutIns, latencySamples: result.speech.latencies.length },
      usage: { last: result.usage.last, sum: result.usage.sum, samples: result.usage.samples },
      gate: gate.checks,
    },
    null,
    2,
  ),
);
