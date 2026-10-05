// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { landingCtaWhere } from "./Home";

function element(html: string, selector: string): Element {
  const root = document.createElement("div");
  root.innerHTML = html;
  const found = root.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
}

describe("landingCtaWhere", () => {
  it("data-funnel-cta 가 있으면 그 위치 이름을 쓴다(안쪽 span 을 눌러도)", () => {
    expect(landingCtaWhere(element('<a href="/analyze" data-funnel-cta="hero"><span>go</span></a>', "span"))).toBe("hero");
    expect(landingCtaWhere(element('<button data-funnel-cta="showcase">go</button>', "button"))).toBe("showcase");
  });

  it("표시가 없으면 링크 주소로 예시 리포트·기업 분석·분석 폼을 가른다", () => {
    expect(landingCtaWhere(element('<a href="/report-new?sample=1">s</a>', "a"))).toBe("sample");
    expect(landingCtaWhere(element('<a href="/company-analysis">c</a>', "a"))).toBe("company");
    expect(landingCtaWhere(element('<a href="/analyze">a</a>', "a"))).toBe("analyze");
  });

  it("퍼널과 무관한 링크·빈 영역은 세지 않는다", () => {
    expect(landingCtaWhere(element('<a href="/guide">g</a>', "a"))).toBeNull();
    expect(landingCtaWhere(element("<p>text</p>", "p"))).toBeNull();
    expect(landingCtaWhere(null)).toBeNull();
  });
});
