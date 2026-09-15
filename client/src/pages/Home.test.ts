import { describe, expect, it } from "vitest";
import { HERO_TITLE_MOTION } from "./Home";
import { SITE_NAV_ITEMS as HOME_NAV_ITEMS } from "@/lib/siteNav";

describe("HERO_TITLE_MOTION", () => {
  // 히어로 h1은 랜딩의 LCP 요소다. opacity 0에서 시작하는 등장 애니메이션은
  // 브라우저가 애니메이션이 끝날 때까지 LCP를 미루고(모바일 Lighthouse LCP 7.7s → 3.2s),
  // blur 필터 애니메이션은 큰 글자를 매 프레임 다시 그린다. 이동(transform)만 허용한다.
  it("never hides the LCP headline behind an opacity or blur entrance", () => {
    expect(HERO_TITLE_MOTION.initial).not.toHaveProperty("opacity");
    expect(HERO_TITLE_MOTION.initial).not.toHaveProperty("filter");
    expect(HERO_TITLE_MOTION.animate).not.toHaveProperty("filter");
  });
});

describe("HOME_NAV_ITEMS", () => {
  it("shows only immediately usable top navigation items", () => {
    expect(HOME_NAV_ITEMS.map(item => item.label)).toEqual([
      "서비스 소개",
      "자소서 분석",
      "기업 분석",
      "취업 가이드",
      "이용권 구매",
      "내 지원서",
    ]);
  });

  it("routes the company analysis nav item to the company analysis form", () => {
    expect(HOME_NAV_ITEMS).toContainEqual({
      label: "기업 분석",
      type: "route",
      target: "/company-analysis",
    });
  });

  it("routes the purchase nav item to the standalone entitlements page", () => {
    expect(HOME_NAV_ITEMS).toContainEqual({
      label: "이용권 구매",
      type: "route",
      target: "/entitlements",
    });
  });

  it("does not expose coming soon navigation states", () => {
    expect(HOME_NAV_ITEMS.every(item => item.type !== "coming_soon")).toBe(
      true
    );
  });
});
