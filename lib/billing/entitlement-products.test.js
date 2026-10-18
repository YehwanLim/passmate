import { describe, expect, it } from "vitest";

import {
  PRODUCT_QUERY_KEYS,
  PURCHASE_PRODUCTS,
  PURCHASE_PRODUCT_KEYS,
  contentIdsBySettings,
  parsePurchaseProductQuery,
  readPurchaseProductSettings,
  resolveProductForContentId,
  resolveProductForPaymentRecord,
} from "./entitlement-products.js";

const CONTENT_IDS = {
  SINGLE: "6HteWn",
  COMPANY_SINGLE: "cmp001",
  STANDARD: "4SGBV5",
  PREMIUM: "prm001",
};

describe("PURCHASE_PRODUCTS", () => {
  it("defines the tier products with the confirmed credit splits", () => {
    expect(PURCHASE_PRODUCT_KEYS).toEqual(["SINGLE", "COMPANY_SINGLE", "STANDARD", "PREMIUM", "TRIPLE"]);
    expect(PURCHASE_PRODUCTS).toEqual({
      SINGLE: { resumeCredits: 1, companyCredits: 0 },
      COMPANY_SINGLE: { resumeCredits: 0, companyCredits: 1 },
      STANDARD: { resumeCredits: 2, companyCredits: 1 },
      PREMIUM: { resumeCredits: 3, companyCredits: 3 },
      TRIPLE: { resumeCredits: 3, companyCredits: 0 },
    });
    expect(PRODUCT_QUERY_KEYS).toEqual({
      SINGLE: "single", COMPANY_SINGLE: "company", STANDARD: "standard", PREMIUM: "premium", TRIPLE: "triple",
    });
  });
});

describe("parsePurchaseProductQuery", () => {
  it("파라미터가 없으면 구 3회권 경로를 승계한 스탠다드로 본다", () => {
    expect(parsePurchaseProductQuery(undefined)).toBe("STANDARD");
  });

  it("다섯 가지 쿼리 키를 상품 키로 바꾼다", () => {
    expect(parsePurchaseProductQuery("single")).toBe("SINGLE");
    expect(parsePurchaseProductQuery("company")).toBe("COMPANY_SINGLE");
    expect(parsePurchaseProductQuery("standard")).toBe("STANDARD");
    expect(parsePurchaseProductQuery("premium")).toBe("PREMIUM");
    expect(parsePurchaseProductQuery("triple")).toBe("TRIPLE");
  });

  it("모르는 값이면 null 을 준다", () => {
    expect(parsePurchaseProductQuery("quintuple")).toBeNull();
    expect(parsePurchaseProductQuery("SINGLE")).toBeNull();
    expect(parsePurchaseProductQuery("")).toBeNull();
    expect(parsePurchaseProductQuery("__proto__")).toBeNull();
  });
});

describe("resolveProductForContentId", () => {
  it("맵에 등록된 contentId 를 상품으로 되짚는다", () => {
    expect(resolveProductForContentId("4SGBV5", CONTENT_IDS)).toBe("STANDARD");
    expect(resolveProductForContentId("prm001", CONTENT_IDS)).toBe("PREMIUM");
  });

  it("등록되지 않은 contentId 는 상품으로 보지 않는다", () => {
    expect(resolveProductForContentId("nope", CONTENT_IDS)).toBeNull();
    expect(resolveProductForContentId("4SGBV5", {})).toBeNull();
    expect(resolveProductForContentId("4SGBV5")).toBeNull();
  });

  it("빈 문자열·null contentId 는 어떤 상품과도 맞추지 않는다", () => {
    expect(resolveProductForContentId("", { SINGLE: "" })).toBeNull();
    expect(resolveProductForContentId(null, { SINGLE: null })).toBeNull();
  });
});

describe("resolveProductForPaymentRecord", () => {
  it("저장된 product 를 그대로 쓴다", () => {
    expect(resolveProductForPaymentRecord({ product: "PREMIUM" }, {})).toBe("PREMIUM");
    expect(resolveProductForPaymentRecord({ product: "TRIPLE" }, {})).toBe("TRIPLE");
  });

  it("product 가 없던 옛 기록은 contentId 로 되짚는다", () => {
    expect(resolveProductForPaymentRecord({ contentId: "6HteWn" }, CONTENT_IDS)).toBe("SINGLE");
  });

  it("모르는 상품이면 지어내지 않고 null 을 준다", () => {
    expect(resolveProductForPaymentRecord({ product: "GOLD", contentId: "x" }, CONTENT_IDS)).toBeNull();
    expect(resolveProductForPaymentRecord(null, CONTENT_IDS)).toBeNull();
  });
});

describe("readPurchaseProductSettings", () => {
  function db(rows) {
    return { purchaseProductSetting: { findMany: async () => rows } };
  }
  const ENV = { GROBLE_PREMIUM_CONTENT_ID: "4SGBV5", GROBLE_SINGLE_CONTENT_ID: "6HteWn" };

  it("returns every product, filling legacy env content ids only where no row has one", async () => {
    const settings = await readPurchaseProductSettings(
      db([
        { product: "STANDARD", grobleContentId: null, paymentUrl: "https://groble.im/t", active: true },
        { product: "COMPANY_SINGLE", grobleContentId: "cmp001", paymentUrl: "", active: false },
      ]),
      ENV,
    );

    expect(Object.keys(settings)).toEqual(PURCHASE_PRODUCT_KEYS);
    expect(settings.SINGLE).toEqual({ contentId: "6HteWn", paymentUrl: "", active: false });
    // 전환 전: 구 3회권 contentId 는 env 를 통해 TRIPLE(자소서 3) 에 대응한다 — 초과 지급은 있어도 부족 지급은 없다.
    expect(settings.TRIPLE).toEqual({ contentId: "4SGBV5", paymentUrl: "", active: false });
    expect(settings.STANDARD).toEqual({ contentId: null, paymentUrl: "https://groble.im/t", active: true });
    expect(settings.COMPANY_SINGLE).toEqual({ contentId: "cmp001", paymentUrl: "", active: false });
    expect(settings.PREMIUM).toEqual({ contentId: null, paymentUrl: "", active: false });
  });

  it("drops the env fallback once a DB row already uses that content id (cutover)", async () => {
    const settings = await readPurchaseProductSettings(
      db([{ product: "STANDARD", grobleContentId: "4SGBV5", paymentUrl: "https://groble.im/t", active: true }]),
      ENV,
    );
    expect(settings.STANDARD.contentId).toBe("4SGBV5");
    expect(settings.TRIPLE.contentId).toBeNull();
    expect(contentIdsBySettings(settings)).toEqual({ SINGLE: "6HteWn", STANDARD: "4SGBV5" });
  });

  it("treats a blank DB content id as unset so the env fallback still applies", async () => {
    const settings = await readPurchaseProductSettings(
      db([{ product: "SINGLE", grobleContentId: "", paymentUrl: "https://groble.im/s", active: true }]),
      ENV,
    );
    expect(settings.SINGLE).toEqual({ contentId: "6HteWn", paymentUrl: "https://groble.im/s", active: true });
  });

  it("works without any env at all", async () => {
    const settings = await readPurchaseProductSettings(db([]), {});
    expect(contentIdsBySettings(settings)).toEqual({});
  });
});
