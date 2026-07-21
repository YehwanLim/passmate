import dotenv from "dotenv";
import { getActiveModel } from "../lib/ai-model-settings.js";
import { MASTER_SYSTEM_PROMPT } from "../shared/prompts/reportPrompt.js";

dotenv.config();

// ── XSS 방어: 서버 측 텍스트 정제 ──
function sanitizeInput(text) {
  if (!text) return "";
  return text
    .replace(/\0/g, "")                                                       // null bytes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")       // <script> 태그
    .replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")             // on* 이벤트 핸들러
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")          // <style> 태그
    .replace(/<\/?(?:iframe|object|embed|form|input|button|link|meta)\b[^>]*>/gi, "")  // 위험 태그
    .replace(/javascript\s*:/gi, "")                                           // javascript: 프로토콜
    .replace(/data\s*:[^,]*,/gi, "")                                           // data: 프로토콜
    .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "")                              // 나머지 HTML 태그
    .trim();
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 503 || status === 429 || status === 500;
}

async function callGeminiOnce(userPrompt, apiKey, modelName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  const startedAt = Date.now();

  const apiRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: MASTER_SYSTEM_PROMPT + "\n\n" + userPrompt }] }
      ]
    })
  });

  clearTimeout(timeout);
  const responseTimeMs = Date.now() - startedAt;

  if (!apiRes.ok) {
    const errorText = await apiRes.text();
    const err = new Error(`Google API Error ${apiRes.status}: ${errorText}`);
    err.statusCode = apiRes.status;
    throw err;
  }

  const data = await apiRes.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usage = data.usageMetadata ?? {};

  if (!rawText) {
    throw new Error("Gemini 응답이 비어 있습니다.");
  }

  const parsed = safeParseJson(rawText);
  if (!parsed) {
    throw new Error("Gemini 응답 JSON 파싱 실패");
  }

  return {
    parsed,
    responseTimeMs,
    httpStatus: apiRes.status,
    tokenUsage: {
      promptTokens: Number(usage.promptTokenCount ?? 0),
      completionTokens: Number(usage.candidatesTokenCount ?? 0),
      totalTokens: Number(
        usage.totalTokenCount ??
          (Number(usage.promptTokenCount ?? 0) + Number(usage.candidatesTokenCount ?? 0))
      ),
    },
  };
}

function getOpenAiResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();
}

async function callOpenAiOnce(userPrompt, apiKey, modelName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  const startedAt = Date.now();

  const apiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: modelName,
      input: MASTER_SYSTEM_PROMPT + "\n\n" + userPrompt,
    }),
  });

  clearTimeout(timeout);
  const responseTimeMs = Date.now() - startedAt;

  if (!apiRes.ok) {
    const errorText = await apiRes.text();
    const err = new Error(`OpenAI API Error ${apiRes.status}: ${errorText}`);
    err.statusCode = apiRes.status;
    throw err;
  }

  const data = await apiRes.json();
  const rawText = getOpenAiResponseText(data);
  const usage = data.usage ?? {};

  if (!rawText) {
    throw new Error("OpenAI 응답이 비어 있습니다.");
  }

  const parsed = safeParseJson(rawText);
  if (!parsed) {
    throw new Error("OpenAI 응답 JSON 파싱 실패");
  }

  return {
    parsed,
    responseTimeMs,
    httpStatus: apiRes.status,
    tokenUsage: {
      promptTokens: Number(usage.input_tokens ?? 0),
      completionTokens: Number(usage.output_tokens ?? 0),
      totalTokens: Number(
        usage.total_tokens ??
          (Number(usage.input_tokens ?? 0) + Number(usage.output_tokens ?? 0))
      ),
    },
  };
}

function getActiveApiKey(activeModel) {
  if (activeModel.providerKey === "openai") {
    return {
      apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY,
      envKey: "OPENAI_API_KEY 또는 OPEN_API_KEY",
    };
  }

  return {
    apiKey: process.env.GEMINI_API_KEY,
    envKey: "GEMINI_API_KEY",
  };
}

async function callActiveModelOnce(userPrompt, activeModel, apiKey) {
  if (activeModel.providerKey === "openai") {
    return callOpenAiOnce(userPrompt, apiKey, activeModel.modelName);
  }
  if (activeModel.providerKey === "gemini" || activeModel.providerKey === "google") {
    return callGeminiOnce(userPrompt, apiKey, activeModel.modelName);
  }

  throw new Error(`${activeModel.providerKey} 제공자는 아직 분석 호출을 지원하지 않습니다.`);
}

async function analyzeCoverLetter(input) {
  let request;
  if (typeof input === "string") {
    request = {
      questions: [{ question: "문항 1", answer: input }],
    };
  } else {
    request = input;
  }

  const activeModel = getActiveModel();
  const { apiKey, envKey } = getActiveApiKey(activeModel);

  if (!apiKey) {
    console.error(`[analyze] ❌ ${envKey} not set`);
    throw new Error(`${envKey}가 설정되지 않았습니다. 서버 환경변수를 확인해주세요.`);
  }

  const userPrompt = buildUserPrompt(request);

  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[analyze] ⏳ 재시도 ${attempt}/${MAX_RETRIES} (${delay}ms 후)...`);
        await sleep(delay);
      }

      const modelResult = await callActiveModelOnce(userPrompt, activeModel, apiKey);
      const parsed = modelResult.parsed;

      // 문맥 이탈 감지: AI가 CONTEXT_IRRELEVANT 에러 반환한 경우
      if (parsed.error === "CONTEXT_IRRELEVANT") {
        console.warn("[analyze] AI가 문맥 이탈로 판단:", parsed.message);
        return { error: "CONTEXT_IRRELEVANT", message: parsed.message || "자기소개서와 무관한 내용입니다." };
      }

      if (parsed.questionTabs) {
        parsed.questionTabs.forEach((tab, idx) => {
          if (request.questions[idx]) {
            tab.fullAnswer = request.questions[idx].answer;
            tab.prompt = request.questions[idx].question || `문항 ${idx + 1}`;
          }
        });
      }

      console.log(`[analyze] ✅ ${activeModel.providerKey}/${activeModel.modelName} 응답 파싱 성공 (시도 ${attempt + 1})`);
      return {
        ...parsed,
        analysisMeta: {
          modelProvider: activeModel.providerKey,
          modelName: activeModel.modelName,
          responseTimeMs: modelResult.responseTimeMs,
          httpStatus: modelResult.httpStatus,
          tokenUsage: modelResult.tokenUsage,
        },
      };
    } catch (error) {
      lastError = error;
      console.error(`[analyze] 시도 ${attempt + 1} 실패:`, error.message);

      if (!isRetryableStatus(error.statusCode)) {
        break;
      }
    }
  }

  console.error("[analyze] ❌ 모든 재시도 실패:", lastError?.message);
  throw lastError || new Error("AI 분석 서비스에 연결할 수 없습니다.");
}

function safeParseJson(rawText) {
  let text = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  try {
    return JSON.parse(text);
  } catch (e1) {
    console.warn("[safeParseJson] 1차 파싱 실패, { } 범위 추출 시도...");
  }

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    console.error("[safeParseJson] JSON 객체 범위를 찾을 수 없습니다.");
    return null;
  }

  const extracted = text.slice(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(extracted);
  } catch (e2) {
    console.warn("[safeParseJson] 2차 파싱 실패, 잘린 JSON 복구 시도...");
  }

  const repaired = repairTruncatedJson(extracted);
  try {
    return JSON.parse(repaired);
  } catch (e3) {
    console.error("[safeParseJson] 복구 후에도 파싱 실패:", e3.message);
    return null;
  }
}

function repairTruncatedJson(text) {
  let repaired = text;

  repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, "");
  repaired = repaired.replace(/,\s*$/, "");

  const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    repaired += '"';
  }

  const openBrackets = [];
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

  while (openBrackets.length) {
    const last = openBrackets.pop();
    repaired += last === "{" ? "}" : "]";
  }

  return repaired;
}

function buildUserPrompt(request) {
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

export const maxDuration = 60;

function buildFallbackData(request, errorMsg = "서버 연결에 실패했습니다.") {
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
      summaryOneLiner: `[시스템 디버그] 에러 원인: ${errorMsg}`,
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
    pmComment: `[오류 안내] 분석 서비스 연결에 실패했습니다. (${errorMsg})`
  };
}

export default async function handler(req, res) {
  // CORS 처리 (필요시)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    
    // 새 형식(questions[]) 또는 이전 형식(content string) 지원
    const input = payload?.questions ? payload : payload?.content;

    if (!input) {
      return res.status(400).json({ error: 'questions 또는 content가 필요합니다.' });
    }

    // ── 서버 측 입력 유효성 검증 ──
    if (input.questions && Array.isArray(input.questions)) {
      // XSS Sanitization
      input.questions = input.questions.map(q => ({
        question: sanitizeInput(q.question || ''),
        answer: sanitizeInput(q.answer || ''),
      }));
      if (input.company) input.company = sanitizeInput(input.company);
      if (input.jobKeyword) input.jobKeyword = sanitizeInput(input.jobKeyword);

      // 글자 수 검증
      const totalChars = input.questions.reduce((sum, q) => sum + (q.answer?.length || 0), 0);
      
      if (totalChars < 200) {
        return res.status(400).json({ error: 'CHAR_MINIMUM', message: '최소 200자 이상 입력해야 분석할 수 있습니다.' });
      }
      if (totalChars > 6000) {
        return res.status(400).json({ error: 'CHAR_OVER_LIMIT', message: '글자 수 제한(6,000자)을 초과했습니다.' });
      }

      // 빈 답변 검증
      const hasContent = input.questions.some(q => q.answer && q.answer.trim().length > 0);
      if (!hasContent) {
        return res.status(400).json({ error: 'EMPTY_CONTENT', message: '답변 내용을 입력해 주세요.' });
      }
    }

    const result = await analyzeCoverLetter(input);

    // AI가 에러 코드를 반환한 경우 적절한 HTTP 상태 코드로 전달
    if (result.error === 'CONTEXT_IRRELEVANT') {
      return res.status(400).json(result);
    }
    if (result.error === 'RATE_LIMIT') {
      return res.status(429).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('API Error:', error);
    
    // AbortError (타임아웃)
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'TIMEOUT', message: '분석 시간이 초과되었습니다. 다시 시도해 주세요.' });
    }
    
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
