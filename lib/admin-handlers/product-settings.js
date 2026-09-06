import { requireAdministrator } from "../auth.js";
import { PURCHASE_PRODUCTS, PURCHASE_PRODUCT_KEYS, readPurchaseProductSettings } from "../entitlement-products.js";
import prisma from "../prisma.js";
import { handleRequestError, requestIdFor, sendMethodNotAllowed } from "../request-errors.js";

const MAX_CONTENT_ID_LENGTH = 64;
const MAX_PAYMENT_URL_LENGTH = 500;

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * PATCH 본문 → upsert 데이터. 최소 한 필드가 있어야 하고, 각 필드는 타입·형식·길이를 검사한다.
 * contentId 는 null 로 지울 수 있고, paymentUrl 은 "" 로 지운다. 무효면 null.
 */
function parsePatchBody(body) {
  if (body === null || typeof body !== "object" || !PURCHASE_PRODUCT_KEYS.includes(body.product)) {
    return null;
  }

  const data = {};
  if ("contentId" in body) {
    if (body.contentId === null) {
      data.grobleContentId = null;
    } else if (typeof body.contentId === "string") {
      const trimmed = body.contentId.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_CONTENT_ID_LENGTH) return null;
      data.grobleContentId = trimmed;
    } else {
      return null;
    }
  }
  if ("paymentUrl" in body) {
    if (typeof body.paymentUrl !== "string") return null;
    const trimmed = body.paymentUrl.trim();
    if (trimmed.length > MAX_PAYMENT_URL_LENGTH || (trimmed.length > 0 && !isHttpUrl(trimmed))) return null;
    data.paymentUrl = trimmed;
  }
  if ("active" in body) {
    if (typeof body.active !== "boolean") return null;
    data.active = body.active;
  }

  return Object.keys(data).length === 0 ? null : { product: body.product, data };
}

async function listProducts() {
  const settings = await readPurchaseProductSettings(prisma);
  return {
    products: PURCHASE_PRODUCT_KEYS.map((product) => ({ product, ...settings[product], ...PURCHASE_PRODUCTS[product] })),
  };
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);

  try {
    await requireAdministrator(req, prisma);

    if (req.method === "GET") {
      return res.status(200).json(await listProducts());
    }

    if (req.method === "PATCH") {
      const patch = parsePatchBody(req.body);
      if (!patch) {
        return res.status(400).json({ error: "INVALID_PRODUCT_SETTING" });
      }

      try {
        await prisma.purchaseProductSetting.upsert({
          where: { product: patch.product },
          create: { product: patch.product, ...patch.data },
          update: patch.data,
        });
      } catch (error) {
        if (error?.code === "P2002") {
          return res.status(409).json({ error: "DUPLICATE_CONTENT_ID" });
        }
        throw error;
      }

      return res.status(200).json(await listProducts());
    }

    return sendMethodNotAllowed(res, requestId);
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/product-settings");
  }
}
