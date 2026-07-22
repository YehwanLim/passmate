import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AuthButton.tsx", import.meta.url), "utf8");

describe("AuthButton header polish", () => {
  it("uses the same restrained header hover treatment as landing navigation", () => {
    expect(source).toContain("header-action-link");
    expect(source).toContain("id=\"header-login-btn\"");
    expect(source).toContain("id=\"header-profile-btn\"");
  });
});
