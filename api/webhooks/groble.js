import { createHash } from "node:crypto";

import { grantGroblePurchase } from "../../lib/analysis-entitlements.js";
import prisma from "../../lib/prisma.js";

class GrobleWebhookError extends Error {
  constructor(code, statusCode) {
    super(code);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hashIdentifier(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function createCorrelationId(event) {
  if (!event) {
    return "unrecognized";
  }

  return hashIdentifier(`${event.providerPaymentId}:${event.purchaseIntentId}`);
}

function createSafeDiagnostic({ body, code, event }) {
  return {
    code,
    correlationId: createCorrelationId(event),
    eventKeys: isRecord(body) ? Object.keys(body).sort().slice(0, 20) : [],
    paymentIdHash: event ? hashIdentifier(event.providerPaymentId) : undefined,
    purchaseIntentIdHash: event ? hashIdentifier(event.purchaseIntentId) : undefined,
  };
}

function hasRequiredIdentifiers(event) {
  return (
    isRecord(event) &&
    typeof event.providerPaymentId === "string" &&
    event.providerPaymentId.length > 0 &&
    typeof event.purchaseIntentId === "string" &&
    event.purchaseIntentId.length > 0
  );
}

/**
 * This is intentionally the only Groble-specific boundary. Groble's test
 * payload and signature contract have not been observed yet, so accepting
 * likely-looking field names here would create an unauthenticated grant path.
 * Replace the null return only after recording the provider's exact event,
 * identifier, and signature semantics in tests.
 */
export async function parseGroblePaidEvent(body, headers) {
  if (!isRecord(body)) {
    throw new GrobleWebhookError("MALFORMED_GROBLE_PAYLOAD", 400);
  }

  void headers;
  return null;
}

export function createGrobleWebhookHandler({
  logger = console.warn,
  parsePaidEvent = parseGroblePaidEvent,
  prismaClient = prisma,
} = {}) {
  return async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    let event;

    try {
      event = await parsePaidEvent(req.body, req.headers ?? {});

      if (event === null) {
        logger(
          "[api/webhooks/groble] ignored event",
          createSafeDiagnostic({ body: req.body, code: "UNRECOGNIZED_GROBLE_EVENT" }),
        );
        return res.status(204).end();
      }

      if (!hasRequiredIdentifiers(event)) {
        throw new GrobleWebhookError("MALFORMED_GROBLE_PAID_EVENT", 400);
      }

      const grant = await prismaClient.$transaction(async (tx) => {
        const purchaseIntent = await tx.purchaseIntent.findUnique({
          where: { id: event.purchaseIntentId },
          select: { id: true, status: true, userId: true },
        });

        if (!purchaseIntent) {
          throw new GrobleWebhookError("UNLINKED_PURCHASE_INTENT", 422);
        }

        if (purchaseIntent.status !== "PENDING" && purchaseIntent.status !== "PAID") {
          throw new GrobleWebhookError("INVALID_PURCHASE_INTENT_STATUS", 422);
        }

        const result = await grantGroblePurchase(tx, {
          providerPaymentId: event.providerPaymentId,
          rawEvent: event.rawEvent,
          userId: purchaseIntent.userId,
        });

        if (purchaseIntent.status === "PAID" && result.granted) {
          throw new GrobleWebhookError("PURCHASE_INTENT_ALREADY_PAID", 422);
        }

        await tx.purchaseIntent.update({
          where: { id: purchaseIntent.id },
          data: { status: "PAID" },
        });

        return result;
      });

      return res.status(200).json({ ok: true, grantedCredits: grant.credits });
    } catch (error) {
      if (error instanceof GrobleWebhookError) {
        const diagnostic = createSafeDiagnostic({
          body: req.body,
          code: error.code,
          event,
        });
        logger("[api/webhooks/groble] rejected event", diagnostic);
        return res.status(error.statusCode).json({
          correlationId: diagnostic.correlationId,
          error: error.code,
        });
      }

      const diagnostic = createSafeDiagnostic({
        body: req.body,
        code: "GROBLE_WEBHOOK_PROCESSING_FAILED",
        event,
      });
      logger("[api/webhooks/groble] processing failed", diagnostic);
      return res.status(500).json({
        correlationId: diagnostic.correlationId,
        error: "Unable to process Groble webhook",
      });
    }
  };
}

export default createGrobleWebhookHandler();
