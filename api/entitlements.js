import {
  getEntitlementSummaryReadOnly,
  hasClaimedFeedbackReward,
} from "../lib/analysis-entitlements.js";
import { AuthorizationError, requireActiveApplicationUser } from "../lib/auth.js";
import {
  PRODUCT_QUERY_KEYS,
  PURCHASE_PRODUCTS,
  PURCHASE_PRODUCT_KEYS,
  parsePurchaseProductQuery,
  readPurchaseProductSettings,
} from "../lib/entitlement-products.js";
import grobleWebhookHandler from "../lib/groble-webhook-handler.js";
import prisma from "../lib/prisma.js";
import { handleRequestError, requestIdFor } from "../lib/request-errors.js";

// Groble 웹훅은 HMAC 서명을 원문(raw body)으로 검증하므로 파싱을 끈다.
// 이 함수의 나머지 경로(GET 요약, 구매 의도 생성)는 요청 본문을 읽지 않는다.
export const config = {
  api: { bodyParser: false },
};

const SETTINGS_ID = "singleton";
const SWITCH_SELECT = { premiumEnabled: true, companyAnalysisEnabled: true };

/**
 * 상품 하나의 결제 URL. 전체 판매 스위치 → (기업 크레딧 포함 상품이면) 기업 분석 스위치 →
 * 상품 행의 active 와 URL 순으로 닫힌다. 닫혀 있으면 null.
 */
function checkoutUrlFor(product, productSettings, switches) {
  if (!switches?.premiumEnabled) return null;
  if (PURCHASE_PRODUCTS[product].companyCredits > 0 && !switches.companyAnalysisEnabled) return null;
  const setting = productSettings[product];
  return setting.active && setting.paymentUrl ? setting.paymentUrl : null;
}

function checkoutUrlsFor(productSettings, switches) {
  return Object.fromEntries(
    PURCHASE_PRODUCT_KEYS.map((product) => [PRODUCT_QUERY_KEYS[product], checkoutUrlFor(product, productSettings, switches)]),
  );
}

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
  // 결제·이용권은 활성 계정에만 허용한다. 삭제 유예 중인 계정이
  // 구매 의도를 만들거나 결제 URL을 받는 경로를 차단한다.
  try {
    const { applicationUser } = await requireActiveApplicationUser(req, prisma);
    return applicationUser;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      res.status(error.statusCode).json({ error: error.code });
      return null;
    }
    throw error;
  }
}

async function getEntitlements(res, user) {
  // 표시용 조회라 잠금 트랜잭션 대신 조회 전용 요약을 쓴다 — 왕복이 병렬화되어 빠르다.
  const [summary, switches, productSettings, feedbackRewardClaimed] = await Promise.all([
    getEntitlementSummaryReadOnly(prisma, user.id),
    prisma.entitlementSetting.findUnique({ where: { id: SETTINGS_ID }, select: SWITCH_SELECT }),
    readPurchaseProductSettings(prisma),
    hasClaimedFeedbackReward(prisma, user.id),
  ]);
  const checkoutUrls = checkoutUrlsFor(productSettings, switches);

  return res.status(200).json({
    ...summary,
    // 구버전 클라이언트 호환: 두 필드는 "3회권(→스탠다드)"·"1회권" URL 의미를 유지한다.
    groblePaymentUrl: checkoutUrls.standard,
    grobleSinglePaymentUrl: checkoutUrls.single,
    checkoutUrls,
    feedbackRewardClaimed,
  });
}

// TODO(유료 오픈): premiumEnabled 를 켜기 전에 전자상거래법상 판매자 정보
// (상호·대표자·사업자등록번호·통신판매업신고번호·주소·연락처)를 푸터에 표기해야 한다.
// Groble 이 판매 주체라면 대신 결제 주체 안내와 Groble 판매자 정보 링크를 노출한다.
async function createPurchaseIntent(req, res, user) {
  // bodyParser 가 꺼져 있어(웹훅 원문 검증) 상품 구분은 쿼리스트링으로 받는다.
  const product = parsePurchaseProductQuery(req.query?.product);
  if (!product) {
    return res.status(400).json({ error: "INVALID_PURCHASE_PRODUCT" });
  }

  const [switches, productSettings] = await Promise.all([
    prisma.entitlementSetting.findUnique({ where: { id: SETTINGS_ID }, select: SWITCH_SELECT }),
    readPurchaseProductSettings(prisma),
  ]);

  if (!switches?.premiumEnabled) {
    return res.status(403).json({ error: "PREMIUM_SALES_DISABLED" });
  }

  // 기업 분석 크레딧이 든 상품은 기업 분석 스위치가 켜져야 판다 — 쓸 수 없는 크레딧을 팔지 않는다.
  if (PURCHASE_PRODUCTS[product].companyCredits > 0 && !switches.companyAnalysisEnabled) {
    return res.status(403).json({ error: "COMPANY_SALES_DISABLED" });
  }

  const paymentUrl = checkoutUrlFor(product, productSettings, switches);
  if (!paymentUrl) {
    return res.status(503).json({ error: "PREMIUM_CHECKOUT_NOT_CONFIGURED" });
  }

  const purchaseIntent = await prisma.purchaseIntent.create({
    data: {
      product,
      status: "PENDING",
      userId: user.id,
    },
  });
  const checkoutUrl = new URL(paymentUrl);
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
      return createPurchaseIntent(req, res, user);
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    return handleRequestError(res, error, requestIdFor(req), "api/entitlements");
  }
}
