import dotenv from "dotenv";

import { requireAdministrator } from "../auth.js";
import { recordAuditEvent } from "../audit-log.js";
import {
  readAiModelSettings,
  writeAiModelSettings,
} from "../ai-model-settings.js";
import prisma from "../prisma.js";
import { USER_RATE_LIMITS, consumeUserRateLimit } from "../rate-limit.js";
import {
  handleRequestError,
  requestIdFor,
  sendMethodNotAllowed,
  sendRequestError,
} from "../request-errors.js";

dotenv.config();

const PROVIDERS = [
  {
    providerKey: "gemini",
    provider: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    envKeys: ["GEMINI_API_KEY"],
  },
  {
    providerKey: "openai",
    provider: "ChatGPT / OpenAI",
    baseUrl: "https://api.openai.com/v1",
    envKeys: ["OPENAI_API_KEY", "OPEN_API_KEY"],
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

function getEnvValue(envKeys) {
  return envKeys.map((envKey) => process.env[envKey]).find(Boolean);
}

function normalizeProviderKey(providerKey) {
  return String(providerKey ?? "").toLowerCase();
}

function allowedModelsByProvider() {
  return new Map([
    ["gemini", new Set(GEMINI_RECOMMENDED_MODELS)],
    ["openai", new Set(OPENAI_RECOMMENDED_MODELS)],
  ]);
}

export function filterRecommendedModels(models) {
  const allowedByProvider = allowedModelsByProvider();

  return models.filter((model) => {
    const providerKey = normalizeProviderKey(model.providerKey);
    return allowedByProvider.get(providerKey)?.has(model.modelName);
  });
}

function isAllowedModel(providerKey, modelName) {
  return allowedModelsByProvider()
    .get(normalizeProviderKey(providerKey))
    ?.has(String(modelName ?? "")) ?? false;
}

function getProviderConfig() {
  return PROVIDERS.map(({ envKeys, ...provider }) => ({
    ...provider,
    hasApiKey: Boolean(getEnvValue(envKeys)),
  }));
}

function getAllowedModels() {
  return PROVIDERS.flatMap((provider) => {
    const models = allowedModelsByProvider().get(provider.providerKey) ?? new Set();
    return Array.from(models).map((modelName) => ({
      baseUrl: provider.baseUrl,
      modelName,
      provider: provider.provider,
      providerKey: provider.providerKey,
      source: "allowlist",
    }));
  });
}

function getConfiguredModels() {
  const providersByKey = new Map(PROVIDERS.map((provider) => [provider.providerKey, provider]));
  return getAllowedModels().filter((model) => {
    const provider = providersByKey.get(model.providerKey);
    return provider && Boolean(getEnvValue(provider.envKeys));
  });
}

async function testGemini(modelName) {
  const apiKey = getEnvValue(["GEMINI_API_KEY"]);
  if (!apiKey) {
    return { status: "failed", responseTimeMs: 0, message: "Provider is not configured." };
  }

  const startedAt = Date.now();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with OK." }] }],
        }),
      },
    );

    return {
      status: response.ok ? "success" : "failed",
      responseTimeMs: Date.now() - startedAt,
      message: response.ok ? "Provider returned a valid response." : "Provider connection test failed.",
    };
  } catch {
    return {
      status: "failed",
      responseTimeMs: Date.now() - startedAt,
      message: "Provider connection test failed.",
    };
  }
}

async function testOpenAi(modelName) {
  const apiKey = getEnvValue(["OPENAI_API_KEY", "OPEN_API_KEY"]);
  if (!apiKey) {
    return { status: "failed", responseTimeMs: 0, message: "Provider is not configured." };
  }

  const startedAt = Date.now();
  try {
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

    return {
      status: response.ok ? "success" : "failed",
      responseTimeMs: Date.now() - startedAt,
      message: response.ok ? "Provider returned a valid response." : "Provider connection test failed.",
    };
  } catch {
    return {
      status: "failed",
      responseTimeMs: Date.now() - startedAt,
      message: "Provider connection test failed.",
    };
  }
}

async function testModelConnection(providerKey, modelName) {
  if (providerKey === "gemini") return testGemini(modelName);
  return testOpenAi(modelName);
}

function hasValidModelSetting(model) {
  return Boolean(
    model &&
      typeof model === "object" &&
      isAllowedModel(model.providerKey, model.modelName),
  );
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);

  try {
    const administrator = await requireAdministrator(req, prisma);
    if (req.method !== "GET" && req.method !== "POST") {
      return sendMethodNotAllowed(res, requestId);
    }

    if (req.method === "GET") {
      return res.status(200).json({
        availableModels: getAllowedModels(),
        configuredModels: getConfiguredModels(),
        liveStatuses: [],
        providers: getProviderConfig(),
        settings: await readAiModelSettings(prisma),
      });
    }

    if (req.body?.action === "save-settings") {
      const defaultModel = req.body?.defaultModel;
      const fallbackModel = req.body?.fallbackModel ?? null;

      if (!hasValidModelSetting(defaultModel) || (fallbackModel && !hasValidModelSetting(fallbackModel))) {
        return sendRequestError(res, 400, requestId);
      }

      const settings = await writeAiModelSettings(prisma, { defaultModel, fallbackModel });
      await recordAuditEvent({
        actorId: administrator.applicationUser.id,
        db: prisma,
        outcome: "SUCCEEDED",
        requestId,
        targetId: "singleton",
        targetType: "ai_model_settings",
      });
      return res.status(200).json({ ok: true, settings });
    }

    if (req.body?.action !== "test-model") {
      return sendRequestError(res, 400, requestId);
    }

    const providerKey = normalizeProviderKey(req.body?.providerKey);
    const modelName = String(req.body?.modelName ?? "");
    if (!isAllowedModel(providerKey, modelName)) {
      return sendRequestError(res, 400, requestId);
    }

    const rateLimit = await consumeUserRateLimit(prisma, {
      policy: USER_RATE_LIMITS.adminModelTest,
      userId: administrator.applicationUser.id,
    });
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: "Request failed",
        requestId,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const result = await testModelConnection(providerKey, modelName);
    await recordAuditEvent({
      actorId: administrator.applicationUser.id,
      db: prisma,
      outcome: result.status === "success" ? "SUCCEEDED" : "FAILED",
      requestId,
      targetId: `${providerKey}:${modelName}`,
      targetType: "ai_model_test",
    });
    return res.status(200).json(result);
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/ai-models");
  }
}
