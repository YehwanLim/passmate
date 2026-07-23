import { getEntitlementSummary } from "../lib/analysis-entitlements.js";
import { requireAuthenticatedUser } from "../lib/auth.js";
import prisma from "../lib/prisma.js";

function isEntitlementsPath(url) {
  const pathname = new URL(url ?? "/", "http://localhost").pathname;
  return pathname === "/" || pathname === "/api/entitlements";
}

async function getAuthenticatedUser(req, res) {
  const user = await requireAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return user;
}

async function getEntitlements(res, user) {
  const summary = await prisma.$transaction((tx) => getEntitlementSummary(tx, user.id));
  return res.status(200).json({
    ...summary,
    groblePaymentUrl: null,
  });
}

export default async function handler(req, res) {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    if (req.method === "GET" && isEntitlementsPath(req.url)) {
      return getEntitlements(res, user);
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    console.error("[api/entitlements] error:", error);
    return res.status(500).json({ error: "Unable to process entitlement request" });
  }
}
