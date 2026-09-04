import { describe, expect, it } from "vitest";
import {
  PRICING,
  TRIPLE_PER_USE_PRICE,
  estimatedAmountFor,
  formatKrw,
  productLabel,
} from "./pricing";

describe("pricing constants", () => {
  it("keeps discount labels arithmetically consistent with list and sale prices", () => {
    // 카피(할인율 배지)와 실제 가격이 어긋나지 않도록 산술 일치를 강제한다.
    const singleDiscount = Math.round(
      (1 - PRICING.single.salePrice / PRICING.single.listPrice) * 100
    );
    const tripleDiscount = Math.round(
      (1 - PRICING.triple.salePrice / PRICING.triple.listPrice) * 100
    );

    expect(singleDiscount).toBe(40);
    expect(PRICING.single.discountLabel).toContain("40%");
    expect(tripleDiscount).toBe(50);
    expect(PRICING.triple.discountLabel).toContain("50%");
  });

  it("keeps the per-use price in sync with the triple plan sale price", () => {
    expect(TRIPLE_PER_USE_PRICE).toBe(
      Math.round(PRICING.triple.salePrice / PRICING.triple.uses)
    );
    // "커피 한 잔 값" 카피의 전제: 회당 5,000원 미만
    expect(TRIPLE_PER_USE_PRICE).toBeLessThan(5000);
  });

  it("keeps the single plan list price aligned with the triple plan per-unit list price", () => {
    expect(PRICING.triple.listPrice).toBe(
      PRICING.single.listPrice * PRICING.triple.uses
    );
  });

  it("formats won amounts with thousands separators", () => {
    expect(formatKrw(5900)).toBe("5,900원");
    expect(formatKrw(14900)).toBe("14,900원");
  });
});

describe("product labels and estimated amounts", () => {
  it("names the server product keys in Korean", () => {
    expect(productLabel("SINGLE")).toBe("1회권");
    expect(productLabel("TRIPLE")).toBe("3회권");
  });

  it("shows a dash when the product could not be identified", () => {
    expect(productLabel(null)).toBe("–");
  });

  it("estimates a past payment amount from the current sale price", () => {
    expect(estimatedAmountFor("SINGLE")).toBe(PRICING.single.salePrice);
    expect(estimatedAmountFor("TRIPLE")).toBe(PRICING.triple.salePrice);
  });

  it("estimates nothing for an unidentified product rather than guessing zero", () => {
    expect(estimatedAmountFor(null)).toBeNull();
  });
});
