import { createHash } from "node:crypto";

import { grantGroblePurchase } from "../../lib/analysis-entitlements.js";
import {
  GrobleWebhookError,
  parseVerifiedGrobleWebhook,
  readGrobleRawBody,
} from "../../lib/groble-webhook.js";
import prisma from "../../lib/prisma.js";

export const config = {
  api: { bodyParser: false },
};

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
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

function createIdentifierDiagnostic(value) {
  if (!isNonEmptyString(value)) {
    return undefined;
  }

  return {
    hash: hashIdentifier(value),
    length: value.length,
  };
}

function getHeaderNames(headers) {
  if (!isRecord(headers)) {
    return [];
  }

  return Object.keys(headers).map((name) => name.toLowerCase()).sort().slice(0, 40);
}

function createSafeDiagnostic({ body, code, event, headers }) {
  const data = isRecord(body?.data) ? body.data : null;
  const dataObject = isRecord(data?.object) ? data.object : null;
  const buyer = isRecord(dataObject?.buyer) ? dataObject.buyer : null;
  const payment = isRecord(dataObject?.payment) ? dataObject.payment : null;

  return {
    code,
    correlationId: createCorrelationId(event),
    eventType: typeof body?.type === "string" ? body.type : undefined,
    eventKeys: isRecord(body) ? Object.keys(body).sort().slice(0, 20) : [],
    dataKeys: data ? Object.keys(data).sort().slice(0, 30) : [],
    dataObjectKeys: dataObject ? Object.keys(dataObject).sort().slice(0, 40) : [],
    buyerKeys: buyer ? Object.keys(buyer).sort().slice(0, 30) : [],
    paymentKeys: payment ? Object.keys(payment).sort().slice(0, 30) : [],
    eventIdHash: createIdentifierDiagnostic(body?.id)?.hash,
    merchantUid: createIdentifierDiagnostic(dataObject?.merchantUid),
    sellerReference: createIdentifierDiagnostic(dataObject?.sellerReference),
    receivedHeaderNames: getHeaderNames(headers),
    paymentIdHash: event ? hashIdentifier(event.providerPaymentId) : undefined,
    purchaseIntentIdHash: event ? hashIdentifier(event.purchaseIntentId) : undefined,
  };
}

function parsePurchasedAt(value) {
  return isNonEmptyString(value) ? value : undefined;
}

export function parseGroblePaidEvent(body, premiumContentId) {
  if (!isRecord(body)) {
    throw new GrobleWebhookError("MALFORMED_GROBLE_PAYLOAD", 400);
  }

  if (body.type !== "payment.completed") {
    throw new GrobleWebhookError("UNSUPPORTED_GROBLE_EVENT", 400);
  }

  const object = body.data?.object;
  if (
    !isRecord(object) ||
    !isNonEmptyString(object.content?.id) ||
    !isNonEmptyString(object.merchantUid) ||
    !isNonEmptyString(object.sellerReference)
  ) {
    throw new GrobleWebhookError("MALFORMED_GROBLE_PAID_EVENT", 400);
  }

  if (!isNonEmptyString(premiumContentId)) {
    throw new GrobleWebhookError("GROBLE_PREMIUM_PRODUCT_NOT_CONFIGURED", 500);
  }

  if (object.content.id !== premiumContentId) {
    throw new GrobleWebhookError("UNEXPECTED_GROBLE_PRODUCT", 422);
  }

  return {
    providerPaymentId: object.merchantUid,
    purchaseIntentId: object.sellerReference,
    rawEvent: {
      contentId: object.content.id,
      eventId: isNonEmptyString(body.id) ? body.id : undefined,
      merchantUid: object.merchantUid,
      purchasedAt: parsePurchasedAt(object.payment?.purchasedAt),
      type: body.type,
    },
  };
}

async function findExistingPayment(tx, providerPaymentId) {
  return tx.paymentEntitlement.findUnique({
    where: { providerPaymentId },
  });
}

export function createGrobleWebhookHandler({
  logger = console.warn,
  now = Date.now,
  premiumContentId = process.env.GROBLE_PREMIUM_CONTENT_ID,
  prismaClient = prisma,
  readRawBody = readGrobleRawBody,
  webhookSecret = process.env.GROBLE_WEBHOOK_SECRET,
} = {}) {
  return async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    let body;
    let event;

    try {
      const rawBody = await readRawBody(req);
      body = parseVerifiedGrobleWebhook({
        headers: req.headers ?? {},
        now: now(),
        rawBody,
        secret: webhookSecret,
      });
      event = parseGroblePaidEvent(body, premiumContentId);

      const grant = await prismaClient.$transaction(async (tx) => {
        const purchaseIntent = await tx.purchaseIntent.findUnique({
          where: { id: event.purchaseIntentId },
          select: { id: true, status: true, userId: true },
        });

        if (!purchaseIntent) {
          throw new GrobleWebhookError("UNLINKED_PURCHASE_INTENT", 422);
        }

        const existingPayment = await findExistingPayment(tx, event.providerPaymentId);
        if (existingPayment) {
          return { credits: 0, granted: false };
        }

        if (purchaseIntent.status !== "PENDING") {
          if (purchaseIntent.status === "PAID") {
            throw new GrobleWebhookError("PURCHASE_INTENT_ALREADY_PAID", 422);
          }

          throw new GrobleWebhookError("INVALID_PURCHASE_INTENT_STATUS", 422);
        }

        const claim = await tx.purchaseIntent.updateMany({
          where: { id: purchaseIntent.id, status: "PENDING" },
          data: { status: "PAID" },
        });

        if (claim.count === 0) {
          const retriedPayment = await findExistingPayment(tx, event.providerPaymentId);
          if (retriedPayment) {
            return { credits: 0, granted: false };
          }

          throw new GrobleWebhookError("PURCHASE_INTENT_ALREADY_PAID", 422);
        }

        return grantGroblePurchase(tx, {
          providerPaymentId: event.providerPaymentId,
          rawEvent: event.rawEvent,
          userId: purchaseIntent.userId,
        });
      });

      return res.status(200).json({ ok: true, grantedCredits: grant.credits });
    } catch (error) {
      if (error instanceof GrobleWebhookError) {
        const diagnostic = createSafeDiagnostic({
          body,
          code: error.code,
          event,
          headers: req.headers,
        });
        logger("[api/webhooks/groble] rejected event", diagnostic);
        return res.status(error.statusCode).json({
          correlationId: diagnostic.correlationId,
          error: error.code,
        });
      }

      const diagnostic = createSafeDiagnostic({
        body,
        code: "GROBLE_WEBHOOK_PROCESSING_FAILED",
        event,
        headers: req.headers,
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
