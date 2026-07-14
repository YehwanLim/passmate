import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./SubtleBackground.tsx", import.meta.url),
  "utf8"
);

describe("SubtleBackground", () => {
  it("reacts to the cursor through the background instead of a following orb", () => {
    expect(source).toContain("responsive-aurora-field");
    expect(source).toContain("aurora-bloom-band");
    expect(source).toContain("interactive-light-sweep");
    expect(source).toContain("particle-field");
    expect(source).toContain("fieldX");
    expect(source).toContain("fieldY");
    expect(source).toContain("rgba(34,211,238,0.16)");
    expect(source).toContain("rgba(124,58,237,0.14)");
    expect(source).not.toContain("cursor-core-gradient");
    expect(source).not.toContain("cursor-highlight-ring");
    expect(source).not.toContain("cursor-trail-1");
    expect(source).not.toContain("cursor-trail-2");
    expect(source).not.toContain("rounded-full");
  });

  it("keeps the landing background active but quiet", () => {
    expect(source).toContain("quiet-gradient-mesh");
    expect(source).toContain("backgroundSize: \"72px 72px\"");
    expect(source).toContain("opacity-[0.018]");
    expect(source).toContain("duration: 22");
    expect(source).not.toContain("rgba(34,211,238,0.40)");
  });
});
