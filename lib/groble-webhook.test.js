import { createHmac } from "node:crypto";
import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  parseVerifiedGrobleWebhook,
  readGrobleRawBody,
} from "./groble-webhook.js";

const SECRET = "webhook-secret";
const TIMESTAMP = "1785091200";
const NOW = Number(TIMESTAMP) * 1000;

function signedHeaders(rawBody, { secret = SECRET, timestamp = TIMESTAMP } = {}) {
  return {
    "x-groble-signature": createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex"),
    "x-groble-timestamp": timestamp,
  };
}

function parseSigned(rawBody, options = {}) {
  return parseVerifiedGrobleWebhook({
    headers: signedHeaders(rawBody, options),
    now: options.now ?? NOW,
    rawBody,
    secret: options.secret ?? SECRET,
  });
}

function getThrownError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }

  throw new Error("Expected callback to throw");
}

describe("Groble signed webhook parsing", () => {
  it("parses a valid signature over the exact raw body", () => {
    const rawBody = '{"type":"payment.completed","data":{"object":{}}}';

    expect(parseSigned(rawBody)).toEqual({
      data: { object: {} },
      type: "payment.completed",
    });
  });

  it("rejects an altered signature before parsing the payload", () => {
    const rawBody = '{"type":"payment.completed","data":{"object":{}}}';
    const headers = signedHeaders(rawBody);
    headers["x-groble-signature"] = "0".repeat(64);

    expect(getThrownError(() => parseVerifiedGrobleWebhook({
      headers,
      now: NOW,
      rawBody,
      secret: SECRET,
    }))).toMatchObject({
      code: "GROBLE_WEBHOOK_SIGNATURE_INVALID",
      statusCode: 401,
    });
  });

  it("rejects a signature with a timestamp older than five minutes", () => {
    const rawBody = '{"type":"payment.completed","data":{"object":{}}}';

    expect(getThrownError(() => parseSigned(rawBody, { now: NOW + 300_001 }))).toMatchObject({
      code: "GROBLE_WEBHOOK_TIMESTAMP_INVALID",
      statusCode: 401,
    });
  });

  it("rejects a delivery when the webhook secret is not configured", () => {
    const rawBody = '{"type":"payment.completed","data":{"object":{}}}';

    expect(getThrownError(() => parseSigned(rawBody, { secret: "" }))).toMatchObject({
      code: "GROBLE_WEBHOOK_NOT_CONFIGURED",
      statusCode: 500,
    });
  });

  it("rejects malformed JSON after the signature has been verified", () => {
    const rawBody = '{"type":"payment.completed"';

    expect(getThrownError(() => parseSigned(rawBody))).toMatchObject({
      code: "MALFORMED_GROBLE_PAYLOAD",
      statusCode: 400,
    });
  });

  it("preserves whitespace from the request stream for signature verification", async () => {
    const rawBody = '{"type":"payment.completed", "data": {"object": {}}}';
    const request = Readable.from([Buffer.from(rawBody)]);
    const deliveredBody = await readGrobleRawBody(request);

    expect(deliveredBody).toBe(rawBody);
    expect(parseSigned(deliveredBody)).toEqual({
      data: { object: {} },
      type: "payment.completed",
    });
    expect(getThrownError(() => parseVerifiedGrobleWebhook({
      headers: signedHeaders(deliveredBody),
      now: NOW,
      rawBody: JSON.stringify(JSON.parse(deliveredBody)),
      secret: SECRET,
    }))).toMatchObject({
      code: "GROBLE_WEBHOOK_SIGNATURE_INVALID",
      statusCode: 401,
    });
  });
});
