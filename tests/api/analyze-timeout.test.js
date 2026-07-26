import { describe, expect, it } from "vitest";

import { maxDuration } from "../../api/analyze.js";

describe("analysis API runtime", () => {
  it("allows the insight report to run for up to 120 seconds", () => {
    expect(maxDuration).toBe(120);
  });
});
