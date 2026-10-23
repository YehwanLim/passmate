import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/prisma.js", () => ({ default: {} }));

const { createInstagramWebhookHandler, extractEvents, verifyMetaSignature } = await import("../../lib/instagram-dm/webhook.js");
const { InstagramDmError } = await import("../../lib/instagram-dm/errors.js");
import { createResponse } from "../helpers/http.js";

const SECRET = "ig-app-secret";
const ACCOUNT = "17841400000000000";

function sign(rawBody, secret = SECRET) {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

function commentBody(overrides = {}) {
  return {
    object: "instagram",
    entry: [{
      id: ACCOUNT,
      time: 1,
      changes: [{ field: "comments", value: { id: "c-1", text: "금지어", from: { id: "user-1", username: "someone" }, media: { id: "m-1" }, ...overrides } }],
    }],
  };
}

function postRequest(body, { signature } = {}) {
  const rawBody = JSON.stringify(body);
  return { method: "POST", headers: { "x-hub-signature-256": signature ?? sign(rawBody) }, query: { instagramWebhook: "1" }, rawBody };
}

function setup({ enabled = true, service } = {}) {
  const fakeService = service ?? {
    handleComment: vi.fn(async () => "gate_sent"),
    handleFollowCheck: vi.fn(async () => "link_sent"),
  };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const handler = createInstagramWebhookHandler({
    appSecret: SECRET,
    verifyToken: "verify-me",
    enabled,
    getService: () => fakeService,
    logger,
  });
  return { handler, service: fakeService, logger };
}

describe("verifyMetaSignature", () => {
  it("accepts only the exact HMAC of the raw body", () => {
    expect(verifyMetaSignature({ rawBody: "{}", signature: sign("{}"), secret: SECRET })).toBe(true);
    expect(verifyMetaSignature({ rawBody: "{ }", signature: sign("{}"), secret: SECRET })).toBe(false);
    expect(verifyMetaSignature({ rawBody: "{}", signature: sign("{}", "other"), secret: SECRET })).toBe(false);
    expect(verifyMetaSignature({ rawBody: "{}", signature: undefined, secret: SECRET })).toBe(false);
    expect(verifyMetaSignature({ rawBody: "{}", signature: sign("{}"), secret: "" })).toBe(false);
  });
});

describe("extractEvents", () => {
  it("reads comments, postbacks, quick replies and text replies; drops echoes and self", () => {
    const events = extractEvents({
      object: "instagram",
      entry: [{
        id: ACCOUNT,
        changes: [{ field: "comments", value: { id: "c-1", text: "금지어", from: { id: "user-1" }, media: { id: "m-1" } } }],
        messaging: [
          { sender: { id: "igsid-1" }, recipient: { id: ACCOUNT }, postback: { payload: "FOLLOW_CHECK:x", title: "팔로우했어요 ✅" } },
          { sender: { id: "igsid-2" }, recipient: { id: ACCOUNT }, message: { mid: "m", text: "팔로우 완료", quick_reply: { payload: "Q" } } },
          { sender: { id: ACCOUNT }, recipient: { id: "igsid-1" }, message: { mid: "m2", text: "봇이 보낸 글", is_echo: true } },
          { sender: { id: ACCOUNT }, recipient: { id: "igsid-1" }, message: { mid: "m3", text: "내가 보낸 글" } },
        ],
      }],
    });

    expect(events).toEqual([
      { type: "comment", accountId: ACCOUNT, comment: { id: "c-1", text: "금지어", fromId: "user-1", mediaId: "m-1" } },
      { type: "follow_check", accountId: ACCOUNT, igsid: "igsid-1", payload: "FOLLOW_CHECK:x", text: "" },
      { type: "follow_check", accountId: ACCOUNT, igsid: "igsid-2", payload: "Q", text: "팔로우 완료" },
    ]);
  });

  it("ignores other objects and other change fields", () => {
    expect(extractEvents({ object: "page", entry: [] })).toEqual([]);
    expect(extractEvents({ object: "instagram", entry: [{ id: ACCOUNT, changes: [{ field: "mentions", value: {} }] }] })).toEqual([]);
    expect(extractEvents(null)).toEqual([]);
  });
});

describe("createInstagramWebhookHandler", () => {
  it("answers Meta's GET verification with the challenge as plain text", async () => {
    const { handler } = setup();
    const res = createResponse();
    res.end = vi.fn(() => res);

    await handler({ method: "GET", query: { "hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "12345" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("text/plain");
    expect(res.end).toHaveBeenCalledWith("12345");
  });

  it("rejects GET verification with a wrong token", async () => {
    const { handler } = setup();
    const res = createResponse();
    await handler({ method: "GET", query: { "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "1" } }, res);
    expect(res.statusCode).toBe(403);
  });

  it("rejects unsigned or tampered POSTs before touching the service", async () => {
    const { handler, service } = setup();
    const res = createResponse();
    await handler(postRequest(commentBody(), { signature: "sha256=00" }), res);
    expect(res.statusCode).toBe(401);
    expect(service.handleComment).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON with a valid signature", async () => {
    const { handler } = setup();
    const res = createResponse();
    await handler({ method: "POST", headers: { "x-hub-signature-256": sign("not json") }, rawBody: "not json" }, res);
    expect(res.statusCode).toBe(400);
  });

  it("dispatches comment events and answers 200", async () => {
    const { handler, service } = setup();
    const res = createResponse();
    await handler(postRequest(commentBody()), res);

    expect(res.statusCode).toBe(200);
    expect(service.handleComment).toHaveBeenCalledWith({
      type: "comment",
      accountId: ACCOUNT,
      comment: { id: "c-1", text: "금지어", fromId: "user-1", mediaId: "m-1" },
    });
  });

  it("accepts but does not process while the switch is off", async () => {
    const { handler, service } = setup({ enabled: false });
    const res = createResponse();
    await handler(postRequest(commentBody()), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, processed: 0 });
    expect(service.handleComment).not.toHaveBeenCalled();
  });

  it("answers 200 on permanent failures and 503 on transient ones, logging codes only", async () => {
    const permanent = setup({ service: { handleComment: vi.fn(async () => { throw new InstagramDmError("NOTION_NOT_CONFIGURED"); }) } });
    const res1 = createResponse();
    await permanent.handler(postRequest(commentBody()), res1);
    expect(res1.statusCode).toBe(200);
    expect(permanent.logger.warn).toHaveBeenCalledWith("[instagram-dm] event failed", { code: "NOTION_NOT_CONFIGURED", type: "comment" });

    const transient = setup({ service: { handleComment: vi.fn(async () => { throw new InstagramDmError("GRAPH_2", { transient: true }); }) } });
    const res2 = createResponse();
    await transient.handler(postRequest(commentBody({ text: "금지어 비밀댓글" })), res2);
    expect(res2.statusCode).toBe(503);
    const logged = JSON.stringify([...transient.logger.error.mock.calls, ...transient.logger.warn.mock.calls, ...transient.logger.info.mock.calls]);
    expect(logged).not.toContain("비밀댓글");
    expect(logged).not.toContain("someone");
    expect(logged).not.toContain("user-1");
  });

  it("rejects other methods", async () => {
    const { handler } = setup();
    const res = createResponse();
    await handler({ method: "PUT", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});
