import { describe, expect, it } from "vitest";

import { readingProgress } from "./ReadingProgressBar";

describe("readingProgress", () => {
  it("goes from 0 at the top to 1 at the bottom of the scrollable range", () => {
    expect(readingProgress(0, 3000, 1000)).toBe(0);
    expect(readingProgress(1000, 3000, 1000)).toBe(0.5);
    expect(readingProgress(2000, 3000, 1000)).toBe(1);
  });

  it("clamps overscroll and treats a page that cannot scroll as fully read", () => {
    expect(readingProgress(-40, 3000, 1000)).toBe(0);
    expect(readingProgress(2300, 3000, 1000)).toBe(1);
    expect(readingProgress(0, 800, 1000)).toBe(1);
  });
});
