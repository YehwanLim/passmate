import { readRequestId } from "./request-id.js";

export function requestIdFor(req) {
  return readRequestId(req);
}

export function sendRequestError(res, statusCode, requestId) {
  return res.status(statusCode).json({
    error: "Request failed",
    requestId,
  });
}

export function sendMethodNotAllowed(res, requestId) {
  return sendRequestError(res, 405, requestId);
}

function safeDiagnosticCode(error) {
  if (typeof error?.code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)) {
    return error.code;
  }
  if (typeof error?.name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name)) {
    return error.name;
  }
  return "INTERNAL_ERROR";
}

export function handleRequestError(res, error, requestId, route) {
  const statusCode = Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode <= 599
    ? error.statusCode
    : 500;
  console.error(`[${route}] request failed`, {
    code: safeDiagnosticCode(error),
    requestId,
    statusCode,
  });
  return sendRequestError(res, statusCode, requestId);
}
