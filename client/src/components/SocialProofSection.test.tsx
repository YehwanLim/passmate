import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SocialProofSection, {
  ACCEPTANCE_TESTIMONIALS,
  getSocialProofRevealProps,
  SUCCESSFUL_COMPANIES,
  SUCCESSFUL_COMPANY_COUNT,
} from "./SocialProofSection";

describe("SocialProofSection", () => {
  it("renders PreView's successful-company proof and every requested company", () => {
    const markup = renderToStaticMarkup(<SocialProofSection />);

    expect(markup).toContain("이미 많은 합격자들이");
    expect(markup).toContain("PreView로 자소서를 완성했습니다.");
    expect(markup).toContain("127+");
    expect(markup).not.toContain("PassMate");
    expect(SUCCESSFUL_COMPANY_COUNT).toBe(127);
    expect(SUCCESSFUL_COMPANIES.map(company => company.name)).toEqual([
      "CJ",
      "카카오",
      "NAVER",
      "LG",
      "넥슨",
      "NC",
      "넷마블",
      "포스코인터내셔널",
      "현대자동차",
      "SK 화학",
      "현대오토에버",
      "오리온",
      "삼성전자",
    ]);
  });

  it("renders anonymous five-star testimonials from reusable mock data", () => {
    const markup = renderToStaticMarkup(<SocialProofSection />);

    expect(ACCEPTANCE_TESTIMONIALS).toHaveLength(4);
    expect(
      ACCEPTANCE_TESTIMONIALS.every(testimonial => testimonial.rating === 5)
    ).toBe(true);
    expect(
      ACCEPTANCE_TESTIMONIALS.every(testimonial => !("name" in testimonial))
    ).toBe(true);

    for (const testimonial of ACCEPTANCE_TESTIMONIALS) {
      expect(markup).toContain(testimonial.quote);
      expect(markup).toContain(testimonial.company);
      expect(markup).toContain(testimonial.role);
      expect(markup).toContain(testimonial.period);
    }
  });

  it("uses one testimonial per view on mobile before expanding at larger breakpoints", () => {
    const markup = renderToStaticMarkup(<SocialProofSection />);

    expect(markup).toContain("basis-full sm:basis-1/2 lg:basis-1/3");
  });

  it("removes viewport reveal motion when the user prefers reduced motion", () => {
    expect(getSocialProofRevealProps(true)).toEqual({ initial: false });
  });
});
