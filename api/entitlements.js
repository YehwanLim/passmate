import { getEntitlementSummary } from "../lib/analysis-entitlements.js";
import { requireAuthenticatedUser } from "../lib/auth.js";
import prisma from "../lib/prisma.js";

const SETTINGS_ID = "singleton";

function isPurchaseIntentPath(url) {
  const pathname = new URL(url ?? "/", "http://localhost").pathname;
  return pathname === "/purchase-intents" || pathname === "/api/entitlements/purchase-intents";
}

async function getAuthenticatedUser(req, res) {
  const user = await requireAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return user;
}

async function getEntitlements(req, res, user) {
  const [summary, settings] = await Promise.all([
    prisma.$transaction((tx) => getEntitlementSummary(tx, user.id)),
    prisma.entitlementSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { groblePaymentUrl: true },
    }),
  ]);

  return res.status(200).json({
    ...summary,
    groblePaymentUrl: settings?.groblePaymentUrl ?? null,
  });
}

async function createPurchaseIntent(req, res, user) {
  const settings = await prisma.entitlementSetting.findUnique({
    where: { id: SETTINGS_ID },
    select: { groblePaymentUrl: true },
  });

  if (!settings?.groblePaymentUrl) {
    return res.status(503).json({ error: "Purchases are not configured" });
  }

  const purchaseIntent = await prisma.purchaseIntent.create({
    data: {
      status: "PENDING",
      userId: user.id,
    },
  });

  return res.status(201).json({
    purchaseIntentId: purchaseIntent.id,
    checkoutUrl: settings.groblePaymentUrl,
  });
}

export default async function handler(req, res) {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    if (req.method === "GET" && !isPurchaseIntentPath(req.url)) {
      return getEntitlements(req, res, user);
    }

    if (req.method === "POST" && isPurchaseIntentPath(req.url)) {
      return createPurchaseIntent(req, res, user);
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    console.error("[api/entitlements] error:", error);
    return res.status(500).json({ error: "Unable to process entitlement request" });
  }
}
