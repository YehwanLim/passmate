import { AuthorizationError } from "./auth.js";
import { readRequestId } from "./request-id.js";

const SAFE_DIAGNOSTIC_CODE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const SAFE_DATABASE_CODE = /^[0-9A-Z]{5}$/;
const SAFE_DIAGNOSTIC_STAGES = new Set(["analysis_entitlement_lock"]);

export class ApiError extends Error {
  constructor(code, statusCode) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function getRequestId(req) {
  return readRequestId(req);
}

export function sendJson(res, statusCode, body, requestId) {
  return res.status(statusCode).json(body);
}

export function sendError(res, statusCode, code, requestId) {
  return sendJson(res, statusCode, { error: code, requestId }, requestId);
}

function safeDiagnosticCode(error) {
  if (typeof error?.code === "string" && SAFE_DIAGNOSTIC_CODE.test(error.code)) {
    return error.code;
  }
  if (typeof error?.name === "string" && SAFE_DIAGNOSTIC_CODE.test(error.name)) {
    return error.name;
  }
  return "INTERNAL_ERROR";
}

function safeDatabaseCode(error) {
  const code = error?.meta?.code;
  return typeof code === "string" && SAFE_DATABASE_CODE.test(code) ? code : null;
}

function safeDiagnosticStage(error) {
  return SAFE_DIAGNOSTIC_STAGES.has(error?.safeDiagnosticStage)
    ? error.safeDiagnosticStage
    : null;
}

export async function withApiHandler(req, res, work) {
  const requestId = getRequestId(req);
  res.setHeader?.("X-Request-ID", requestId);

  try {
    return await work(requestId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return sendError(res, error.statusCode, error.code, requestId);
    }

    if (error instanceof ApiError) {
      return sendError(res, error.statusCode, error.code, requestId);
    }

    console.error("[api] unexpected request failure", {
      code: safeDiagnosticCode(error),
      databaseCode: safeDatabaseCode(error),
      requestId,
      stage: safeDiagnosticStage(error),
      statusCode: 500,
    });
    return sendError(res, 500, "INTERNAL_ERROR", requestId);
  }
}
