import { describe, expect, it } from "vitest";
import { PRICING } from "@/lib/pricing";
import { SEO_ROUTES } from "@/lib/seo";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  OFFERED_PRODUCTS,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webSiteJsonLd,
} from "./structuredData";

describe("structured data", () => {
  it("lists every product on sale with its live price in KRW", () => {
    const app = softwareApplicationJsonLd();
    const offers = app.offers as Array<{ name: string; price: number; priceCurrency: string }>;
    expect(OFFERED_PRODUCTS).not.toContain("triple");
    expect(offers.map(offer => offer.name)).toEqual(OFFERED_PRODUCTS.map(key => PRICING[key].label));
    for (const [index, key] of OFFERED_PRODUCTS.entries()) {
      expect(offers[index].price).toBe(PRICING[key].salePrice);
      expect(offers[index].priceCurrency).toBe("KRW");
    }
  });

  it("gives every block a schema.org context and type", () => {
    const blocks = [
      organizationJsonLd(),
      webSiteJsonLd(),
      softwareApplicationJsonLd(),
      articleJsonLd({
        url: "https://pre-view.me/guide/x",
        title: "t",
        description: "d",
        datePublished: "2026-09-14",
        dateModified: "2026-09-14",
        keywords: ["자소서 첨삭"],
      }),
      breadcrumbJsonLd([{ name: "홈", url: "https://pre-view.me/" }]),
    ];
    for (const block of blocks) {
      expect(block["@context"]).toBe("https://schema.org");
      expect(typeof block["@type"]).toBe("string");
    }
  });

  it("attaches organization, website and application data to the landing and offers to the pricing page", () => {
    const landingTypes = (SEO_ROUTES["/"].jsonLd ?? []).map(block => block["@type"]);
    expect(landingTypes).toEqual(["Organization", "WebSite", "SoftwareApplication"]);
    const pricingTypes = (SEO_ROUTES["/entitlements"].jsonLd ?? []).map(block => block["@type"]);
    expect(pricingTypes).toEqual(["SoftwareApplication"]);
  });
});
