import { createHmac, timingSafeEqual } from "node:crypto";

export const GROBLE_WEBHOOK_MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

export class GrobleWebhookError extends Error {
  constructor(code, statusCode) {
    super(code);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function getSingleHeader(headers, name) {
  if (!headers || typeof headers !== "object") {
    return undefined;
  }

  const matchedName = Object.keys(headers).find((key) => key.toLowerCase() === name);
  const value = matchedName ? headers[matchedName] : undefined;

  return typeof value === "string" ? value : undefined;
}

function isUnixTimestamp(timestamp) {
  if (typeof timestamp !== "string" || !/^\d+$/.test(timestamp)) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  return Number.isSafeInteger(timestampSeconds) && timestampSeconds > 0;
}

function parseObjectJson(rawBody) {
  if (typeof rawBody !== "string") {
    throw new GrobleWebhookError("MALFORMED_GROBLE_PAYLOAD", 400);
  }

  try {
    const body = JSON.parse(rawBody);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new GrobleWebhookError("MALFORMED_GROBLE_PAYLOAD", 400);
    }

    return body;
  } catch (error) {
    if (error instanceof GrobleWebhookError) {
      throw error;
    }

    throw new GrobleWebhookError("MALFORMED_GROBLE_PAYLOAD", 400);
  }
}

function assertTimingSafeSignature({ rawBody, secret, signature, timestamp }) {
  if (typeof signature !== "string" || !/^[a-f\d]{64}$/i.test(signature)) {
    throw new GrobleWebhookError("GROBLE_WEBHOOK_SIGNATURE_INVALID", 401);
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  const receivedBuffer = Buffer.from(signature.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new GrobleWebhookError("GROBLE_WEBHOOK_SIGNATURE_INVALID", 401);
  }
}

export function parseVerifiedGrobleWebhook({ headers, now = Date.now(), rawBody, secret }) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new GrobleWebhookError("GROBLE_WEBHOOK_NOT_CONFIGURED", 500);
  }

  const timestamp = getSingleHeader(headers, "x-groble-timestamp");
  const signature = getSingleHeader(headers, "x-groble-signature");
  if (!isUnixTimestamp(timestamp) || typeof signature !== "string") {
    throw new GrobleWebhookError("GROBLE_WEBHOOK_SIGNATURE_INVALID", 401);
  }

  if (Math.abs(now - Number(timestamp) * 1000) > GROBLE_WEBHOOK_MAX_TIMESTAMP_SKEW_MS) {
    throw new GrobleWebhookError("GROBLE_WEBHOOK_TIMESTAMP_INVALID", 401);
  }

  assertTimingSafeSignature({ rawBody, secret, signature, timestamp });
  return parseObjectJson(rawBody);
}

export async function readGrobleRawBody(req) {
  if (typeof req?.rawBody === "string") {
    return req.rawBody;
  }

  if (Buffer.isBuffer(req?.rawBody)) {
    return req.rawBody.toString("utf8");
  }

  if (!req || typeof req[Symbol.asyncIterator] !== "function") {
    throw new GrobleWebhookError("MALFORMED_GROBLE_PAYLOAD", 400);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}
