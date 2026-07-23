import { randomUUID } from "node:crypto";

import { AuthorizationError } from "./auth.js";

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

export class ApiError extends Error {
  constructor(code, statusCode) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function getRequestId(req) {
  const incoming = req?.headers?.["x-request-id"] ?? req?.headers?.["X-Request-ID"];
  if (typeof incoming === "string" && SAFE_REQUEST_ID.test(incoming)) {
    return incoming;
  }

  return randomUUID();
}

export function sendJson(res, statusCode, body, requestId) {
  return res.status(statusCode).json(body);
}

export function sendError(res, statusCode, code, requestId) {
  return sendJson(res, statusCode, { error: code, requestId }, requestId);
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

    return sendError(res, 500, "INTERNAL_ERROR", requestId);
  }
}
