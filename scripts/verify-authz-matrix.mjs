/**
 * 쓰기·삭제 A/B 권한 매트릭스 검증 (체크리스트 6번 / P0-GATE-02).
 *
 * 실제 배포된 서버(Preview)에 진짜 요청을 보내, B 가 A 의 데이터를
 * 보거나 지울 수 없는지 상태 코드로 확인한다.
 *
 * 준비물:
 *   - tmp-token-a.txt / tmp-token-b.txt : 테스트 계정 A·B 의 access token (gitignore 됨)
 *   - --base-url= : Preview 배포 주소
 *
 * 사용법:
 *   node scripts/verify-authz-matrix.mjs --base-url=https://xxx.vercel.app
 *
 * 흐름: 비로그인 401 확인 → A 로 가짜 지원서 분석(E2E 스모크 겸용) →
 *       A 본인 접근 확인 → B 의 침입 시도 전부 404 확인 → A 가 데이터 삭제 →
 *       A 계정 삭제 예약(202) 후 즉시 취소(200) 로 원상복구.
 */
import { readFileSync } from "node:fs";

const baseUrl = process.argv.find((a) => a.startsWith("--base-url="))?.split("=")[1];
if (!baseUrl) {
  console.error("사용법: node scripts/verify-authz-matrix.mjs --base-url=https://xxx.vercel.app");
  process.exit(1);
}

function readToken(path, label) {
  try {
    const token = readFileSync(path, "utf8").trim();
    if (token.length < 20) throw new Error("토큰이 너무 짧다");
    return token;
  } catch (error) {
    console.error(`${label} 토큰을 읽지 못했다 (${path}): ${error.message}`);
    console.error("사이트에 로그인한 뒤 안내받은 방법으로 토큰을 저장하라.");
    process.exit(1);
  }
}

const tokenA = readToken("tmp-token-a.txt", "A");
const tokenB = readToken("tmp-token-b.txt", "B");

async function call(method, path, { token, body, idempotencyKey } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await response.json(); } catch { /* 204 등 본문 없음 */ }
  return { status: response.status, json };
}

const results = [];
function record(name, expected, actual, extraOk = true) {
  const pass = actual === expected && extraOk;
  results.push({ name, expected, actual, pass });
  console.log(`  ${pass ? "통과" : "실패"}  ${name}  (기대 ${expected} / 실제 ${actual})`);
  return pass;
}

/** B 의 404 응답에 A 의 데이터가 섞여 있지 않은지 — error/requestId 외 키가 없어야 한다 */
function bodyIsOpaque(json) {
  if (json === null) return true;
  return Object.keys(json).every((key) => ["error", "requestId", "message"].includes(key));
}

const FAKE_ID = "00000000-0000-4000-8000-000000000000";

console.log(`=== A/B 권한 매트릭스 — 대상: ${baseUrl} ===\n`);

// ── 0. 토큰 확인: A 와 B 가 서로 다른 계정인지 ──
const meA = await call("GET", "/api/auth/me", { token: tokenA });
const meB = await call("GET", "/api/auth/me", { token: tokenB });
if (meA.status !== 200 || meB.status !== 200) {
  console.error(`토큰 확인 실패 (A: ${meA.status}, B: ${meB.status}). 토큰이 만료됐을 수 있다 — 다시 로그인해서 저장하라.`);
  process.exit(1);
}
if (meA.json.id === meB.json.id) {
  console.error("A 와 B 가 같은 계정이다. 서로 다른 계정의 토큰을 저장하라.");
  process.exit(1);
}
console.log(`계정 확인: A(...${meA.json.id.slice(-6)}) ≠ B(...${meB.json.id.slice(-6)})\n`);

// ── 1. 비로그인 401 ──
console.log("[1] 비로그인 요청은 전부 401 이어야 한다");
record("DELETE /api/projects/:id (비로그인)", 401, (await call("DELETE", `/api/projects/${FAKE_ID}`)).status);
record("GET /api/analysis/:id (비로그인)", 401, (await call("GET", `/api/analysis/${FAKE_ID}`)).status);
record("POST /api/feedback (비로그인)", 401, (await call("POST", "/api/feedback", { body: { analysisId: FAKE_ID, rating: "THUMBS_UP" } })).status);
record("GET /api/projects/:id/analyses (비로그인)", 401, (await call("GET", `/api/projects/${FAKE_ID}/analyses`)).status);
record("POST /api/account/deletion (비로그인)", 401, (await call("POST", "/api/account/deletion")).status);

// ── 2. A 의 크레딧 확인 후 가짜 지원서 분석 (E2E 스모크) ──
console.log("\n[2] A 가 가짜 지원서를 분석한다 (202 접수 → 폴링 → 완료)");
const entitlements = await call("GET", "/api/entitlements", { token: tokenA });
if ((entitlements.json?.remaining ?? 0) < 1) {
  console.error(`A 계정의 크레딧이 없다 (remaining: ${entitlements.json?.remaining}). 크레딧이 남은 계정의 토큰을 A 로 쓰라.`);
  process.exit(1);
}

const accepted = await call("POST", "/api/analyze", {
  token: tokenA,
  idempotencyKey: `authz-matrix-${Date.now()}-aaaa`,
  body: {
    company: "권한검증 주식회사",
    jobKeyword: "테스트 엔지니어",
    questions: [{
      question: "지원 동기를 서술해 주세요.",
      answer: "권한 매트릭스 검증용 가짜 지원서다. ".repeat(12),
    }],
  },
});
record("POST /api/analyze (A, 접수)", 202, accepted.status);
if (accepted.status !== 202) {
  console.error("접수 실패:", JSON.stringify(accepted.json));
  process.exit(1);
}
const { analysis_request_id: requestId, project_id: projectId } = accepted.json;

let analysisId = null;
for (let i = 0; i < 40; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const poll = await call("GET", `/api/analysis-requests/${requestId}`, { token: tokenA });
  if (poll.json?.status === "SUCCEEDED") { analysisId = poll.json.analysis_id; break; }
  if (poll.json?.status === "FAILED") { console.error("분석 실패:", poll.json.error); process.exit(1); }
  process.stdout.write(".");
}
console.log("");
if (!analysisId) { console.error("분석이 120초 안에 끝나지 않았다."); process.exit(1); }
console.log(`  분석 완료 (E2E 스모크 통과) — analysis ...${analysisId.slice(-6)}`);

// ── 3. A 본인 접근 ──
console.log("\n[3] A 는 자기 데이터에 접근할 수 있어야 한다");
record("GET /api/analysis/:id (A 본인)", 200, (await call("GET", `/api/analysis/${analysisId}`, { token: tokenA })).status);
record("GET /api/projects/:id/analyses (A 본인)", 200, (await call("GET", `/api/projects/${projectId}/analyses`, { token: tokenA })).status);
record("POST /api/feedback (A 본인)", 200, (await call("POST", "/api/feedback", { token: tokenA, body: { analysisId, rating: "THUMBS_UP" } })).status);

// ── 4. B 의 침입 시도 — 전부 404, 본문에 A 데이터 없음 ──
console.log("\n[4] B 가 A 의 데이터를 노리면 전부 404 이어야 한다 (존재 자체를 숨김)");
const bAnalysis = await call("GET", `/api/analysis/${analysisId}`, { token: tokenB });
record("GET /api/analysis/:id (B가 A 대상)", 404, bAnalysis.status, bodyIsOpaque(bAnalysis.json));
const bList = await call("GET", `/api/projects/${projectId}/analyses`, { token: tokenB });
record("GET /api/projects/:id/analyses (B가 A 대상)", 404, bList.status, bodyIsOpaque(bList.json));
const bFeedback = await call("POST", "/api/feedback", { token: tokenB, body: { analysisId, rating: "THUMBS_DOWN" } });
record("POST /api/feedback (B가 A 대상)", 404, bFeedback.status, bodyIsOpaque(bFeedback.json));
const bDelete = await call("DELETE", `/api/projects/${projectId}`, { token: tokenB });
record("DELETE /api/projects/:id (B가 A 대상)", 404, bDelete.status, bodyIsOpaque(bDelete.json));

// B 가 지우려 한 뒤에도 A 의 데이터가 살아 있는지
record("B 의 삭제 시도 후에도 A 데이터가 살아 있다", 200, (await call("GET", `/api/analysis/${analysisId}`, { token: tokenA })).status);

// ── 5. A 가 자기 데이터를 지운다 (시험 데이터 정리 겸용) ──
console.log("\n[5] A 는 자기 지원서를 지울 수 있어야 한다");
record("DELETE /api/projects/:id (A 본인)", 204, (await call("DELETE", `/api/projects/${projectId}`, { token: tokenA })).status);
record("삭제 후 조회는 404", 404, (await call("GET", `/api/analysis/${analysisId}`, { token: tokenA })).status);

// ── 6. 계정 삭제 예약(202) → 즉시 취소(200) 로 원상복구 ──
console.log("\n[6] A 의 계정 삭제 예약과 취소");
record("POST /api/account/deletion (A)", 202, (await call("POST", "/api/account/deletion", { token: tokenA })).status);
record("POST /api/account/deletion/cancel (A, 원상복구)", 200, (await call("POST", "/api/account/deletion/cancel", { token: tokenA })).status);
record("취소 후 A 계정이 정상 동작한다", 200, (await call("GET", "/api/auth/me", { token: tokenA })).status);

// ── 결과 ──
const failed = results.filter((r) => !r.pass);
console.log(`\n=== 결과: ${results.length - failed.length}/${results.length} 통과 ===`);
if (failed.length > 0) {
  console.log("실패 항목:");
  for (const f of failed) console.log(`  - ${f.name}: 기대 ${f.expected}, 실제 ${f.actual}`);
  process.exit(1);
}
console.log("모든 셀이 기대 상태 코드와 일치하고, 404 응답 본문에 타인 데이터가 없다.");
