import { ApiError } from "./api-handler.js";
import { recordAuditEvent } from "./audit-log.js";

export const ANALYSIS_MODEL_TIMEOUT_MS = 100000;
export const ANALYSIS_REQUEST_TTL_MS = 125000;

export class AnalysisModelFailureError extends Error {
  constructor(code) {
    super(code);
    this.name = "AnalysisModelFailureError";
    this.code = code;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function modelMetadata(value) {
  const meta = isRecord(value) ? value : {};
  const usage = isRecord(meta.tokenUsage) ? meta.tokenUsage : {};
  const number = (candidate) => Number.isFinite(Number(candidate)) ? Number(candidate) : null;
  return {
    modelName: typeof meta.modelName === "string" && meta.modelName.length > 0 ? meta.modelName : null,
    modelProvider: typeof meta.modelProvider === "string" && meta.modelProvider.length > 0 ? meta.modelProvider : null,
    responseTimeMs: number(meta.responseTimeMs),
    httpStatus: number(meta.httpStatus),
    tokenUsage: {
      promptTokens: number(usage.promptTokens) ?? 0,
      completionTokens: number(usage.completionTokens) ?? 0,
      totalTokens: number(usage.totalTokens) ?? 0,
    },
  };
}

function classifyFailure(error) {
  if (error?.name === "AbortError") return { code: "TIMEOUT", statusCode: 504 };
  if (error?.code === "PARSE_ERROR") return { code: "PARSE_ERROR", statusCode: 500 };
  if (error?.code === "CONTEXT_IRRELEVANT") return { code: "CONTEXT_IRRELEVANT", statusCode: 400 };
  return { code: "API_ERROR", statusCode: 500 };
}

export const ANALYSIS_REQUEST_SELECT = {
  requestHash: true,
  status: true,
  expiresAt: true,
  id: true,
  reservationId: true,
  analysisId: true,
  idempotencyKey: true,
  providerMetadata: true,
  providerResult: true,
  analysis: { select: { id: true, projectId: true, aiResponseJson: true } },
};

export function analysisReceipt({ analysisId, analysisRequestId, projectId, requestId, status }) {
  return {
    analysis_id: analysisId,
    analysis_request_id: analysisRequestId,
    project_id: projectId,
    requestId,
    status,
  };
}

export function idempotencyResult(existing, hash) {
  if (!existing) return null;
  if (existing.requestHash !== hash) throw new ApiError("IDEMPOTENCY_KEY_REUSED", 409);
  if (existing.status === "FAILED") throw new ApiError("ANALYSIS_RETRY_WITH_NEW_KEY", 409);
  if (["PENDING", "CALLING", "SUCCEEDED"].includes(existing.status) && existing.analysis) {
    return {
      analysisId: existing.analysis.id,
      analysisRequestId: existing.id,
      projectId: existing.analysis.projectId,
      status: existing.status,
    };
  }
  throw new ApiError("ANALYSIS_RETRY_WITH_NEW_KEY", 409);
}

export async function findExistingRequest(tx, userId, idempotencyKey) {
  return tx.analysisRequest.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    select: ANALYSIS_REQUEST_SELECT,
  });
}

export async function findUnfinishedRequest(tx, userId, hash) {
  if (!tx.analysisRequest?.findFirst) return null;
  return tx.analysisRequest.findFirst({
    where: {
      userId,
      requestHash: hash,
      status: { in: ["PENDING", "CALLING", "PERSISTENCE_PENDING"] },
    },
    orderBy: { createdAt: "asc" },
    select: ANALYSIS_REQUEST_SELECT,
  });
}

function isExpiredPendingRequest(existing, now = new Date()) {
  if (existing?.status !== "PENDING" || !existing.expiresAt) return false;
  const expiry = new Date(existing.expiresAt);
  return Number.isFinite(expiry.getTime()) && expiry.getTime() <= now.getTime();
}

export async function expirePendingRequest({ db, existing, requestId, userId }) {
  if (!isExpiredPendingRequest(existing)) return existing;

  return db.$transaction(async (tx) => {
    const current = await findExistingRequest(tx, userId, existing.idempotencyKey);
    if (!isExpiredPendingRequest(current)) return current;
    const now = new Date();
    const claimed = await tx.analysisRequest.updateMany({
      where: { id: current.id, status: "PENDING", expiresAt: { lte: now } },
      data: { status: "FAILED" },
    });
    if (claimed.count !== 1) return findExistingRequest(tx, userId, existing.idempotencyKey);

    if (current.analysisId) {
      await tx.analysis.updateMany({
        where: { id: current.analysisId, status: "PENDING", userId },
        data: { status: "FAILED", errorCode: "API_ERROR", errorMessage: null },
      });
    }
    if (current.reservationId) {
      await tx.analysisReservation.updateMany({
        where: { id: current.reservationId, status: "PENDING", userId },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
    }
    await recordAuditEvent({
      actorId: userId,
      db: tx,
      outcome: "EXPIRED",
      requestId,
      targetId: current.analysisId,
      targetType: "analysis",
    });

    return { ...current, status: "FAILED" };
  });
}

export async function expireStaleRequestsForUser({ db, requestId, userId }) {
  if (!db.analysisRequest?.findMany) return;
  const expired = await db.analysisRequest.findMany({
    where: { userId, status: "PENDING", expiresAt: { lte: new Date() } },
    select: ANALYSIS_REQUEST_SELECT,
    take: 20,
  });

  for (const existing of expired) {
    await expirePendingRequest({ db, existing, requestId, userId });
  }
}

async function beginProviderCall({ db, requestId }) {
  const claimed = await db.$transaction((tx) => tx.analysisRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: "CALLING" },
  }));
  if (claimed.count !== 1) throw new ApiError("ANALYSIS_IN_PROGRESS", 409);
}

async function stageProviderResult({ db, metadata, report, requestId }) {
  const claimed = await db.$transaction((tx) => tx.analysisRequest.updateMany({
    where: { id: requestId, status: "CALLING" },
    data: {
      status: "PERSISTENCE_PENDING",
      providerMetadata: metadata,
      providerResult: report,
    },
  }));
  if (claimed.count !== 1) throw new ApiError("ANALYSIS_PERSISTENCE_PENDING", 409);
}

function allocationFromExisting(existing) {
  return {
    analysis: { id: existing.analysisId },
    analysisRequest: { id: existing.id },
    project: { id: existing.analysis?.projectId },
    reservation: { reservationId: existing.reservationId },
  };
}

async function finalizeAnalysis({ db, allocation, finalize, metadata, report, userId }) {
  await db.$transaction(async (tx) => {
    const claimed = await tx.analysisRequest.updateMany({
      where: { id: allocation.analysisRequest.id, status: "PERSISTENCE_PENDING" },
      data: { providerMetadata: null, providerResult: null, status: "SUCCEEDED" },
    });
    if (claimed.count !== 1) throw new AnalysisModelFailureError("API_ERROR");
    await tx.analysis.update({
      where: { id: allocation.analysis.id },
      data: {
        aiResponseJson: report,
        status: "SUCCESS",
        modelName: metadata.modelName,
        modelProvider: metadata.modelProvider,
        responseTime: metadata.responseTimeMs,
      },
    });
    if (metadata.modelName && metadata.modelProvider) {
      await tx.tokenUsage.create({
        data: {
          analysisId: allocation.analysis.id,
          modelName: metadata.modelName,
          modelProvider: metadata.modelProvider,
          promptTokens: metadata.tokenUsage.promptTokens,
          completionTokens: metadata.tokenUsage.completionTokens,
          totalTokens: metadata.tokenUsage.totalTokens,
          cost: null,
          costCurrency: "USD",
          callType: "ANALYSIS",
          latencyMs: metadata.responseTimeMs,
          httpStatus: metadata.httpStatus,
          isSuccess: true,
        },
      });
    }
    await finalize(tx, allocation.reservation.reservationId, userId);
  });
}

async function failAnalysis({ allocation, cancel, db, failure, requestId, userId }) {
  await db.$transaction(async (tx) => {
    const claimed = await tx.analysisRequest.updateMany({
      where: { id: allocation.analysisRequest.id, status: "CALLING" },
      data: { status: "FAILED" },
    });
    if (claimed.count !== 1) return false;
    await tx.analysis.updateMany({
      where: { id: allocation.analysis.id, status: "PENDING", userId },
      data: { status: "FAILED", errorCode: failure.code, errorMessage: null },
    });
    await cancel(tx, allocation.reservation.reservationId, userId);
    await recordAuditEvent({
      actorId: userId,
      db: tx,
      outcome: failure.code,
      requestId,
      targetId: allocation.analysis.id,
      targetType: "analysis",
    });
    return true;
  });
}

export async function failUnstartedAnalysis({ allocation, cancel, db, requestId, userId }) {
  await db.$transaction(async (tx) => {
    const claimed = await tx.analysisRequest.updateMany({
      where: { id: allocation.analysisRequest.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
    if (claimed.count !== 1) return false;
    await tx.analysis.updateMany({
      where: { id: allocation.analysis.id, status: "PENDING", userId },
      data: { status: "FAILED", errorCode: "API_ERROR", errorMessage: null },
    });
    await cancel(tx, allocation.reservation.reservationId, userId);
    await recordAuditEvent({
      actorId: userId,
      db: tx,
      outcome: "API_ERROR",
      requestId,
      targetId: allocation.analysis.id,
      targetType: "analysis",
    });
    return true;
  });
}

export async function recoverStagedRequest({ db, existing, finalize, userId }) {
  if (!existing.analysis || !isRecord(existing.providerResult) || !isRecord(existing.providerMetadata)) {
    return null;
  }
  try {
    await finalizeAnalysis({
      allocation: allocationFromExisting(existing),
      db,
      finalize,
      metadata: modelMetadata(existing.providerMetadata),
      report: existing.providerResult,
      userId,
    });
    return {
      analysisId: existing.analysis.id,
      projectId: existing.analysis.projectId,
      report: existing.providerResult,
    };
  } catch {
    return null;
  }
}

export async function runAllocatedAnalysis({ allocation, cancel, db, finalize, model, request, requestId, userId }) {
  let providerCompleted = false;
  try {
    await beginProviderCall({ db, requestId: allocation.analysisRequest.id });
    const modelResult = await model(request, db);
    if (!isRecord(modelResult)) throw new AnalysisModelFailureError("PARSE_ERROR");
    if (modelResult.error === "CONTEXT_IRRELEVANT") {
      throw new AnalysisModelFailureError("CONTEXT_IRRELEVANT");
    }
    const { analysisMeta, ...report } = modelResult;
    const metadata = modelMetadata(analysisMeta);
    providerCompleted = true;
    await stageProviderResult({ db, metadata, report, requestId: allocation.analysisRequest.id });
    await finalizeAnalysis({ allocation, db, finalize, metadata, report, userId });
  } catch (error) {
    if (providerCompleted) return;
    if (error instanceof ApiError && error.code === "ANALYSIS_IN_PROGRESS") return;
    const failure = classifyFailure(error);
    console.error("[api/analyze] model call failed", {
      code: failure.code,
      providerStatusCode: Number.isInteger(error?.statusCode) ? error.statusCode : null,
      requestId,
    });
    try {
      await failAnalysis({ allocation, cancel, db, failure, requestId, userId });
    } catch {
      // The original model failure remains the only client-visible state.
    }
  }
}
