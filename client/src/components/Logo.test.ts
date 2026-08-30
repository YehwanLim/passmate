import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Logo from "./Logo";

describe("Logo", () => {
  it("renders the inverse supplied wordmark with an accessible name by default", () => {
    const markup = renderToStaticMarkup(createElement(Logo, { className: "h-5" }));

    expect(markup).toContain('src="/pre-view-wordmark-white.png?v=2"');
    expect(markup).toContain('alt="Pre:View"');
    expect(markup).toContain("h-5");
  });

  it("renders the supplied default wordmark on a light surface", () => {
    const markup = renderToStaticMarkup(createElement(Logo, { variant: "default" }));

    expect(markup).toContain('src="/pre-view-wordmark.png?v=2"');
    expect(markup).toContain('alt="Pre:View"');
  });
});
