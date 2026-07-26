import { requireAdministrator } from "../../lib/admin-auth.js";
import {
  applyCreditCoupon,
  getEntitlementSummaries,
  getEntitlementSummary,
  grantAdminCredits,
} from "../../lib/analysis-entitlements.js";
import prisma from "../../lib/prisma.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[A-Z0-9_-]{3,64}$/;
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

function isCredits(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10000;
}

function isMaxUses(value) {
  return Number.isInteger(value) && value > 0;
}

function parseExpiresAt(value) {
  if (value === undefined || value === null) return { valid: true, value: null };
  const match = typeof value === "string" && value.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/);
  const date = new Date(value);
  if (!match || Number.isNaN(date.getTime())) return { valid: false };
  const calendarDate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (calendarDate.getFullYear() !== Number(match[1])
    || calendarDate.getMonth() !== Number(match[2]) - 1
    || calendarDate.getDate() !== Number(match[3])) return { valid: false };
  return { valid: true, value: date };
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

async function handleUserCredits(req, res, administrator) {
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
      || !isUuid(body.userId) || !isCredits(body.credits)
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
      grantedByEmail: administrator.email,
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
        grantedByEmail: administrator.email,
      }));
      return res.status(200).json({ summary });
    } catch (error) {
      if (error?.code === "COUPON_NOT_FOUND") {
        return res.status(404).json({ error: error.code });
      }
      if (COUPON_CONFLICT_CODES.has(error?.code)) {
        return res.status(409).json({ error: error.code });
      }
      throw error;
    }
  }

  return res.status(400).json({ error: "Invalid action" });
}

async function handleCreditCoupons(req, res) {
  if (req.method === "GET") {
    const coupons = await prisma.creditCoupon.findMany({ orderBy: { createdAt: "desc" } });
    return res.status(200).json({ coupons });
  }

  if (req.method === "POST") {
    const body = req.body;
    if (!hasOnlyKeys(body, ["code", "creditsGranted", "maxUses", "expiresAt", "isActive"])) {
      return res.status(400).json({ error: "Invalid coupon payload" });
    }
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const expiresAt = parseExpiresAt(body.expiresAt);
    if (!CODE_PATTERN.test(code) || !isCredits(body.creditsGranted)
      || (body.isActive !== undefined && typeof body.isActive !== "boolean")
      || (body.maxUses !== undefined && body.maxUses !== null && !isMaxUses(body.maxUses))
      || !expiresAt.valid) {
      return res.status(400).json({ error: "Invalid coupon payload" });
    }
    try {
      const coupon = await prisma.creditCoupon.create({
        data: {
          code,
          creditsGranted: body.creditsGranted,
          maxUses: body.maxUses ?? null,
          expiresAt: expiresAt.value,
          isActive: body.isActive ?? true,
        },
      });
      return res.status(201).json({ coupon });
    } catch (error) {
      if (error?.code === "P2002") return res.status(409).json({ error: "COUPON_CODE_EXISTS" });
      throw error;
    }
  }

  if (req.method === "PATCH") {
    const body = req.body;
    if (!hasOnlyKeys(body, ["id", "creditsGranted", "isActive", "maxUses", "expiresAt"]) || !isUuid(body?.id)) {
      return res.status(400).json({ error: "Invalid coupon update payload" });
    }
    const fields = ["creditsGranted", "isActive", "maxUses", "expiresAt"].filter((field) => body[field] !== undefined);
    if (fields.length === 0
      || (body.creditsGranted !== undefined && !isCredits(body.creditsGranted))
      || (body.isActive !== undefined && typeof body.isActive !== "boolean")
      || (body.maxUses !== undefined && body.maxUses !== null && !isMaxUses(body.maxUses))) {
      return res.status(400).json({ error: "Invalid coupon update payload" });
    }
    const expiresAt = parseExpiresAt(body.expiresAt);
    if (!expiresAt.valid) return res.status(400).json({ error: "Invalid coupon update payload" });
    const coupon = await prisma.creditCoupon.findUnique({ where: { id: body.id }, select: { id: true, usedCount: true } });
    if (!coupon) return res.status(404).json({ error: "Coupon Not Found" });
    if (body.creditsGranted !== undefined && coupon.usedCount > 0) {
      return res.status(400).json({ error: "Cannot change credits after coupon use" });
    }
    if (body.maxUses !== undefined && body.maxUses !== null && body.maxUses < coupon.usedCount) {
      return res.status(400).json({ error: "Cannot set max uses below current usage" });
    }
    const data = {};
    if (body.creditsGranted !== undefined) data.creditsGranted = body.creditsGranted;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.maxUses !== undefined) data.maxUses = body.maxUses;
    if (body.expiresAt !== undefined) data.expiresAt = expiresAt.value;
    const where = { id: body.id };
    if (body.creditsGranted !== undefined) {
      where.usedCount = 0;
    } else if (body.maxUses !== undefined && body.maxUses !== null) {
      where.usedCount = { lte: body.maxUses };
    }
    const result = await prisma.creditCoupon.updateMany({ where, data });
    if (result.count === 0) {
      const currentCoupon = await prisma.creditCoupon.findUnique({
        where: { id: body.id },
        select: { id: true, usedCount: true },
      });
      if (!currentCoupon) return res.status(404).json({ error: "Coupon Not Found" });
      if (body.creditsGranted !== undefined && currentCoupon.usedCount > 0) {
        return res.status(400).json({ error: "Cannot change credits after coupon use" });
      }
      if (body.maxUses !== undefined && body.maxUses !== null && body.maxUses < currentCoupon.usedCount) {
        return res.status(400).json({ error: "Cannot set max uses below current usage" });
      }
      return res.status(409).json({ error: "Coupon changed concurrently" });
    }
    const updated = await prisma.creditCoupon.findUnique({ where: { id: body.id } });
    return res.status(200).json({ coupon: updated });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}

export default async function handler(req, res) {
  const creditResource = queryValue(req, "creditResource");

  try {
    const administrator = await requireAdministrator(req, res);
    if (!administrator) return;

    if (creditResource === "user-credits") {
      return await handleUserCredits(req, res, administrator);
    }
    if (creditResource === "credit-coupons") {
      return await handleCreditCoupons(req, res);
    }
    return res.status(404).json({ error: "Credit management route not found" });
  } catch (error) {
    console.error(`[api/admin/credit-management:${creditResource ?? "unknown"}] error:`, error);
    const message = creditResource === "credit-coupons"
      ? "Unable to process credit coupon request"
      : "Unable to process user credit request";
    return res.status(500).json({ error: message });
  }
}
