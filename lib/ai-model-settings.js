import fs from "node:fs";
import path from "node:path";

const DEFAULT_SETTINGS = {
  defaultModel: {
    providerKey: "gemini",
    modelName: "gemini-2.5-flash-lite",
  },
  fallbackModel: null,
};

function getSettingsPath() {
  return path.join(process.cwd(), "data", "ai-model-settings.json");
}

export function readAiModelSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), "utf-8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      defaultModel: parsed.defaultModel ?? DEFAULT_SETTINGS.defaultModel,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeAiModelSettings(nextSettings) {
  const settings = {
    ...readAiModelSettings(),
    ...nextSettings,
  };
  const settingsPath = getSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  return settings;
}

export function getActiveGeminiModel() {
  const activeModel = getActiveModel();
  if (activeModel.providerKey === "gemini") {
    return activeModel.modelName;
  }
  return DEFAULT_SETTINGS.defaultModel.modelName;
}

export function getActiveModel(settings = readAiModelSettings()) {
  const defaultModel = settings?.defaultModel;
  if (defaultModel?.providerKey && defaultModel?.modelName) {
    return {
      providerKey: String(defaultModel.providerKey).toLowerCase(),
      modelName: defaultModel.modelName,
    };
  }

  return DEFAULT_SETTINGS.defaultModel;
}
