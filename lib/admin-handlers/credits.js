import { requireAdministrator } from "../auth.js";
import {
  getEntitlementSummary,
  grantAdminCredits,
} from "../analysis-entitlements.js";
import prisma from "../prisma.js";
import {
  handleRequestError,
  requestIdFor,
  sendMethodNotAllowed,
  sendRequestError,
} from "../request-errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isCredits(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10000;
}

function queryValue(req, name) {
  if (req.query && Object.hasOwn(req.query, name)) return req.query[name];
  return new URL(req.url ?? "/", "http://localhost").searchParams.get(name);
}

function mapGrant(grant) {
  return {
    id: grant.id,
    credits_granted: grant.creditsGranted,
    granted_by_email: grant.grantedByEmail,
    source: grant.source,
    note: grant.note ?? null,
    created_at: grant.createdAt,
  };
}

async function recipientExists(userId) {
  const recipient = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  return Boolean(recipient);
}

/** 관리자 수동 크레딧 지급: 잔여 요약 조회(GET)와 보너스 크레딧 지급(POST). */
export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    const administrator = await requireAdministrator(req, prisma);

    if (req.method === "GET") {
      const userId = queryValue(req, "userId");
      if (!isUuid(userId)) return sendRequestError(res, 400, requestId);
      if (!(await recipientExists(userId))) return sendRequestError(res, 404, requestId);

      const { summary, grants } = await prisma.$transaction(async (tx) => ({
        summary: await getEntitlementSummary(tx, userId),
        grants: await tx.adminCreditGrant.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      }));
      return res.status(200).json({ summary, grants: grants.map(mapGrant) });
    }

    if (req.method !== "POST") return sendMethodNotAllowed(res, requestId);

    const body = req.body;
    if (
      !body || typeof body !== "object" || Array.isArray(body)
      || !isUuid(body.userId)
      || !isCredits(body.credits)
      || (body.note !== undefined && body.note !== null && typeof body.note !== "string")
    ) {
      return sendRequestError(res, 400, requestId);
    }
    if (!(await recipientExists(body.userId))) return sendRequestError(res, 404, requestId);

    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
    const summary = await prisma.$transaction((tx) =>
      grantAdminCredits(tx, {
        userId: body.userId,
        credits: body.credits,
        note: note || null,
        grantedByUserId: administrator.applicationUser.id,
        grantedByEmail: administrator.applicationUser.email,
      }),
    );
    return res.status(200).json({ summary });
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/credits");
  }
}
