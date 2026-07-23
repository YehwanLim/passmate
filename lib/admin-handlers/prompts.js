import { requireAdministrator } from "../auth.js";
import prisma from "../prisma.js";
import { handleRequestError, requestIdFor, sendMethodNotAllowed, sendRequestError } from "../request-errors.js";

const PROMPT_TYPES = new Set(["resume-analysis", "cover-letter", "summary", "feedback", "interview-questions"]);
const MODEL_PROVIDERS = new Set(["gemini", "openai"]);

function mapPrompt(row) {
  return {
    id: row.id, prompt_type: row.promptType, version: row.version, name: row.name, variant: row.variant ?? null,
    system_prompt: row.systemPrompt, user_template: row.userTemplate ?? null, model_name: row.modelName,
    model_provider: row.modelProvider, temperature: row.temperature ?? null, max_tokens: row.maxTokens ?? null,
    is_active: row.isActive, is_default: row.isDefault, description: row.description ?? null,
    notes: row.notes ?? null, updated_by: row.updatedBy ?? null, created_at: row.createdAt, updated_at: row.updatedAt,
  };
}

function nextVersion(rows) {
  const latest = rows.map((row) => /^v(\d+)\.(\d+)$/.exec(row.version)).filter(Boolean)
    .map((match) => [Number(match[1]), Number(match[2])]).sort(([aMajor, aMinor], [bMajor, bMinor]) => bMajor - aMajor || bMinor - aMinor)[0];
  return latest ? `v${latest[0]}.${latest[1] + 1}` : "v1.0";
}

function validDraft(body) {
  return Boolean(
    body && PROMPT_TYPES.has(body.type) && typeof body.name === "string" && body.name.trim().length > 0 && body.name.length <= 100 &&
    typeof body.systemPrompt === "string" && body.systemPrompt.length > 0 && body.systemPrompt.length <= 50_000 &&
    (body.userTemplate == null || (typeof body.userTemplate === "string" && body.userTemplate.length <= 50_000)) &&
    typeof body.modelName === "string" && body.modelName.length > 0 && body.modelName.length <= 100 &&
    MODEL_PROVIDERS.has(body.modelProvider) &&
    (body.temperature == null || (Number.isFinite(body.temperature) && body.temperature >= 0 && body.temperature <= 2)) &&
    (body.maxTokens == null || (Number.isInteger(body.maxTokens) && body.maxTokens > 0 && body.maxTokens <= 100_000)),
  );
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    const administrator = await requireAdministrator(req, prisma);
    if (req.method === "GET") {
      const promptType = req.query?.type;
      if (promptType && !PROMPT_TYPES.has(promptType)) return sendRequestError(res, 400, requestId);
      const rows = await prisma.promptTemplate.findMany({
        where: promptType ? { promptType } : {}, orderBy: { createdAt: "desc" }, take: 500,
        select: { id: true, promptType: true, version: true, name: true, variant: true, systemPrompt: true, userTemplate: true, modelName: true, modelProvider: true, temperature: true, maxTokens: true, isActive: true, isDefault: true, description: true, notes: true, updatedBy: true, createdAt: true, updatedAt: true },
      });
      return res.status(200).json({ prompts: rows.map(mapPrompt) });
    }
    if (req.method !== "POST") return sendMethodNotAllowed(res, requestId);
    if (!validDraft(req.body)) return sendRequestError(res, 400, requestId);
    const existing = await prisma.promptTemplate.findMany({ where: { promptType: req.body.type }, select: { version: true }, take: 500 });
    const created = await prisma.promptTemplate.create({
      data: {
        promptType: req.body.type, version: nextVersion(existing), name: req.body.name.trim(), variant: typeof req.body.variant === "string" ? req.body.variant.slice(0, 50) : null,
        systemPrompt: req.body.systemPrompt, userTemplate: req.body.userTemplate ?? null, modelName: req.body.modelName,
        modelProvider: req.body.modelProvider, temperature: req.body.temperature ?? null, maxTokens: req.body.maxTokens ?? null,
        isActive: false, isDefault: Boolean(req.body.isDefault), description: typeof req.body.description === "string" ? req.body.description.slice(0, 5_000) : null,
        notes: typeof req.body.notes === "string" ? req.body.notes.slice(0, 5_000) : null, updatedBy: administrator.applicationUser.id,
      },
    });
    return res.status(201).json({ prompt: mapPrompt(created) });
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/prompts");
  }
}
