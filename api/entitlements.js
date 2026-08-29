import { getEntitlementSummary } from "../lib/analysis-entitlements.js";
import { requireAuthenticatedUser } from "../lib/auth.js";
import grobleWebhookHandler from "../lib/groble-webhook-handler.js";
import prisma from "../lib/prisma.js";

// Groble 웹훅은 HMAC 서명을 원문(raw body)으로 검증하므로 파싱을 끈다.
// 이 함수의 나머지 경로(GET 요약, 구매 의도 생성)는 요청 본문을 읽지 않는다.
export const config = {
  api: { bodyParser: false },
};

const SETTINGS_ID = "singleton";

function pathnameOf(req) {
  return new URL(req.url ?? "/", "http://localhost").pathname;
}

function isEntitlementsPath(req) {
  const pathname = pathnameOf(req);
  return pathname === "/" || pathname === "/api/entitlements";
}

function isPurchaseIntentPath(req) {
  if (req.query?.purchaseIntent === "1") {
    return true;
  }
  const pathname = pathnameOf(req);
  return pathname === "/purchase-intents" || pathname === "/api/entitlements/purchase-intents";
}

function isGrobleWebhookPath(req) {
  if (req.query?.grobleWebhook === "1") {
    return true;
  }
  return pathnameOf(req) === "/api/webhooks/groble";
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
  const [summary, settings] = await Promise.all([
    prisma.$transaction((tx) => getEntitlementSummary(tx, user.id)),
    prisma.entitlementSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { groblePaymentUrl: true, premiumEnabled: true },
    }),
  ]);

  return res.status(200).json({
    ...summary,
    groblePaymentUrl:
      settings?.premiumEnabled && settings.groblePaymentUrl ? settings.groblePaymentUrl : null,
  });
}

async function createPurchaseIntent(res, user) {
  const settings = await prisma.entitlementSetting.findUnique({
    where: { id: SETTINGS_ID },
    select: { groblePaymentUrl: true, premiumEnabled: true },
  });

  if (!settings?.premiumEnabled) {
    return res.status(403).json({ error: "PREMIUM_SALES_DISABLED" });
  }

  if (!settings.groblePaymentUrl) {
    return res.status(503).json({ error: "PREMIUM_CHECKOUT_NOT_CONFIGURED" });
  }

  const purchaseIntent = await prisma.purchaseIntent.create({
    data: {
      status: "PENDING",
      userId: user.id,
    },
  });
  const checkoutUrl = new URL(settings.groblePaymentUrl);
  checkoutUrl.searchParams.set("ref", purchaseIntent.id);

  return res.status(201).json({
    purchaseIntentId: purchaseIntent.id,
    checkoutUrl: checkoutUrl.toString(),
  });
}

export default async function handler(req, res) {
  try {
    // 웹훅은 Groble 서버가 호출하므로 사용자 인증 대신 HMAC 서명으로 검증한다.
    if (isGrobleWebhookPath(req)) {
      return await grobleWebhookHandler(req, res);
    }

    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    if (req.method === "GET" && isEntitlementsPath(req)) {
      return getEntitlements(res, user);
    }

    if (req.method === "POST" && isPurchaseIntentPath(req)) {
      return createPurchaseIntent(res, user);
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    console.error("[api/entitlements] error:", error);
    return res.status(500).json({ error: "Unable to process entitlement request" });
  }
}
