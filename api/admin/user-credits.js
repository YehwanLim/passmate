import { requireAdministrator } from "../../lib/admin-auth.js";
import {
  applyCreditCoupon,
  getEntitlementSummaries,
  getEntitlementSummary,
  grantAdminCredits,
} from "../../lib/analysis-entitlements.js";
import prisma from "../../lib/prisma.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COUPON_CONFLICT_CODES = new Set([
  "COUPON_INACTIVE",
  "COUPON_EXPIRED",
  "COUPON_USAGE_LIMIT_REACHED",
  "COUPON_ALREADY_APPLIED",
]);

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function hasOnlyKeys(body, keys) {
  return body && typeof body === "object" && !Array.isArray(body)
    && Object.keys(body).every((key) => keys.includes(key));
}

function queryValue(req, name) {
  if (req.query && Object.hasOwn(req.query, name)) return req.query[name];
  return new URL(req.url ?? "/", "http://localhost").searchParams.get(name);
}

async function findRecipient(userId) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
}

async function requireRecipient(userId, res) {
  const recipient = await findRecipient(userId);
  if (!recipient) {
    res.status(404).json({ error: "User Not Found" });
    return false;
  }
  return true;
}

function validCredits(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10000;
}

export default async function handler(req, res) {
  try {
    const administrator = await requireAdministrator(req, res);
    if (!administrator) return;

    if (req.method === "GET") {
      const userIds = queryValue(req, "userIds");
      const userId = queryValue(req, "userId");
      if (Boolean(userIds) === Boolean(userId)
        || (userIds !== null && typeof userIds === "object")
        || (userId !== null && typeof userId === "object")) {
        return res.status(400).json({ error: "GET requires exactly one of userIds or userId" });
      }

      if (userIds) {
        const ids = userIds.split(",");
        if (ids.length === 0 || ids.some((id) => !isUuid(id))) {
          return res.status(400).json({ error: "userIds must be comma-separated UUIDs" });
        }
        const recipients = await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true },
        });
        const recipientIds = new Set(recipients.map((recipient) => recipient.id));
        if (ids.some((id) => !recipientIds.has(id))) {
          return res.status(404).json({ error: "User Not Found" });
        }
        const summaries = await prisma.$transaction((tx) => getEntitlementSummaries(tx, ids));
        return res.status(200).json({ summaries });
      }

      if (!isUuid(userId)) return res.status(400).json({ error: "userId must be a UUID" });
      if (!await requireRecipient(userId, res)) return;
      const { summary, grants } = await prisma.$transaction(async (tx) => ({
        summary: await getEntitlementSummary(tx, userId),
        grants: await tx.adminCreditGrant.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
      }));
      return res.status(200).json({ summary, grants });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ error: "POST requires a JSON object" });
    }

    if (body.action === "grant") {
      if (!hasOnlyKeys(body, ["action", "userId", "credits", "note"])
        || !isUuid(body.userId) || !validCredits(body.credits)
        || (body.note !== undefined && typeof body.note !== "string")) {
        return res.status(400).json({ error: "Invalid grant payload" });
      }
      if (!await requireRecipient(body.userId, res)) return;
      const note = body.note?.trim().slice(0, 500);
      const summary = await prisma.$transaction((tx) => grantAdminCredits(tx, {
        userId: body.userId,
        credits: body.credits,
        note: note || null,
        grantedByUserId: administrator.id,
      }));
      return res.status(200).json({ summary });
    }

    if (body.action === "applyCoupon") {
      if (!hasOnlyKeys(body, ["action", "userId", "couponId"])
        || !isUuid(body.userId) || !isUuid(body.couponId)) {
        return res.status(400).json({ error: "Invalid coupon payload" });
      }
      if (!await requireRecipient(body.userId, res)) return;
      try {
        const summary = await prisma.$transaction((tx) => applyCreditCoupon(tx, {
          userId: body.userId,
          couponId: body.couponId,
          grantedByUserId: administrator.id,
        }));
        return res.status(200).json({ summary });
      } catch (error) {
        if (COUPON_CONFLICT_CODES.has(error?.code)) {
          return res.status(409).json({ error: error.code });
        }
        throw error;
      }
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (error) {
    console.error("[api/admin/user-credits] error:", error);
    return res.status(500).json({ error: "Unable to process user credit request" });
  }
}
