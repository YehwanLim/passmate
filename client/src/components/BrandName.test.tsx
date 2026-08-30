import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandName } from "./BrandName";

describe("BrandName", () => {
  it("renders the supplied inverse wordmark as an accessible inline image", () => {
    const markup = renderToStaticMarkup(<BrandName className="h-[1em]" />);

    expect(markup).toContain('src="/pre-view-wordmark-white.png?v=2"');
    expect(markup).toContain('alt="Pre:View"');
    expect(markup).toContain("h-[1em]");
    expect(markup).not.toContain("text-sky-400");
  });
});
