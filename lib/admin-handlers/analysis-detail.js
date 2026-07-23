import { requireAdministrator } from "../auth.js";
import prisma from "../prisma.js";
import { handleRequestError, requestIdFor, sendMethodNotAllowed, sendRequestError } from "../request-errors.js";

function mapProjectAnalysis(analysis) {
  return {
    id: analysis.id, status: analysis.status, question_text: analysis.questionText, input_text: analysis.inputText,
    total_chars: analysis.totalChars ?? null, ai_response_json: analysis.aiResponseJson,
    ai_score: analysis.aiScore ?? null, created_at: analysis.createdAt,
  };
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    await requireAdministrator(req, prisma);
    if (req.method !== "GET") return sendMethodNotAllowed(res, requestId);
    const id = String(req.query?.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return sendRequestError(res, 400, requestId);
    const analysis = await prisma.analysis.findUnique({
      where: { id },
      select: {
        id: true, projectId: true, status: true, errorCode: true, errorMessage: true,
        questionText: true, inputText: true, totalChars: true, aiResponseJson: true, aiScore: true,
        modelName: true, modelProvider: true, promptVersion: true, responseTime: true, createdAt: true,
        user: { select: { id: true, email: true, name: true } },
        project: { select: { id: true, title: true, company: true, jobKeyword: true } },
        promptTemplate: { select: { id: true, name: true, version: true, systemPrompt: true, userTemplate: true, temperature: true, maxTokens: true } },
        tokenUsages: { select: { id: true, callType: true, promptTokens: true, completionTokens: true, totalTokens: true, cost: true, latencyMs: true, isSuccess: true } },
      },
    });
    if (!analysis) return sendRequestError(res, 404, requestId);
    const projectAnalyses = await prisma.analysis.findMany({
      where: { projectId: analysis.projectId }, orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, status: true, questionText: true, inputText: true, totalChars: true, aiResponseJson: true, aiScore: true, createdAt: true },
    });
    return res.status(200).json({
      id: analysis.id, project_id: analysis.projectId, status: analysis.status, error_code: analysis.errorCode ?? null,
      error_message: analysis.errorMessage ?? null, question_text: analysis.questionText, input_text: analysis.inputText,
      total_chars: analysis.totalChars ?? null, ai_response_json: analysis.aiResponseJson, ai_score: analysis.aiScore ?? null,
      model_name: analysis.modelName ?? null, model_provider: analysis.modelProvider ?? null,
      prompt_version: analysis.promptVersion, response_time_ms: analysis.responseTime ?? null, created_at: analysis.createdAt,
      user: analysis.user ? { id: analysis.user.id, email: analysis.user.email, name: analysis.user.name ?? null } : null,
      project: analysis.project ? { id: analysis.project.id, title: analysis.project.title, company: analysis.project.company ?? null, job_keyword: analysis.project.jobKeyword ?? null } : null,
      project_analyses: projectAnalyses.map(mapProjectAnalysis),
      prompt_template: analysis.promptTemplate ? {
        id: analysis.promptTemplate.id, name: analysis.promptTemplate.name, version: analysis.promptTemplate.version,
        system_prompt: analysis.promptTemplate.systemPrompt, user_template: analysis.promptTemplate.userTemplate ?? null,
        temperature: analysis.promptTemplate.temperature ?? null, max_tokens: analysis.promptTemplate.maxTokens ?? null,
      } : null,
      token_usages: analysis.tokenUsages.map((usage) => ({
        id: usage.id, call_type: usage.callType, prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens, total_tokens: usage.totalTokens, cost: usage.cost ?? null,
        latency_ms: usage.latencyMs ?? null, is_success: usage.isSuccess,
      })),
    });
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/analyses/[id]");
  }
}
