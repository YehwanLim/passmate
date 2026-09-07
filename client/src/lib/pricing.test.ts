import { describe, expect, it } from "vitest";
import {
  PRICING,
  PRODUCT_KEY_BY_PRODUCT,
  PURCHASE_PRODUCT_KEYS,
  TIERS,
  TRIPLE_PER_USE_PRICE,
  estimatedAmountFor,
  formatKrw,
  productLabel,
  savingsFor,
  type PurchaseProduct,
  type PurchaseProductKey,
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
    // 단품도 번들과 같은 "N원 절약" 꼴로 — 베이직 카드에서 자소서/기업을 오갈 때 표기가 흔들리지 않는다.
    expect(savingsFor(PRICING.single)).toBe(4_000);
    expect(PRICING.single.discountLabel).toBe("4,000원 절약");
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
    expect(productLabel("SINGLE")).toBe("자소서 진단 1회");
    expect(productLabel("TRIPLE")).toBe("3회권(구)");
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

  it("does not throw for a product string outside the known set", () => {
    const unknown = "MYSTERY" as PurchaseProduct;
    expect(productLabel(unknown)).toBe("–");
    expect(estimatedAmountFor(unknown)).toBeNull();
  });
});

describe("tier pricing", () => {
  it("keeps every tier's unit price falling as the tier rises", () => {
    const unit = (key: PurchaseProductKey) => {
      const plan = PRICING[key];
      return plan.salePrice / (plan.uses + plan.companyUses);
    };
    expect(unit("single")).toBe(5_900);
    expect(unit("company")).toBe(5_900);
    expect(unit("standard")).toBeLessThan(unit("single"));
    expect(unit("premium")).toBeLessThan(unit("standard"));
  });

  it("prices bundles against the basic unit price so the savings claim is honest", () => {
    const basic = PRICING.single.salePrice;
    expect(PRICING.standard.listPrice).toBe(basic * (PRICING.standard.uses + PRICING.standard.companyUses));
    expect(PRICING.premium.listPrice).toBe(basic * (PRICING.premium.uses + PRICING.premium.companyUses));
    expect(savingsFor(PRICING.standard)).toBe(2_800);
    expect(savingsFor(PRICING.premium)).toBe(9_500);
    expect(PRICING.standard.discountLabel).toBe("2,800원 절약");
    expect(PRICING.premium.discountLabel).toBe("9,500원 절약");
  });

  it("prices the company single like the resume single", () => {
    expect(PRICING.company.listPrice).toBe(PRICING.single.listPrice);
    expect(PRICING.company.salePrice).toBe(PRICING.single.salePrice);
    expect(savingsFor(PRICING.company)).toBe(4_000);
    expect(PRICING.company.discountLabel).toBe("4,000원 절약");
  });

  it("maps server product keys to pricing keys and labels", () => {
    expect(PRODUCT_KEY_BY_PRODUCT).toEqual({ SINGLE: "single", COMPANY_SINGLE: "company", STANDARD: "standard", PREMIUM: "premium", TRIPLE: "triple" });
    expect(productLabel("STANDARD")).toBe("스탠다드");
    expect(productLabel("PREMIUM")).toBe("프리미엄");
    expect(productLabel("COMPANY_SINGLE")).toBe("기업 분석 1회");
    expect(estimatedAmountFor("PREMIUM")).toBe(25_900);
  });

  it("lists the tiers in ascending order with the basic tier offering a choice", () => {
    expect(TIERS.map((tier) => tier.key)).toEqual(["basic", "standard", "premium"]);
    expect(TIERS[0].products).toEqual(["single", "company"]);
    expect(PURCHASE_PRODUCT_KEYS).toEqual(["single", "company", "standard", "premium", "triple"]);
  });
});
