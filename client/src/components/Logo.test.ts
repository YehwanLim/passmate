import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Logo.tsx", import.meta.url), "utf8");

describe("Pre:View wordmark", () => {
  it("renders a colon-only blue Pre:View wordmark without the legacy checkmark", () => {
    expect(source).toMatch(/>\s*Pre\s*<span/);
    expect(source).toMatch(/<\/span>\s*View\s*<\/span>/);
    expect(source).toContain('padding: "0 0.045em"');
    expect(source).toContain('letterSpacing: "-0.045em"');
    expect(source).not.toContain('viewBox="0 0 24 24"');
  });
});
