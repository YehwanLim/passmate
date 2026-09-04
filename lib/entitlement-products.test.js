import { describe, expect, it } from "vitest";

import {
  parsePurchaseProductQuery,
  resolveProductForContentId,
  resolveProductForPaymentRecord,
} from "./entitlement-products.js";

const CONTENT_IDS = { premiumContentId: "4SGBV5", singleContentId: "6HteWn" };

describe("parsePurchaseProductQuery", () => {
  it("파라미터가 없으면 기존 클라이언트 호환을 위해 3회권으로 본다", () => {
    expect(parsePurchaseProductQuery(undefined)).toBe("TRIPLE");
  });

  it("single·triple 을 상품 키로 바꾼다", () => {
    expect(parsePurchaseProductQuery("single")).toBe("SINGLE");
    expect(parsePurchaseProductQuery("triple")).toBe("TRIPLE");
  });

  it("모르는 값이면 null 을 준다", () => {
    expect(parsePurchaseProductQuery("quintuple")).toBeNull();
  });
});

describe("resolveProductForContentId", () => {
  it("프리미엄 contentId 는 3회권이다", () => {
    expect(resolveProductForContentId("4SGBV5", CONTENT_IDS)).toBe("TRIPLE");
  });

  it("1회권 contentId 는 1회권이다", () => {
    expect(resolveProductForContentId("6HteWn", CONTENT_IDS)).toBe("SINGLE");
  });

  it("1회권 contentId 가 설정되지 않았으면 아무 값이나 1회권으로 보지 않는다", () => {
    expect(
      resolveProductForContentId("", { premiumContentId: "4SGBV5", singleContentId: "" })
    ).toBeNull();
  });

  it("등록되지 않은 contentId 는 상품으로 보지 않는다", () => {
    expect(resolveProductForContentId("ZZZZZZ", CONTENT_IDS)).toBeNull();
  });
});

describe("resolveProductForPaymentRecord", () => {
  it("저장된 product 를 그대로 쓴다", () => {
    const rawEvent = { product: "SINGLE", contentId: "4SGBV5" };
    expect(resolveProductForPaymentRecord(rawEvent, CONTENT_IDS)).toBe("SINGLE");
  });

  it("product 가 없던 옛 기록은 contentId 로 되짚는다", () => {
    const rawEvent = { contentId: "4SGBV5" };
    expect(resolveProductForPaymentRecord(rawEvent, CONTENT_IDS)).toBe("TRIPLE");
  });

  it("모르는 상품이면 지어내지 않고 null 을 준다", () => {
    expect(resolveProductForPaymentRecord({ contentId: "ZZZZZZ" }, CONTENT_IDS)).toBeNull();
    expect(resolveProductForPaymentRecord(null, CONTENT_IDS)).toBeNull();
  });

  it("저장된 product 가 아는 상품이 아니면 contentId 로 되짚는다", () => {
    const rawEvent = { product: "DECUPLE", contentId: "6HteWn" };
    expect(resolveProductForPaymentRecord(rawEvent, CONTENT_IDS)).toBe("SINGLE");
  });
});
