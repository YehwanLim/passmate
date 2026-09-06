import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./SettingsPage.tsx", import.meta.url), "utf8");

describe("SettingsPage product settings card", () => {
  it("renders one editable row per purchase product from the admin API", () => {
    expect(source).toContain('from "@/lib/admin-product-settings"');
    expect(source).toContain("fetchProductSettings()");
    expect(source).toContain("updateProductSetting(");
    expect(source).toContain("결제 상품 설정");
    expect(source).toContain("productLabel(row.product)");
    // contentId·결제 URL 입력과 판매 스위치, 행별 저장
    expect(source).toContain("Groble contentId");
    expect(source).toContain("결제 URL");
    expect(source).toContain("판매");
    expect(source).toContain("DUPLICATE_CONTENT_ID");
  });

  it("keeps the card outside the read-only fieldset", () => {
    expect(source.indexOf("결제 상품 설정")).toBeLessThan(source.indexOf('<fieldset disabled'));
  });
});
