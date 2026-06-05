// No SDK imports needed; using raw fetch
import dotenv from "dotenv";
import { MASTER_SYSTEM_PROMPT } from "../prompts/reportPrompt";
import { getGeminiUrl } from "../config/gemini";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Input interfaces
interface QuestionInput {
  question: string;
  answer: string;
}

interface AnalyzeRequest {
  questions: QuestionInput[];
  company?: string;
  jobKeyword?: string;
  content?: string;
}

// =============================================================================
// Gemini API 호출 (재시도 로직 포함)
// =============================================================================

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000; // 첫 재시도 3초, 이후 지수 백오프

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gemini API에 단일 요청을 보낸다.
 * 성공 시 parsed JSON, 실패 시 throw.
 */
async function callGeminiOnce(userPrompt: string): Promise<any> {
  const url = getGeminiUrl(GEMINI_API_KEY!);

  const apiRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: MASTER_SYSTEM_PROMPT + "\n\n" + userPrompt }] }
      ]
    })
  });

  if (!apiRes.ok) {
    const errorText = await apiRes.text();
    let parsedError: any = null;
    try { parsedError = JSON.parse(errorText); } catch(e) {}
    
    const isBillingIssue = parsedError?.error?.message?.includes('credits are depleted') || parsedError?.error?.message?.includes('billing');

    const err = new Error(`Google API Error ${apiRes.status}: ${errorText}`) as any;
    err.statusCode = apiRes.status;
    err.isBillingIssue = isBillingIssue;
    throw err;
  }

  const data = await apiRes.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!rawText) {
    throw new Error("Gemini 응답이 비어 있습니다.");
  }

  const parsed = safeParseJson(rawText);
  if (!parsed) {
    throw new Error("Gemini 응답 JSON 파싱 실패");
  }

  return parsed;
}

/**
 * 재시도 가능한 HTTP 상태 코드인지 판별
 * 503 (과부하), 429 (Rate Limit), 500 (서버 내부) 에 대해 재시도
 */
function isRetryable(error: any): boolean {
  if (error?.isBillingIssue) return false;
  const code = error?.statusCode;
  return code === 503 || code === 429 || code === 500;
}

// Gemini API call (메인 진입점)
export async function analyzeCoverLetter(input: AnalyzeRequest | string) {
  let request: AnalyzeRequest;
  if (typeof input === "string") {
    request = {
      questions: [{ question: "문항 1", answer: input }],
    };
  } else {
    request = input;
  }

  if (!GEMINI_API_KEY) {
    console.error("[analyze] ❌ GEMINI_API_KEY not set");
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. 서버 환경변수를 확인해주세요.");
  }

  const userPrompt = buildUserPrompt(request);

  // 재시도 루프 (최대 MAX_RETRIES회)
  let lastError: any = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[analyze] ⏳ 재시도 ${attempt}/${MAX_RETRIES} (${delay}ms 후)...`);
        await sleep(delay);
      }

      const parsed = await callGeminiOnce(userPrompt);

      // questionTabs에 원본 질문/답변 주입 (서버 소스 오브 트루스)
      if (parsed.questionTabs) {
        parsed.questionTabs.forEach((tab: any, idx: number) => {
          if (request.questions[idx]) {
            tab.fullAnswer = request.questions[idx].answer;
            tab.prompt = request.questions[idx].question || `문항 ${idx + 1}`;
          }
        });
      }

      console.log(`[analyze] ✅ Gemini 응답 파싱 성공 (시도 ${attempt + 1})`);
      return parsed;
    } catch (error: any) {
      lastError = error;
      console.error(`[analyze] 시도 ${attempt + 1} 실패:`, error.message);

      // 재시도 불가능한 에러면 즉시 중단
      if (!isRetryable(error)) {
        break;
      }
    }
  }

  // 모든 재시도 소진 → 에러를 throw하여 프론트에서 인지하도록 함
  console.error("[analyze] ❌ 모든 재시도 실패:", lastError?.message);
  throw lastError || new Error("AI 분석 서비스에 연결할 수 없습니다.");
}

// =============================================================================
// JSON 안전 파싱 유틸리티
// =============================================================================

function safeParseJson(rawText: string): any | null {
  // Step 1: 마크다운 코드블록 제거
  let text = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  // Step 2: 첫 번째 시도 — 그대로 파싱
  try {
    return JSON.parse(text);
  } catch (e1) {
    console.warn("[safeParseJson] 1차 파싱 실패, { } 범위 추출 시도...");
  }

  // Step 3: JSON 객체 범위만 추출
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    console.error("[safeParseJson] JSON 객체 범위를 찾을 수 없습니다.");
    console.error("[safeParseJson] 원본 텍스트 (처음 500자):", text.substring(0, 500));
    return null;
  }

  const extracted = text.slice(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(extracted);
  } catch (e2) {
    console.warn("[safeParseJson] 2차 파싱 실패, 잘린 JSON 복구 시도...");
  }

  // Step 4: 잘린 JSON 복구 시도 (Gemini가 토큰 한도로 중간에 끊은 경우)
  const repaired = repairTruncatedJson(extracted);
  try {
    return JSON.parse(repaired);
  } catch (e3: any) {
    console.error("[safeParseJson] 복구 후에도 파싱 실패:", e3.message);
    console.error("[safeParseJson] 원본 텍스트 (마지막 300자):", text.slice(-300));
    console.error("[safeParseJson] 복구 시도 텍스트 (마지막 300자):", repaired.slice(-300));
    return null;
  }
}

/**
 * Gemini가 maxOutputTokens 한도로 JSON을 중간에 끊었을 때
 * 열린 괄호/따옴표를 닫아서 최대한 파싱 가능한 상태로 복구한다.
 */
function repairTruncatedJson(text: string): string {
  let repaired = text;

  // 끝에 불완전하게 잘린 문자열 정리: 마지막 미완성 key-value 제거
  // 예: ..."some text   또는  ..."some text\n  에서 끊긴 경우
  repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, "");
  repaired = repaired.replace(/,\s*$/, "");

  // 열린 따옴표 닫기
  const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    repaired += '"';
  }

  // 열린 배열/객체 닫기
  const openBrackets: string[] = [];
  let inString = false;
  let escape = false;

  for (const ch of repaired) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") openBrackets.push(ch);
    if (ch === "}") { if (openBrackets.length && openBrackets[openBrackets.length - 1] === "{") openBrackets.pop(); }
    if (ch === "]") { if (openBrackets.length && openBrackets[openBrackets.length - 1] === "[") openBrackets.pop(); }
  }

  // 역순으로 닫기
  while (openBrackets.length) {
    const last = openBrackets.pop();
    repaired += last === "{" ? "}" : "]";
  }

  return repaired;
}

// =============================================================================
// User Prompt 빌드
// =============================================================================

function buildUserPrompt(request: AnalyzeRequest): string {
  let prompt = "";

  if (request.company) {
    prompt += `[지원 기업]: ${request.company}\n`;
  }
  if (request.jobKeyword) {
    prompt += `[지원 직무]: ${request.jobKeyword}\n`;
  }
  prompt += `[문항 수]: ${request.questions.length}\n\n`;

  request.questions.forEach((q, i) => {
    const label = q.question.trim() || `문항 ${i + 1}`;
    prompt += `--- 문항 ${i + 1} ---\n`;
    prompt += `[질문]: ${label}\n`;
    prompt += `[답변]:\n${q.answer}\n\n`;
  });

  prompt += `위 자기소개서를 분석하고 JSON 형식으로 응답하세요. 반드시 한국어로 작성하세요. JSON 외에 다른 텍스트는 절대 포함하지 마세요.`;
  return prompt;
}

// =============================================================================
// Fallback (더미) 데이터
// =============================================================================

function buildFallbackData(request: AnalyzeRequest) {
  const company = request.company || "지원 기업";
  return {
    companyInsight: {
      summary: `${company} 채용 기준을 분석할 수 없습니다. 잠시 후 다시 시도해주세요.`,
      talentKeywords: ["분석 대기 중"],
      hiringSignals: ["서비스 연결 실패"],
      rejectionTriggers: ["서비스 연결 실패"],
      cultureSignals: ["서비스 연결 실패"]
    },
    firstImpression: {
      summaryOneLiner: "분석 서비스에 일시적으로 연결할 수 없습니다. 기본 결과를 표시합니다.",
      persona: "성장 가능성이 돋보이는 지원자",
      hashtags: ["#이력서", "#분석중", "#재시도필요"]
    },
    strengths: ["분석 서비스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해주세요."],
    gaps: ["AI 분석 서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요."],
    positioning: {
      current: "분석 대기 중",
      target: "분석 대기 중",
      gap: "서비스 연결 후 확인할 수 있습니다.",
      strategy: "이전 페이지로 돌아가 다시 분석을 요청해주세요."
    },
    questionTabs: request.questions.map((q, i) => ({
      id: i + 1,
      title: `문항 ${i + 1}`,
      prompt: q.question || `문항 ${i + 1}`,
      subtitleDiagnosis: {
        exists: false,
        original: "",
        feedback: "AI 분석 서비스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
        suggestion: "이전 페이지로 돌아가 다시 분석을 요청해주세요."
      },
      fullAnswer: q.answer,
      overview: "서비스 연결 실패로 인해 상세 피드백을 제공할 수 없습니다.",
      feedbackCards: []
    })),
    interviewQA: [
      { question: "서비스 연결 실패", followUps: [], modelAnswer: "잠시 후 다시 시도해주세요." }
    ],
    actionPlan: [
      { title: "분석 재시도", description: "분석 페이지로 돌아가 다시 시도해주세요.", expectedImpact: "정상적인 AI 분석 결과를 받아볼 수 있습니다." }
    ],
    pmComment: "분석 서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요."
  };
}