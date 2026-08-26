import { randomUUID } from "node:crypto";

/**
 * A caller-supplied request ID is echoed back in responses, written to server
 * logs, and persisted on audit events. Accept it only in an opaque token shape
 * so a client cannot shape those records, and fall back to a generated ID.
 */
export const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function readRequestId(req) {
  const supplied = req?.headers?.["x-request-id"] ?? req?.headers?.["X-Request-ID"];
  return typeof supplied === "string" && SAFE_REQUEST_ID.test(supplied)
    ? supplied
    : randomUUID();
}
