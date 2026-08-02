import { describe, expect, it } from "vitest";
import { getLoginRedirectPath } from "@/lib/authRedirect";

describe("getLoginRedirectPath", () => {
  it("keeps the requested protected route as an encoded login redirect", () => {
    expect(getLoginRedirectPath("/analyze")).toBe("/login?redirect=%2Fanalyze");
  });

  it("uses the regular login route when no return path is requested", () => {
    expect(getLoginRedirectPath()).toBe("/login");
  });
});
