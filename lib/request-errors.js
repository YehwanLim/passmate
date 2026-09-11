import { safeDiagnosticCode } from "./api-handler.js";
import { readRequestId } from "./request-id.js";

// 관리자·결제 라우트의 불투명 응답. 코드를 노출하는 api-handler.js 의 sendError 와 달리
// 본문은 항상 "Request failed" 다(tests/api/admin/security-boundary.test.js 가 고정). 진단 코드는 로그에만 남긴다.

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
