const DEFAULT_SETTINGS = {
  defaultModel: {
    providerKey: "gemini",
    modelName: "gemini-2.5-flash-lite",
  },
  fallbackModel: null,
};

const SETTINGS_ID = "singleton";

function fromStoredSettings(row) {
  if (!row) return DEFAULT_SETTINGS;
  return {
    defaultModel: {
      providerKey: row.defaultProviderKey,
      modelName: row.defaultModelName,
    },
    fallbackModel: row.fallbackProviderKey && row.fallbackModelName
      ? { providerKey: row.fallbackProviderKey, modelName: row.fallbackModelName }
      : null,
  };
}

export async function readAiModelSettings(db) {
  if (!db?.aiModelSetting?.findUnique) return DEFAULT_SETTINGS;
  const stored = await db.aiModelSetting.findUnique({ where: { id: SETTINGS_ID } });
  return fromStoredSettings(stored);
}

export async function writeAiModelSettings(db, nextSettings) {
  if (!db?.aiModelSetting?.upsert) throw new Error("AI_MODEL_SETTINGS_UNAVAILABLE");
  const defaultModel = normalizeModel(nextSettings?.defaultModel) ?? DEFAULT_SETTINGS.defaultModel;
  const fallbackModel = normalizeModel(nextSettings?.fallbackModel);
  const stored = await db.aiModelSetting.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      defaultProviderKey: defaultModel.providerKey,
      defaultModelName: defaultModel.modelName,
      fallbackProviderKey: fallbackModel?.providerKey ?? null,
      fallbackModelName: fallbackModel?.modelName ?? null,
    },
    update: {
      defaultProviderKey: defaultModel.providerKey,
      defaultModelName: defaultModel.modelName,
      fallbackProviderKey: fallbackModel?.providerKey ?? null,
      fallbackModelName: fallbackModel?.modelName ?? null,
    },
  });
  return fromStoredSettings(stored);
}

export function getActiveGeminiModel(settings = DEFAULT_SETTINGS) {
  const activeModel = getActiveModel(settings);
  if (activeModel.providerKey === "gemini") {
    return activeModel.modelName;
  }
  return DEFAULT_SETTINGS.defaultModel.modelName;
}

export function getActiveModel(settings = DEFAULT_SETTINGS) {
  const defaultModel = settings?.defaultModel;
  if (defaultModel?.providerKey && defaultModel?.modelName) {
    return {
      providerKey: normalizeProviderKey(defaultModel.providerKey),
      modelName: defaultModel.modelName,
    };
  }

  return DEFAULT_SETTINGS.defaultModel;
}

function normalizeProviderKey(providerKey) {
  const value = String(providerKey ?? "").toLowerCase();
  if (value === "google") return "gemini";
  if (value === "chatgpt") return "openai";
  return value;
}

function normalizeModel(model) {
  if (!model?.providerKey || !model?.modelName) return null;
  return {
    providerKey: normalizeProviderKey(model.providerKey),
    modelName: String(model.modelName),
  };
}

export function getModelCallSequence(settings = DEFAULT_SETTINGS) {
  const candidates = [
    normalizeModel(settings?.defaultModel) ?? DEFAULT_SETTINGS.defaultModel,
    normalizeModel(settings?.fallbackModel),
  ].filter(Boolean);

  const seen = new Set();
  return candidates.filter((model) => {
    const key = `${model.providerKey}:${model.modelName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
