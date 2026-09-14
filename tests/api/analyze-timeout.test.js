import { describe, expect, it } from "vitest";

import { maxDuration } from "../../api/analyze.js";

describe("analysis API runtime", () => {
  it("allows the insight report to run for up to 180 seconds", () => {
    expect(maxDuration).toBe(180);
  });
});
