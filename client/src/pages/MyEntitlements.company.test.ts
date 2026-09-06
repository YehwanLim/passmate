import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./MyEntitlements.tsx", import.meta.url), "utf8");

describe("MyEntitlements company row", () => {
  it("shows the company analysis credit balance as its own row", () => {
    expect(source).toContain("기업 분석 이용권");
    expect(source).toContain("summary.companyRemaining");
  });
});
