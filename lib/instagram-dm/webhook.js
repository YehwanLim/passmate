// 인스타 웹훅(comments·messages·messaging_postbacks). 12함수 한도 때문에 전용 api 파일 대신
// api/entitlements.js 가 rewrite(/api/webhooks/instagram)로 이 핸들러에 위임한다(bodyParser 꺼짐 → 원문 서명 검증).
import { createHmac, timingSafeEqual } from "node:crypto";

import prisma from "../prisma.js";
import { isRecord } from "../sanitize.js";
import { createDeliveryService } from "./delivery.js";
import { InstagramDmError } from "./errors.js";
import { createGraphClient } from "./graph-client.js";
import { createNotionResourceReader } from "./notion-resources.js";

export function verifyMetaSignature({ rawBody, signature, secret }) {
  if (!secret || typeof rawBody !== "string" || typeof signature !== "string" || !signature.startsWith("sha256=")) {
    return false;
  }
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"));
  const received = Buffer.from(signature.slice("sha256=".length));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function extractEvents(body) {
  if (!isRecord(body) || body.object !== "instagram" || !Array.isArray(body.entry)) return [];
  const events = [];
  for (const entry of body.entry) {
    const accountId = String(entry?.id ?? "");
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      if (change?.field !== "comments" || !isRecord(value)) continue;
      events.push({
        type: "comment",
        accountId,
        comment: { id: value.id, text: value.text ?? "", fromId: value.from?.id, mediaId: value.media?.id },
      });
    }
    for (const messaging of entry?.messaging ?? []) {
      const igsid = messaging?.sender?.id;
      if (!igsid || igsid === accountId || messaging?.message?.is_echo) continue;
      if (isRecord(messaging.postback)) {
        events.push({ type: "follow_check", accountId, igsid, payload: messaging.postback.payload, text: "" });
      } else if (isRecord(messaging.message)) {
        events.push({
          type: "follow_check",
          accountId,
          igsid,
          payload: messaging.message.quick_reply?.payload,
          text: messaging.message.text ?? "",
        });
      }
    }
  }
  return events;
}

async function readRawBody(req) {
  if (typeof req?.rawBody === "string") return req.rawBody;
  if (Buffer.isBuffer(req?.rawBody)) return req.rawBody.toString("utf8");
  if (!req || typeof req[Symbol.asyncIterator] !== "function") return "";
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function headerOf(req, name) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function answerVerification(req, res, verifyToken) {
  const query = req.query ?? {};
  const challenge = query["hub.challenge"];
  if (query["hub.mode"] === "subscribe" && verifyToken && query["hub.verify_token"] === verifyToken && typeof challenge === "string") {
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).end(challenge);
  }
  return res.status(403).json({ error: "INSTAGRAM_WEBHOOK_VERIFY_FAILED" });
}

export function createInstagramWebhookHandler({
  appSecret = process.env.INSTAGRAM_APP_SECRET,
  verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
  enabled = process.env.INSTAGRAM_DM_ENABLED === "1",
  getService,
  logger = console,
} = {}) {
  return async function instagramWebhookHandler(req, res) {
    if (req.method === "GET") return answerVerification(req, res, verifyToken);
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const rawBody = await readRawBody(req);
    if (!verifyMetaSignature({ rawBody, signature: headerOf(req, "x-hub-signature-256"), secret: appSecret })) {
      return res.status(401).json({ error: "INSTAGRAM_WEBHOOK_SIGNATURE_INVALID" });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: "MALFORMED_INSTAGRAM_PAYLOAD" });
    }
    if (!enabled) return res.status(200).json({ received: true, processed: 0 });

    const service = getService();
    const results = [];
    for (const event of extractEvents(body)) {
      try {
        results.push(event.type === "comment" ? await service.handleComment(event) : await service.handleFollowCheck(event));
      } catch (error) {
        const code = error instanceof InstagramDmError ? error.code : "UNEXPECTED";
        if (error instanceof InstagramDmError && !error.transient) {
          logger.warn("[instagram-dm] event failed", { code, type: event.type });
          results.push("failed");
          continue;
        }
        // 메타가 같은 알림을 다시 보내게 한다. 이미 처리한 앞 이벤트는 유니크·상태 검사로 다시 보내지지 않는다.
        logger.error("[instagram-dm] transient failure", { code, type: event.type });
        return res.status(503).json({ error: "INSTAGRAM_DM_RETRY" });
      }
    }
    logger.info("[instagram-dm] processed", { results });
    return res.status(200).json({ received: true, processed: results.length });
  };
}

// 노션 캐시가 따뜻한 인스턴스에서 이어지도록 서비스는 모듈에 한 번만 만든다.
let defaultService;
function getDefaultService() {
  defaultService ??= createDeliveryService({
    db: prisma,
    graph: createGraphClient(),
    resources: createNotionResourceReader(),
  });
  return defaultService;
}

export default createInstagramWebhookHandler({ getService: getDefaultService });
