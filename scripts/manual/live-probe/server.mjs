// 시험 페이지와 임시 토큰 발급을 맡는 로컬 전용 서버. 앱·DB와 무관하다.
// 실행: node scripts/manual/live-probe/server.mjs [--fake]
// 키는 같은 폴더의 .env.probe 에 LIVE_PROBE_API_KEY=... 로 둔다(.gitignore 대상). 키·토큰은 출력하지 않는다.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { LOCK_TOKEN_INSTRUCTION, interviewerInstruction } from "./fixture.js";
import { startFakeLiveServer } from "./fake-live-server.mjs";
import { BUDGET_KRW, buildSessionConfig, buildTokenBody, canReserve, liveSocketUrls, spentKrw } from "./probe-core.js";

const ROOT = import.meta.dirname;
const RESULTS = path.join(ROOT, "results");
const LEDGER = path.join(RESULTS, "ledger.jsonl");
const PORT = Number(process.env.LIVE_PROBE_PORT ?? 5199);
const FAKE = process.argv.includes("--fake");
const STATIC = {
  "/": ["index.html", "text/html"],
  "/probe.js": ["probe.js", "text/javascript"],
  "/probe-core.js": ["probe-core.js", "text/javascript"],
  "/fixture.js": ["fixture.js", "text/javascript"],
  "/capture-worklet.js": ["capture-worklet.js", "text/javascript"],
};
const TOKEN_ENDPOINTS = ["v1beta", "v1alpha"].map((version) => `https://generativelanguage.googleapis.com/${version}/auth_tokens`);

mkdirSync(RESULTS, { recursive: true });

function readApiKey() {
  const file = path.join(ROOT, ".env.probe");
  if (!existsSync(file)) return null;
  const match = readFileSync(file, "utf8").match(/^LIVE_PROBE_API_KEY=(.+)$/m);
  return match ? match[1].trim() : null;
}

function readLedger() {
  if (!existsSync(LEDGER)) return [];
  const byId = new Map();
  for (const line of readFileSync(LEDGER, "utf8").split("\n").filter(Boolean)) {
    const entry = JSON.parse(line);
    byId.set(entry.id, { ...byId.get(entry.id), ...entry });
  }
  return [...byId.values()];
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}));
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

async function requestToken({ apiKey, scenario, minutes, silenceMs, triggerTokens, turnCoverage }) {
  const systemInstruction = scenario === "lock" ? LOCK_TOKEN_INSTRUCTION : interviewerInstruction();
  const config = buildSessionConfig({ systemInstruction, silenceMs, triggerTokens, turnCoverage });
  // 만료 시험은 면접(4분)보다 먼저 입장권이 끝나게 한다.
  const expireMinutes = scenario === "expire" ? 2 : minutes + 1;
  const failures = [];
  for (const endpoint of TOKEN_ENDPOINTS) {
    for (const variant of ["documented", "sdk"]) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(buildTokenBody({ now: Date.now(), expireMinutes, config, variant })),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.name) {
        return { token: payload.name, variant: `${endpoint.includes("v1alpha") ? "v1alpha" : "v1beta"}/${variant}` };
      }
      failures.push(`${endpoint.includes("v1alpha") ? "v1alpha" : "v1beta"}/${variant}: ${response.status} ${String(payload.error?.message ?? "").slice(0, 200)}`);
    }
  }
  throw new Error(`TOKEN_FAILED ${failures.join(" | ")}`);
}

async function handleToken(req, res, fakeUrl) {
  const body = await readBody(req);
  const sessionId = randomUUID();
  if (FAKE) {
    sendJson(res, 200, { urls: [fakeUrl], variant: "fake", sessionId });
    return;
  }
  const apiKey = readApiKey();
  if (!apiKey) {
    sendJson(res, 400, { error: "NO_API_KEY: .env.probe 에 LIVE_PROBE_API_KEY 를 넣어 주세요" });
    return;
  }
  const minutes = Number(body.minutes);
  // 비용 차단: 최악 단가로 쳐서 상한을 넘기면 토큰을 내주지 않는다.
  const entries = readLedger();
  if (!canReserve(entries, minutes + 1)) {
    sendJson(res, 402, { error: `BUDGET_EXCEEDED 누적 최악 추정 ${Math.round(spentKrw(entries))}원, 상한 ${BUDGET_KRW}원` });
    return;
  }
  try {
    const { token, variant } = await requestToken({ ...body, minutes, apiKey });
    appendFileSync(LEDGER, `${JSON.stringify({ id: sessionId, at: new Date().toISOString(), scenario: body.scenario, reservedMinutes: minutes + 1 })}\n`);
    sendJson(res, 200, { urls: liveSocketUrls(token), variant, sessionId });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleResults(req, res) {
  const body = await readBody(req);
  const file = path.join(RESULTS, `${new Date().toISOString().replace(/[:.]/g, "-")}-${body.settings?.scenario ?? "unknown"}.json`);
  writeFileSync(file, JSON.stringify(body, null, 2));
  if (!FAKE && body.sessionId) {
    appendFileSync(LEDGER, `${JSON.stringify({ id: body.sessionId, actualMinutes: Math.ceil((body.heldMs ?? 0) / 60_000) })}\n`);
  }
  sendJson(res, 200, { file: path.basename(file), spentKrw: FAKE ? 0 : spentKrw(readLedger()) });
}

export async function startProbeServer() {
  const fakeLive = FAKE ? await startFakeLiveServer() : null;
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://127.0.0.1").pathname;
    try {
      if (req.method === "POST" && pathname === "/token") return await handleToken(req, res, fakeLive?.url);
      if (req.method === "POST" && pathname === "/results") return await handleResults(req, res);
      if (req.method === "GET" && pathname === "/spoken-answers.wav") {
        res.writeHead(200, { "Content-Type": "audio/wav" });
        res.end(readFileSync(path.join(RESULTS, "spoken-answers.wav")));
        return;
      }
      const asset = req.method === "GET" ? STATIC[pathname] : null;
      if (!asset) return sendJson(res, 404, { error: "NOT_FOUND" });
      res.writeHead(200, { "Content-Type": asset[1], "Cache-Control": "no-store" });
      res.end(readFileSync(path.join(ROOT, asset[0])));
    } catch {
      sendJson(res, 500, { error: "SERVER_ERROR" });
    }
  });
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  console.log(`시험 페이지: http://127.0.0.1:${PORT}/ (${FAKE ? "가짜 서버, 비용 없음" : "실제 Gemini, 비용 발생"})`);
  return server;
}

await startProbeServer();
