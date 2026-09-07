import { describe, expect, it } from "vitest";
import { createSignInNonce } from "./googleIdentity";

describe("createSignInNonce", () => {
  it("원본 nonce와 SHA-256 해시 쌍을 hex로 반환한다", async () => {
    const { nonce, hashedNonce } = await createSignInNonce();

    expect(nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(hashedNonce).toMatch(/^[0-9a-f]{64}$/);

    // hashedNonce는 nonce의 SHA-256과 일치해야 한다 (Google에는 해시, Supabase에는 원본 전달)
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(nonce),
    );
    const expected = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    expect(hashedNonce).toBe(expected);
  });

  it("호출마다 다른 nonce를 만든다", async () => {
    const first = await createSignInNonce();
    const second = await createSignInNonce();
    expect(first.nonce).not.toBe(second.nonce);
  });
});
