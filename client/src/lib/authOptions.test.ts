import { describe, expect, it } from "vitest";
import { getGoogleOAuthOptions } from "./authOptions";

describe("getGoogleOAuthOptions", () => {
  it("lets a returning user select a different Google account without forcing consent", () => {
    const options = getGoogleOAuthOptions("https://example.com/login");

    expect(options).toEqual({
      redirectTo: "https://example.com/login",
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    });
  });
});
