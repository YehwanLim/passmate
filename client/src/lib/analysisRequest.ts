const ANALYSIS_REQUEST_STATUSES = new Set([
  "PENDING",
  "CALLING",
  "PERSISTENCE_PENDING",
  "SUCCEEDED",
  "FAILED",
] as const);

const TERMINAL_ERRORS = new Set(["ANALYSIS_FAILED", "CONTEXT_IRRELEVANT"]);

export type AnalysisRequestStatusName = typeof ANALYSIS_REQUEST_STATUSES extends Set<infer Status>
  ? Status
  : never;

export interface AnalysisReceipt {
  analysisRequestId: string;
  analysisId: string;
  projectId: string;
  requestId: string;
  status: AnalysisRequestStatusName;
}

export interface AnalysisRequestStatus {
  analysisId: string | null;
  error: "ANALYSIS_FAILED" | "CONTEXT_IRRELEVANT" | null;
  id: string;
  requestId: string;
  status: AnalysisRequestStatusName;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseStatus(value: unknown): AnalysisRequestStatusName | null {
  return typeof value === "string" && ANALYSIS_REQUEST_STATUSES.has(value as AnalysisRequestStatusName)
    ? value as AnalysisRequestStatusName
    : null;
}

export function parseAnalysisReceipt(value: unknown): AnalysisReceipt {
  if (!isRecord(value)) throw new Error("INVALID_ANALYSIS_RECEIPT");

  const analysisRequestId = requiredString(value.analysis_request_id);
  const analysisId = requiredString(value.analysis_id);
  const projectId = requiredString(value.project_id);
  const requestId = requiredString(value.requestId);
  const status = parseStatus(value.status);
  if (!analysisRequestId || !analysisId || !projectId || !requestId || !status) {
    throw new Error("INVALID_ANALYSIS_RECEIPT");
  }

  return { analysisRequestId, analysisId, projectId, requestId, status };
}

export function parseAnalysisRequestStatus(value: unknown): AnalysisRequestStatus {
  if (!isRecord(value)) throw new Error("INVALID_ANALYSIS_REQUEST_STATUS");

  const id = requiredString(value.id);
  const requestId = requiredString(value.requestId);
  const status = parseStatus(value.status);
  const analysisId = value.analysis_id === null ? null : requiredString(value.analysis_id);
  const error = value.error === null ? null : requiredString(value.error);
  if (
    !id ||
    !requestId ||
    !status ||
    analysisId === null && value.analysis_id !== null ||
    error === null && value.error !== null
  ) {
    throw new Error("INVALID_ANALYSIS_REQUEST_STATUS");
  }
  if (status === "SUCCEEDED" && !analysisId) {
    throw new Error("INVALID_ANALYSIS_REQUEST_STATUS");
  }
  if (status !== "SUCCEEDED" && analysisId !== null) {
    throw new Error("INVALID_ANALYSIS_REQUEST_STATUS");
  }
  if (status === "FAILED") {
    if (!error || !TERMINAL_ERRORS.has(error)) {
      throw new Error("INVALID_ANALYSIS_REQUEST_STATUS");
    }
  } else if (error !== null) {
    throw new Error("INVALID_ANALYSIS_REQUEST_STATUS");
  }

  return {
    analysisId,
    error: error as AnalysisRequestStatus["error"],
    id,
    requestId,
    status,
  };
}

export function analysisPendingPath(requestId: string): string {
  if (!requiredString(requestId)) throw new Error("INVALID_ANALYSIS_REQUEST_ID");
  return `/analysis-pending?requestId=${encodeURIComponent(requestId)}`;
}
