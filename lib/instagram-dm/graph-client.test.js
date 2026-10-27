import { describe, expect, it, vi } from "vitest";

import { GRAPH_VERSION, buttonMessage, createGraphClient, textMessage } from "./graph-client.js";

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("message shapes", () => {
  it("builds text and postback-button messages", () => {
    expect(textMessage("hi")).toEqual({ text: "hi" });
    expect(buttonMessage("본문", "팔로우했어요 ✅", "FOLLOW_CHECK:abc")).toEqual({
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "본문",
          buttons: [{ type: "postback", title: "팔로우했어요 ✅", payload: "FOLLOW_CHECK:abc" }],
        },
      },
    });
  });
});

describe("createGraphClient", () => {
  it("sends a private reply to the comment", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ recipient_id: "igsid-1", message_id: "mid-1" }));
    const graph = createGraphClient({ fetchImpl });

    await expect(
      graph.sendPrivateReply({ token: "tok", accountId: "acc-1", commentId: "c-1", message: textMessage("hi") }),
    ).resolves.toEqual({ recipientId: "igsid-1", messageId: "mid-1" });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://graph.instagram.com/${GRAPH_VERSION}/acc-1/messages`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ recipient: { comment_id: "c-1" }, message: { text: "hi" } });
  });

  it("replies publicly under a comment", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "reply-1" }));
    const graph = createGraphClient({ fetchImpl });

    await expect(graph.replyToComment({ token: "tok", commentId: "c-1", message: "감사합니다!" })).resolves.toEqual({ replyId: "reply-1" });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://graph.instagram.com/${GRAPH_VERSION}/c-1/replies`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ message: "감사합니다!" });
  });

  it("sends a normal message to an IGSID", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ recipient_id: "igsid-1", message_id: "mid-2" }));
    await createGraphClient({ fetchImpl }).sendMessage({ token: "tok", accountId: "acc-1", igsid: "igsid-1", message: textMessage("x") });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).recipient).toEqual({ id: "igsid-1" });
  });

  it("reads the follow flag", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ is_user_follow_business: true, id: "igsid-1" }))
      .mockResolvedValueOnce(jsonResponse({ is_user_follow_business: false, id: "igsid-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "igsid-1" }));
    const graph = createGraphClient({ fetchImpl });

    expect(await graph.isFollowingBusiness({ token: "tok", igsid: "igsid-1" })).toBe(true);
    expect(await graph.isFollowingBusiness({ token: "tok", igsid: "igsid-1" })).toBe(false);
    expect(await graph.isFollowingBusiness({ token: "tok", igsid: "igsid-1" })).toBe(false);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      `https://graph.instagram.com/${GRAPH_VERSION}/igsid-1?fields=is_user_follow_business`,
    );
  });

  it("refreshes the long-lived token", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ access_token: "new", token_type: "bearer", expires_in: 5184000 }));
    await expect(createGraphClient({ fetchImpl }).refreshToken({ token: "old" })).resolves.toEqual({
      accessToken: "new",
      expiresIn: 5184000,
    });
    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://graph.instagram.com/refresh_access_token");
    expect(url.searchParams.get("grant_type")).toBe("ig_refresh_token");
    expect(url.searchParams.get("access_token")).toBe("old");
  });

  it("maps Graph errors to coded errors, transient only for retryable ones", async () => {
    const permanent = createGraphClient({ fetchImpl: async () => jsonResponse({ error: { code: 10, message: "x" } }, 400) });
    await expect(permanent.sendMessage({ token: "t", accountId: "a", igsid: "i", message: textMessage("x") }))
      .rejects.toMatchObject({ code: "GRAPH_10", transient: false });

    const throttled = createGraphClient({ fetchImpl: async () => jsonResponse({ error: { code: 4 } }, 400) });
    await expect(throttled.sendMessage({ token: "t", accountId: "a", igsid: "i", message: textMessage("x") }))
      .rejects.toMatchObject({ code: "GRAPH_4", transient: true });

    const down = createGraphClient({ fetchImpl: async () => jsonResponse({}, 503) });
    await expect(down.isFollowingBusiness({ token: "t", igsid: "i" })).rejects.toMatchObject({ code: "GRAPH_503", transient: true });
  });

  it("never puts the token in error messages", async () => {
    const graph = createGraphClient({ fetchImpl: async () => jsonResponse({ error: { code: 190 } }, 401) });
    const error = await graph.isFollowingBusiness({ token: "very-secret", igsid: "i" }).catch((e) => e);
    expect(String(error.message)).not.toContain("very-secret");
  });

  it("turns a fetch rejection into a transient GRAPH_NETWORK error without the original message", async () => {
    const graph = createGraphClient({
      fetchImpl: async () => {
        throw new Error("connect ECONNRESET https://graph.instagram.com/?access_token=very-secret");
      },
    });
    const error = await graph.refreshToken({ token: "very-secret" }).catch((e) => e);
    expect(error).toMatchObject({ code: "GRAPH_NETWORK", transient: true });
    expect(String(error.message)).not.toContain("very-secret");
    expect(String(error.message)).not.toContain("ECONNRESET");
  });
});
