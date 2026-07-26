import { requireAdministrator } from "../../lib/admin-auth.js";
import prisma from "../../lib/prisma.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[A-Z0-9_-]{3,64}$/;

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
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

function hasOnlyKeys(body, keys) {
  return body && typeof body === "object" && !Array.isArray(body)
    && Object.keys(body).every((key) => keys.includes(key));
}

export default async function handler(req, res) {
  try {
    const administrator = await requireAdministrator(req, res);
    if (!administrator) return;

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
      const data = {};
      if (body.creditsGranted !== undefined) data.creditsGranted = body.creditsGranted;
      if (body.isActive !== undefined) data.isActive = body.isActive;
      if (body.maxUses !== undefined) data.maxUses = body.maxUses;
      if (body.expiresAt !== undefined) data.expiresAt = expiresAt.value;
      const updated = await prisma.creditCoupon.update({ where: { id: body.id }, data });
      return res.status(200).json({ coupon: updated });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    console.error("[api/admin/credit-coupons] error:", error);
    return res.status(500).json({ error: "Unable to process credit coupon request" });
  }
}
