import dotenv from "dotenv";
import {
  readAiModelSettings,
  writeAiModelSettings,
} from "../lib/ai-model-settings.js";

dotenv.config();

const PROVIDERS = [
  {
    providerKey: "gemini",
    provider: "Gemini",
    envKey: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  },
  {
    providerKey: "openai",
    provider: "OpenAI",
    envKey: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
  },
  {
    providerKey: "anthropic",
    provider: "Claude",
    envKey: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com/v1",
  },
  {
    providerKey: "perplexity",
    provider: "Perplexity",
    envKey: "PERPLEXITY_API_KEY",
    baseUrl: "https://api.perplexity.ai",
  },
];

const GEMINI_RECOMMENDED_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

const OPENAI_DEFAULT_MODEL = process.env.OPENAI_DEFAULT_MODEL || "gpt-5.4-nano";
const OPENAI_RECOMMENDED_MODELS = [
  OPENAI_DEFAULT_MODEL,
  "gpt-5.4-mini",
  "gpt-5.6-luna",
];

function maskKey(value) {
  if (!value) return "Not configured";
  if (value.length <= 12) return `${value.slice(0, 3)}****`;
  return `${value.slice(0, 6)}****${value.slice(-4)}`;
}

function getProviderConfig() {
  return PROVIDERS.map((provider) => {
    const apiKey = process.env[provider.envKey];
    return {
      ...provider,
      hasApiKey: Boolean(apiKey),
      apiKeyMasked: maskKey(apiKey),
    };
  });
}

function getConfiguredModels() {
  const models = [];
  if (process.env.GEMINI_API_KEY) {
    GEMINI_RECOMMENDED_MODELS.forEach((modelName) => {
      models.push({
        providerKey: "gemini",
        provider: "Gemini",
        modelName,
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        source: "server_config",
      });
    });
  }
  if (process.env.OPENAI_API_KEY) {
    const uniqueModelNames = Array.from(new Set(OPENAI_RECOMMENDED_MODELS));
    uniqueModelNames.forEach((modelName) => {
      models.push({
        providerKey: "openai",
        provider: "OpenAI",
        modelName,
        baseUrl: "https://api.openai.com/v1",
        source: "server_config",
      });
    });
  }
  return models;
}

export function filterRecommendedModels(models) {
  const allowedByProvider = new Map([
    ["gemini", new Set(GEMINI_RECOMMENDED_MODELS)],
    ["openai", new Set(OPENAI_RECOMMENDED_MODELS)],
  ]);

  return models.filter((model) => {
    const providerKey = String(model.providerKey ?? "").toLowerCase();
    const allowedModels = allowedByProvider.get(providerKey);
    return allowedModels?.has(model.modelName);
  });
}

async function listGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini model list failed: ${message.slice(0, 240)}`);
  }

  const data = await response.json();
  return filterRecommendedModels((data.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => ({
      providerKey: "gemini",
      provider: "Gemini",
      modelName: String(model.name ?? "").replace(/^models\//, ""),
      displayName: model.displayName ?? String(model.name ?? "").replace(/^models\//, ""),
      description: model.description ?? "",
      inputTokenLimit: model.inputTokenLimit ?? null,
      outputTokenLimit: model.outputTokenLimit ?? null,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      source: "provider_api",
    })))
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}

async function listOpenAiModels() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI model list failed: ${message.slice(0, 240)}`);
  }

  const data = await response.json();
  return filterRecommendedModels((data.data ?? [])
    .map((model) => String(model.id ?? ""))
    .filter((modelName) => /^gpt-|^o\d|^chatgpt-/i.test(modelName))
    .map((modelName) => ({
      providerKey: "openai",
      provider: "OpenAI",
      modelName,
      displayName: modelName,
      description: "",
      inputTokenLimit: null,
      outputTokenLimit: null,
      baseUrl: "https://api.openai.com/v1",
      source: "provider_api",
    })))
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}

async function testGemini(modelName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { status: "failed", responseTimeMs: 0, message: "GEMINI_API_KEY is not configured." };
  }

  const startedAt = Date.now();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with OK." }] }],
      }),
    }
  );
  const responseTimeMs = Date.now() - startedAt;

  if (!response.ok) {
    const message = await response.text();
    return {
      status: "failed",
      responseTimeMs,
      message: message.slice(0, 240),
    };
  }

  return { status: "success", responseTimeMs, message: "Provider returned a valid response." };
}

function getOpenAiResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();
}

async function testOpenAi(modelName) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { status: "failed", responseTimeMs: 0, message: "OPENAI_API_KEY is not configured." };
  }

  const startedAt = Date.now();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      input: "Reply with OK.",
      max_output_tokens: 16,
    }),
  });
  const responseTimeMs = Date.now() - startedAt;

  if (!response.ok) {
    const message = await response.text();
    return {
      status: "failed",
      responseTimeMs,
      message: message.slice(0, 240),
    };
  }

  const data = await response.json();
  const text = getOpenAiResponseText(data);
  return {
    status: text ? "success" : "failed",
    responseTimeMs,
    message: text ? "Provider returned a valid response." : "OpenAI response was empty.",
  };
}

async function listAvailableModels() {
  const results = await Promise.allSettled([listGeminiModels(), listOpenAiModels()]);
  return results.flatMap((result) => {
    if (result.status === "fulfilled") return result.value;
    console.warn("[admin/ai-models] model list failed:", result.reason?.message ?? result.reason);
    return [];
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({
        providers: getProviderConfig(),
        settings: readAiModelSettings(),
        configuredModels: getConfiguredModels(),
        availableModels: await listAvailableModels(),
      });
    }

    if (req.method === "POST") {
      if (req.body?.action === "save-settings") {
        const defaultModel = req.body?.defaultModel;
        const fallbackModel = req.body?.fallbackModel ?? null;

        if (!defaultModel?.providerKey || !defaultModel?.modelName) {
          return res.status(400).json({ error: "defaultModel is required." });
        }

        const settings = writeAiModelSettings({ defaultModel, fallbackModel });
        return res.status(200).json({ ok: true, settings });
      }

      const providerKey = String(req.body?.providerKey ?? "").toLowerCase();
      const modelName = req.body?.modelName;

      if (!providerKey || !modelName) {
        return res.status(400).json({ error: "providerKey and modelName are required." });
      }

      if (providerKey === "gemini" || providerKey === "google") {
        return res.status(200).json(await testGemini(modelName));
      }
      if (providerKey === "openai") {
        return res.status(200).json(await testOpenAi(modelName));
      }

      const provider = getProviderConfig().find((item) => item.providerKey === providerKey);
      return res.status(200).json({
        status: provider?.hasApiKey ? "success" : "failed",
        responseTimeMs: 0,
        message: provider?.hasApiKey
          ? "API key is configured. Live test adapter is not implemented for this provider yet."
          : "API key is not configured.",
      });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    console.error("[admin/ai-models] error:", error);
    return res.status(500).json({
      error: "AI 모델 설정을 확인하지 못했습니다.",
      message: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
}
