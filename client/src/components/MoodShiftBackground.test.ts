import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./MoodShiftBackground.tsx", import.meta.url),
  "utf8"
);

describe("MoodShiftBackground design contract", () => {
  it("stays a non-interactive fixed backdrop behind the content", () => {
    expect(source).toContain(
      "pointer-events-none fixed inset-0 z-0 overflow-hidden"
    );
    expect(source).toContain('aria-hidden="true"');
  });

  it("keeps the layered parallax factors (shimmer moves opposite for depth)", () => {
    expect(source).toContain("const BASE_FACTOR = 0.03");
    expect(source).toContain("const WASH_FACTOR = 0.055");
    expect(source).toContain("const SHIMMER_FACTOR = -0.08");
    expect(source).toContain("inset-[-10%]");
  });

  it("crossfades cyan and violet washes by mouse x", () => {
    expect(source).toContain("rgba(34,211,238,0.135)");
    expect(source).toContain("rgba(124,58,237,0.16)");
    expect(source).toContain("cyanOpacity");
    expect(source).toContain("violetOpacity");
  });

  it("keeps a small snappy cursor follower with a stepped gradient", () => {
    expect(source).toContain("circle 12vmax");
    expect(source).toContain("damping: 26, stiffness: 320");
    expect(source).toContain("rgba(196,215,255,0.24)");
  });

  it("wobbles the background with a velocity-driven displacement filter", () => {
    expect(source).toContain("feDisplacementMap");
    expect(source).toContain('const WOBBLE_FILTER_ID = "mood-shift-wobble"');
    expect(source).toContain("(8 + speed * 26).toFixed(1)");
  });

  it("respects prefers-reduced-motion", () => {
    expect(source).toContain("useReducedMotion");
    expect(source).toContain(
      'displacementRef.current?.setAttribute("scale", "0")'
    );
  });
});
