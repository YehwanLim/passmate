const GEMINI_HOST = "generativelanguage.googleapis.com";
const OPENAI_HOST = "api.openai.com";
const PROVIDER_HOSTS = new Set([GEMINI_HOST, OPENAI_HOST]);

/** 파싱 가능한 최소 리포트. attachRequestAnswers 가 questionTabs 를 채운다. */
export const SUCCESS_REPORT_TEXT = JSON.stringify({
  firstImpression: { summary: "통합 테스트용 리포트" },
  questionTabs: [{ prompt: "", fullAnswer: "", review: "통합 테스트용 문항 평가" }],
});

export class UnexpectedNetworkCallError extends Error {
  constructor(hostname) {
    super(`통합 테스트에서 예상하지 못한 외부 호출이 발생했다: ${hostname}`);
    this.name = "UnexpectedNetworkCallError";
  }
}

function geminiEnvelope(text) {
  return {
    candidates: [{ content: { parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 22, totalTokenCount: 33 },
  };
}

function openAiEnvelope(text) {
  return {
    output_text: text,
    usage: { input_tokens: 11, output_tokens: 22, total_tokens: 33 },
  };
}

function fakeResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function modelNameFrom(url, provider) {
  if (provider === "openai") return "openai-model";
  const match = url.pathname.match(/\/models\/([^:]+):generateContent$/);
  return match?.[1] ?? "unknown";
}

export function installProviderFixture() {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let steps = [];

  globalThis.fetch = async (input) => {
    const raw = typeof input === "string" ? input : input?.url;
    const url = new URL(raw);
    if (!PROVIDER_HOSTS.has(url.hostname)) {
      throw new UnexpectedNetworkCallError(url.hostname);
    }

    const provider = url.hostname === OPENAI_HOST ? "openai" : "gemini";
    calls.push({ provider, modelName: modelNameFrom(url, provider) });

    if (steps.length === 0) {
      throw new Error("provider fixture: respondWith 로 응답 시나리오를 먼저 설정해야 한다");
    }
    const step = steps.length > 1 ? steps.shift() : steps[0];

    if (step.abort) {
      throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    }
    if (typeof step.status === "number" && step.status !== 200) {
      return fakeResponse(step.status, {});
    }
    const envelope = provider === "openai" ? openAiEnvelope(step.text) : geminiEnvelope(step.text);
    return fakeResponse(200, envelope);
  };

  return {
    calls,
    respondWith(scenario) {
      steps = Array.isArray(scenario) ? [...scenario] : [scenario];
    },
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}
