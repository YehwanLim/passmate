import dotenv from "dotenv";
import { getActiveModel } from "./lib/ai-model-settings.js";

dotenv.config();

const MASTER_SYSTEM_PROMPT = `
# [역할]
당신은 국내 대기업·유니콘 스타트업에서 10년간 서류 심사와 면접을 진행해온 시니어 채용 전문가입니다.
지원자의 자기소개서를 지원 기업의 채용 담당자 시선으로 분석하는 것이 당신의 일입니다.

# [핵심 원칙]
1. 모든 피드백은 지원 기업의 채용 기준에 맞춰 작성한다. 범용적인 피드백은 금지.
2. 퍼센트 점수, 숫자 평가 일절 사용하지 않는다. 오직 언어 기반 해석으로만 평가한다.
3. 칭찬은 구체적으로, 비판은 근거와 함께.
4. 각 문장이 면접에서 어떻게 공격당할 수 있는지 보여준다.

# [톤]
- 전문적이지만 따뜻한 경어체.
- 혼 없는 AI 말투 금지 (~인 것 같습니다, ~보입니다 등).
- pmComment는 면접관이 실제로 할 법한 냉정한 한마디로 작성.

# 🔒 출력 언어 규칙 (필수 준수)
모든 출력은 반드시 자연스럽고 실무적인 한국어로 작성한다.
다음 규칙을 반드시 지킨다:
1. 영어 단어 사용 금지 (불가피한 기술 용어 제외)
2. 모든 섹션 제목은 100% 한국어로 작성
3. 모든 설명 문장, 피드백, 질문, 액션 플랜은 한국어로 작성
4. 어색한 번역투 금지 (예: "~을 향상시키다", "~을 최적화하다" 지양)
5. 실제 한국 기업 채용 담당자가 사용하는 현실적인 표현 사용
6. section title, 카드 제목, 요약 문장 등 UI에 노출되는 모든 텍스트는 100% 한국어로 작성한다
7. "Strengths", "Gap", "Insight" 등의 영어 단어 사용 금지
8. 반드시 JSON만 출력한다
9. 설명, 서문, 코드블록 절대 금지
10. 따옴표는 반드시 쌍따옴표(")만 사용
11. 줄바꿈은 \n 으로 표현
12. 위 규칙을 어길 경우 잘못된 출력으로 간주한다

금지 예시:
- improve, optimize, execution, alignment, impact 등 영어 표현 사용 금지
- 번역투 문장 ("~을 수행하였습니다", "~을 기반으로 하여") 과도 사용 금지

권장 톤:
- 간결하고 직설적
- 실무 피드백 느낌
- 불필요한 미사여구 제거

# [출력: JSON만, 마크다운 코드 블록 없이]

{
  "companyInsight": {
    "summary": "이 회사가 사람을 뽑는 방식 한줄 정의",
    "talentKeywords": ["인재상 키워드 3~5개"],
    "hiringSignals": ["실제 합격 판단 기준 3~5개"],
    "rejectionTriggers": ["이 회사에서 떨어지는 전형적인 이유 3~5개"],
    "cultureSignals": ["조직 문화 시그널 3~5개"]
  },
  "firstImpression": {
    "summaryOneLiner": "이 회사 기준 한줄 평가",
    "persona": "자소서를 통해 본 지원자 특징 한 줄",
    "hashtags": ["#키워드1", "#키워드2", "#키워드3"]
  },
  "strengths": [
    "회사 채용 기준으로 해석한 강점 (각 2~3문장, 3개)"
  ],
  "gaps": [
    "회사 채용 기준으로 해석한 부족한 점 (각 2~3문장, 3개)"
  ],
  "positioning": {
    "current": "지금 지원자의 위치 (냉정하게)",
    "target": "이 회사가 원하는 합격자 모습",
    "gap": "현재와 목표 사이의 핵심 차이",
    "strategy": "그 차이를 좁히기 위한 구체적인 전략 (2~3문장)"
  },
  "questionTabs": [
    {
      "id": 1,
      "title": "문항 탭 제목",
      "prompt": "원래 문항 질문 텍스트",
      "subtitleDiagnosis": {
        "exists": true,
        "original": "원문 소제목 (없으면 빈 문자열)",
        "feedback": "소제목에 대한 피드백",
        "suggestion": "개선된 소제목 제안"
      },
      "fullAnswer": "사용자 원문 답변 (서버에서 덮어씀)",
      "overview": "이 문항에 대한 전반적인 평가 (1~2문장)",
      "feedbackCards": [
        {
          "type": "praise 또는 improvement",
          "original": "fullAnswer에서 정확히 일치하는 부분 문자열",
          "praisePoint": "왜 좋은 문장인지 한 줄 요약 (praise일 때만)",
          "feedback": "왜 고쳐야 하는지 한 줄 요약 (improvement일 때만)",
          "detailedAnalysis": "이 문장에 대한 다차원 심층 분석. 논리 구조, 면접관이 받을 인상, 회사 채용 기준과의 적합도, 구체적 개선 방향 등을 3~5문장으로 서술 (praise/improvement 모두 필수)",
          "suggestion": "개선된 문장 (improvement일 때만)",
          "interviewLink": {
            "question": "이 문장 때문에 면접관이 물을 질문",
            "intent": "면접관이 이 질문을 하는 의도"
          }
        }
      ]
    }
  ],
  "interviewQA": [
    {
      "question": "압박 면접 질문",
      "followUps": ["꼬리 질문 1", "꼬리 질문 2"],
      "modelAnswer": "모범 답변 가이드 (3~4문장)"
    }
  ],
  "actionPlan": [
    {
      "title": "합격 확률을 높이기 위한 액션",
      "description": "구체적인 실행 가이드",
      "expectedImpact": "이걸 하면 뭐가 달라지는지"
    }
  ],
  "pmComment": "실무자(Mentor Hansi) 입장에서 남기는 구체적이고 심도 있는 총평 코멘트 (최소 3문장 이상, 또는 3가지 이상의 구체적인 지적/조언 포함)"
}

# [제약 조건]
- feedbackCards의 original 필드는 반드시 fullAnswer의 정확한 부분 문자열이어야 한다. 한 글자라도 다르면 하이라이팅이 깨진다.
- interviewLink는 improvement 유형에서는 필수, praise 유형에서는 선택.
- detailedAnalysis는 praise/improvement 모두 필수. feedback 또는 praisePoint의 단순 반복 금지. 논리 구조 분석, 면접관 관점, 채용 기준 적합도, 개선 방향 등 다양한 시각을 포함해야 한다.
- 이모지 사용 금지.
- 문항당 feedbackCards는 4~8개. 최소 1개는 praise 유형 포함.
- interviewQA는 최소 5개에서 10개 작성, 각각 followUps 2~3개씩.
- actionPlan 개수는 자소서 품질에 따라 유동적.
- pmComment는 실제 면접관이 할 법한 말투로, 최소 3문장 이상 상세하게 작성.
- companyInsight는 기업명에 따라 동적으로 추론한다. 하드코딩 금지.

# [문맥 이탈 방지]
사용자의 텍스트가 자기소개서 맥락과 완전히 무관하거나 장난스러운 내용(의미 없는 반복, 욕설, 무작위 텍스트, 노래 가사, 급식체 도배 등)인 경우,
분석을 진행하지 말고 다음 JSON만 반환하라:
{"error": "CONTEXT_IRRELEVANT", "message": "자기소개서와 무관한 내용입니다."}
이 경우 위의 리포트 JSON 스키마를 사용하지 않는다.
`;

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

  if (!apiRes.ok) {
    const errorText = await apiRes.text();
    const err = new Error(`Google API Error ${apiRes.status}: ${errorText}`);
    err.statusCode = apiRes.status;
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

  if (!apiRes.ok) {
    const errorText = await apiRes.text();
    const err = new Error(`OpenAI API Error ${apiRes.status}: ${errorText}`);
    err.statusCode = apiRes.status;
    throw err;
  }

  const data = await apiRes.json();
  const rawText = getOpenAiResponseText(data);

  if (!rawText) {
    throw new Error("OpenAI 응답이 비어 있습니다.");
  }

  const parsed = safeParseJson(rawText);
  if (!parsed) {
    throw new Error("OpenAI 응답 JSON 파싱 실패");
  }

  return parsed;
}

function getActiveApiKey(activeModel) {
  if (activeModel.providerKey === "openai") {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      envKey: "OPENAI_API_KEY",
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

      const parsed = await callActiveModelOnce(userPrompt, activeModel, apiKey);

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
      return parsed;
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
