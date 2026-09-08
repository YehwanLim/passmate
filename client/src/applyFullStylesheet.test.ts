// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyFullStylesheet, FULL_CSS_ATTR } from "./applyFullStylesheet";

describe("applyFullStylesheet", () => {
  it("turns the deferred full-CSS preload back into a stylesheet and leaves other links alone", () => {
    document.head.innerHTML =
      `<link rel="preload" as="style" crossorigin href="/assets/index-a.css" ${FULL_CSS_ATTR}>` +
      '<link rel="preload" as="image" href="/logo.png">' +
      '<link rel="stylesheet" href="/other.css">';
    expect(applyFullStylesheet()).toBe(1);
    const full = document.querySelector(`link[${FULL_CSS_ATTR}]`)!;
    expect(full.getAttribute("rel")).toBe("stylesheet");
    expect(full.hasAttribute("as")).toBe(false);
    expect(document.querySelector('link[as="image"]')!.getAttribute("rel")).toBe("preload");
    expect(document.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(2);
  });

  it("is a no-op on the plain SPA shell and in dev", () => {
    document.head.innerHTML = '<link rel="stylesheet" href="/assets/index-a.css">';
    expect(applyFullStylesheet()).toBe(0);
  });
});
