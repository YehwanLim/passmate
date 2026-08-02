import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SocialProofSection, {
  ACCEPTANCE_TESTIMONIALS,
  getSocialProofRevealProps,
  SOCIAL_PROOF_METRICS,
  SUCCESSFUL_COMPANIES,
  SUCCESSFUL_COMPANY_COUNT,
} from "./SocialProofSection";

describe("SocialProofSection", () => {
  it("renders PreView's successful-company proof and every requested company", () => {
    const markup = renderToStaticMarkup(<SocialProofSection />);

    expect(markup).toContain("이미 많은 합격자들이");
    expect(markup).toContain("로 자소서를 완성했습니다.");
    expect(markup).toContain('alt="Pre:View"');
    expect(markup).toContain("0+");
    expect(markup).not.toContain("PassMate");
    expect(SUCCESSFUL_COMPANY_COUNT).toBe(20);
    expect(SOCIAL_PROOF_METRICS).toEqual([
      {
        id: "accepted-companies",
        value: 20,
        suffix: "+",
        label: "합격 기업",
      },
      {
        id: "analyzed-cover-letters",
        value: 2000,
        suffix: "+",
        label: "분석 완료 자소서",
      },
    ]);
    expect(SUCCESSFUL_COMPANIES.map(company => company.name)).toEqual([
      "카카오",
      "NAVER",
      "LG",
      "넥슨",
      "NC",
      "넷마블",
      "포스코인터내셔널",
      "현대자동차",
      "SK케미칼",
      "현대오토에버",
      "오리온",
      "삼성전자",
      "LG디스플레이",
      "SK텔레콤",
      "NHN커머스",
      "삼양그룹",
      "CJ올리브네트웍스",
    ]);
    expect(SUCCESSFUL_COMPANIES).toHaveLength(17);
    expect(
      SUCCESSFUL_COMPANIES.every(
        company =>
          company.logoSrc.startsWith("/company-logos/") &&
          company.logoSrc.endsWith(".svg") &&
          company.logoAlt.endsWith("로고") &&
          company.logoScale >= 0.8 &&
          company.logoScale <= 1
      )
    ).toBe(true);
  });

  it("renders anonymous five-star testimonials from reusable mock data", () => {
    const markup = renderToStaticMarkup(<SocialProofSection />);
    const renderedText = markup.replace(/<[^>]+>/g, "");

    expect(ACCEPTANCE_TESTIMONIALS).toHaveLength(4);
    expect(
      ACCEPTANCE_TESTIMONIALS.every(testimonial => testimonial.rating === 5)
    ).toBe(true);
    expect(
      ACCEPTANCE_TESTIMONIALS.every(testimonial => !("name" in testimonial))
    ).toBe(true);

    for (const testimonial of ACCEPTANCE_TESTIMONIALS) {
      expect(renderedText).toContain(testimonial.quote);
      expect(renderedText).toContain(testimonial.company);
      expect(renderedText).toContain(testimonial.role);
      expect(renderedText).toContain(testimonial.period);
    }
  });

  it("uses one testimonial per view on mobile before expanding at larger breakpoints", () => {
    const markup = renderToStaticMarkup(<SocialProofSection />);

    expect(markup).toContain("basis-full sm:basis-1/2 lg:basis-1/3");
  });

  it("removes viewport reveal motion when the user prefers reduced motion", () => {
    expect(getSocialProofRevealProps(true)).toEqual({ initial: false });
  });

  it("renders paired metrics and two equal marquee groups", () => {
    const markup = renderToStaticMarkup(<SocialProofSection />);

    expect(markup).toContain("합격 기업");
    expect(markup).toContain("분석 완료 자소서");
    expect(markup.match(/social-proof-metric"/g)).toHaveLength(2);
    expect(markup.match(/social-proof-marquee-group"/g)).toHaveLength(2);
    expect(markup).toContain('src="/company-logos/samsung-electronics.svg"');
    expect(markup).toContain("--logo-scale:1");
  });

  it("uses readable, brand-appropriate marquee logo assets", () => {
    const expectedFills = {
      "naver.svg": "#03C75A",
      "kakao.svg": "#FEE500",
      "nhn-commerce.svg": "#E4E4E7",
    };

    for (const [asset, fill] of Object.entries(expectedFills)) {
      const source = readFileSync(
        new URL(`../../public/company-logos/${asset}`, import.meta.url),
        "utf8"
      );

      expect(source).toContain(fill);
    }

    const hyundaiMotor = readFileSync(
      new URL("../../public/company-logos/hyundai-motor.svg", import.meta.url),
      "utf8"
    );
    const cjOliveNetworks = readFileSync(
      new URL(
        "../../public/company-logos/cj-olive-networks.svg",
        import.meta.url
      ),
      "utf8"
    );
    const samsungElectronics = readFileSync(
      new URL(
        "../../public/company-logos/samsung-electronics.svg",
        import.meta.url
      ),
      "utf8"
    );
    const hyundaiAutoever = readFileSync(
      new URL(
        "../../public/company-logos/hyundai-autoever.svg",
        import.meta.url
      ),
      "utf8"
    );
    const skChemicals = readFileSync(
      new URL(
        "../../public/company-logos/sk-chemicals.svg",
        import.meta.url
      ),
      "utf8"
    );

    expect(hyundaiMotor).toContain(
      'data-source="https://www.hyundai.com/content/dam/hyundai/kr/ko/images/common/h1-logo.png"'
    );
    expect(cjOliveNetworks).toContain(
      'data-source="https://www.cjolivenetworks.co.kr/images/common/logo-white.svg"'
    );
    expect(hyundaiAutoever).toContain(
      'data-source="https://www.hyundai-autoever.com/common/images/typea-logo-wht.png"'
    );
    expect(skChemicals).toContain(
      'data-source="https://www.skchemicals.com/imgup/pdf/SKchemicals_AI_ENG.zip"'
    );
    expect(samsungElectronics).toContain('viewBox="-0.4 9.8 24.8 4.3"');
    expect(
      SUCCESSFUL_COMPANIES.find(company => company.id === "samsung-electronics")
        ?.logoScale
    ).toBe(1);
    expect(
      SUCCESSFUL_COMPANIES.find(company => company.id === "ncsoft")?.logoScale
    ).toBe(0.82);
    expect(
      SUCCESSFUL_COMPANIES.find(company => company.id === "naver")?.logoScale
    ).toBe(0.91);
  });
});
