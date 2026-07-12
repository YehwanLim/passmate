import { describe, expect, it } from "vitest";
import { getGoogleOAuthOptions } from "./authOptions";

describe("getGoogleOAuthOptions", () => {
  it("does not force Google consent for returning users", () => {
    const options = getGoogleOAuthOptions("https://example.com/login");

    expect(options).toEqual({
      redirectTo: "https://example.com/login",
      queryParams: {
        access_type: "offline",
      },
    });
    expect(options.queryParams).not.toHaveProperty("prompt");
  });
});
