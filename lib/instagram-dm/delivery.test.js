import { describe, expect, it, vi } from "vitest";

import { InstagramDmError } from "./errors.js";
import { CREDENTIAL_ID, MAX_FOLLOW_CHECKS, createDeliveryService, deliveryIdFromPayload, followPayload } from "./delivery.js";
import { COMMENT_REPLIES, FOLLOW_BUTTON_TITLE, NOT_FOLLOWING_TEXT, commentReplyText, gateText, gateTextFallback, linkText } from "./messages.js";

const ACCOUNT = "acc-1";
const NOW = new Date("2026-10-23T12:00:00.000Z");
const RESOURCE = { pageId: "page-1", title: "자소서 금지어 사전", keyword: "금지어", url: "https://hansi.notion.site/x" };

// 필요한 Prisma 메서드만 흉내 내는 메모리 DB.
function createFakeDb({ credential = { id: CREDENTIAL_ID, accountId: ACCOUNT, accessToken: "tok" } } = {}) {
  const rows = new Map();
  let seq = 0;
  return {
    rows,
    instagramCredential: { findUnique: vi.fn(async () => credential) },
    instagramDmDelivery: {
      create: vi.fn(async ({ data }) => {
        if ([...rows.values()].some((row) => row.commentId === data.commentId)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        seq += 1;
        const row = { id: `00000000-0000-4000-8000-00000000000${seq}`, igsid: null, status: "SENDING", followChecks: 0, createdAt: NOW, ...data };
        rows.set(row.id, row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = rows.get(where.id);
        for (const [key, value] of Object.entries(data)) {
          row[key] = value && typeof value === "object" && "increment" in value ? row[key] + value.increment : value;
        }
        return row;
      }),
      delete: vi.fn(async ({ where }) => rows.delete(where.id)),
      findUnique: vi.fn(async ({ where }) => rows.get(where.id) ?? null),
      findFirst: vi.fn(async ({ where }) =>
        [...rows.values()]
          .filter((row) => row.igsid === where.igsid && row.status === where.status && row.createdAt >= where.createdAt.gte)
          .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
      ),
    },
  };
}

function createFakeGraph(overrides = {}) {
  return {
    sendPrivateReply: vi.fn(async () => ({ recipientId: "igsid-1", messageId: "mid-1" })),
    sendMessage: vi.fn(async () => ({ recipientId: "igsid-1", messageId: "mid-2" })),
    isFollowingBusiness: vi.fn(async () => true),
    replyToComment: vi.fn(async () => ({ replyId: "reply-1" })),
    ...overrides,
  };
}

function setup({ db = createFakeDb(), graph = createFakeGraph(), resource = RESOURCE, findByPageId = vi.fn(async () => resource) } = {}) {
  const resources = { findByComment: vi.fn(async () => resource), findByPageId };
  const service = createDeliveryService({ db, graph, resources, now: () => NOW });
  return { db, graph, resources, service };
}

const comment = (overrides = {}) => ({ accountId: ACCOUNT, comment: { id: "c-1", text: "금지어", fromId: "user-1", mediaId: "m-1", ...overrides } });

describe("commentReplyText", () => {
  it("picks the same reply for the same comment and spreads replies across comments", () => {
    expect(commentReplyText("c-1")).toBe(commentReplyText("c-1"));
    const used = new Set(Array.from({ length: 30 }, (_, i) => commentReplyText(`17900000000000${i}`)));
    expect(used).toEqual(new Set(COMMENT_REPLIES));
  });
});

describe("follow payload", () => {
  it("round-trips a delivery id and rejects anything else", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(deliveryIdFromPayload(followPayload(id))).toBe(id);
    expect(deliveryIdFromPayload("FOLLOW_CHECK:not-a-uuid")).toBeNull();
    expect(deliveryIdFromPayload(undefined)).toBeNull();
  });
});

describe("handleComment", () => {
  it("sends the follow gate with a button and records GATE_SENT", async () => {
    const { db, graph, service } = setup();

    expect(await service.handleComment(comment())).toBe("gate_sent");

    const call = graph.sendPrivateReply.mock.calls[0][0];
    expect(call).toMatchObject({ token: "tok", accountId: ACCOUNT, commentId: "c-1" });
    expect(call.message.attachment.payload.text).toBe(gateText(RESOURCE.title));
    expect(call.message.attachment.payload.buttons[0].title).toBe(FOLLOW_BUTTON_TITLE);
    const [row] = db.rows.values();
    expect(row).toMatchObject({ status: "GATE_SENT", igsid: "igsid-1", keyword: "금지어", resourceUrl: RESOURCE.url });
    expect(call.message.attachment.payload.buttons[0].payload).toBe(followPayload(row.id));
    expect(graph.replyToComment).toHaveBeenCalledTimes(1);
    expect(graph.replyToComment).toHaveBeenCalledWith({ token: "tok", commentId: "c-1", message: commentReplyText("c-1") });
  });

  it("keeps the DM result when the public reply fails", async () => {
    const graph = createFakeGraph({ replyToComment: vi.fn(async () => { throw new InstagramDmError("GRAPH_10"); }) });
    const { db, service } = setup({ graph });

    expect(await service.handleComment(comment())).toBe("gate_sent");
    expect([...db.rows.values()][0].status).toBe("GATE_SENT");
  });

  it("replies publicly only once, and not when the DM failed", async () => {
    const repeated = setup();
    await repeated.service.handleComment(comment());
    await repeated.service.handleComment(comment());
    expect(repeated.graph.replyToComment).toHaveBeenCalledTimes(1);

    const refused = setup({ graph: createFakeGraph({ sendPrivateReply: vi.fn(async () => { throw new InstagramDmError("GRAPH_10"); }) }) });
    expect(await refused.service.handleComment(comment())).toBe("failed");
    expect(refused.graph.replyToComment).not.toHaveBeenCalled();

    const own = setup();
    await own.service.handleComment(comment({ fromId: ACCOUNT }));
    expect(own.graph.replyToComment).not.toHaveBeenCalled();
  });

  it("ignores its own comments, unknown keywords and other accounts", async () => {
    const own = setup();
    expect(await own.service.handleComment(comment({ fromId: ACCOUNT }))).toBe("ignored");
    expect(own.resources.findByComment).not.toHaveBeenCalled();

    const unknown = setup({ resource: null });
    expect(await unknown.service.handleComment(comment())).toBe("ignored");
    expect(unknown.graph.sendPrivateReply).not.toHaveBeenCalled();

    const other = setup();
    expect(await other.service.handleComment({ ...comment(), accountId: "someone-else" })).toBe("account_mismatch");
    expect(other.graph.sendPrivateReply).not.toHaveBeenCalled();
  });

  it("sends only once for a repeated comment notification", async () => {
    const { graph, service } = setup();
    await service.handleComment(comment());
    expect(await service.handleComment(comment())).toBe("duplicate");
    expect(graph.sendPrivateReply).toHaveBeenCalledTimes(1);
  });

  it("falls back to a text gate when the button is rejected", async () => {
    const graph = createFakeGraph({
      sendPrivateReply: vi
        .fn()
        .mockRejectedValueOnce(new InstagramDmError("GRAPH_100"))
        .mockResolvedValueOnce({ recipientId: "igsid-1", messageId: "mid-1" }),
    });
    const { db, service } = setup({ graph });

    expect(await service.handleComment(comment())).toBe("gate_sent");
    expect(graph.sendPrivateReply.mock.calls[1][0].message).toEqual({ text: gateTextFallback(RESOURCE.title) });
    expect([...db.rows.values()][0].status).toBe("GATE_SENT");
  });

  it("records FAILED with the code when Meta refuses for good", async () => {
    const graph = createFakeGraph({ sendPrivateReply: vi.fn(async () => { throw new InstagramDmError("GRAPH_10"); }) });
    const { db, service } = setup({ graph });

    expect(await service.handleComment(comment())).toBe("failed");
    expect([...db.rows.values()][0]).toMatchObject({ status: "FAILED", failureCode: "GRAPH_10" });
  });

  it("removes the row and rethrows on a transient failure so Meta's retry can resend", async () => {
    const graph = createFakeGraph({ sendPrivateReply: vi.fn(async () => { throw new InstagramDmError("GRAPH_2", { transient: true }); }) });
    const { db, service } = setup({ graph });

    await expect(service.handleComment(comment())).rejects.toMatchObject({ transient: true });
    expect(db.rows.size).toBe(0);
  });

  it("keeps the row on a timeout (the DM may have gone out) so the button still works and retries don't resend", async () => {
    const graph = createFakeGraph({
      sendPrivateReply: vi.fn(async () => {
        throw new InstagramDmError("GRAPH_NETWORK", { transient: true });
      }),
    });
    const { db, service } = setup({ graph });

    expect(await service.handleComment(comment())).toBe("gate_unknown");
    const [row] = db.rows.values();
    expect(row).toMatchObject({ status: "GATE_SENT", igsid: null });
    expect(db.instagramDmDelivery.delete).not.toHaveBeenCalled();

    expect(await service.handleComment(comment())).toBe("duplicate");
    expect(graph.sendPrivateReply).toHaveBeenCalledTimes(1);

    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-9", payload: followPayload(row.id), text: "" })).toBe("link_sent");
    expect(db.rows.get(row.id)).toMatchObject({ status: "LINK_SENT", igsid: "igsid-9" });
  });

  it("keeps the row and sends only once when recording GATE_SENT fails after a successful send", async () => {
    const { db, graph, service } = setup();
    db.instagramDmDelivery.update.mockRejectedValueOnce(new Error("db down"));

    await expect(service.handleComment(comment())).rejects.toThrow("db down");
    expect(db.rows.size).toBe(1);
    expect(db.instagramDmDelivery.delete).not.toHaveBeenCalled();
    expect(graph.sendPrivateReply).toHaveBeenCalledTimes(1);
    expect(await service.handleComment(comment())).toBe("duplicate");
    expect(graph.sendPrivateReply).toHaveBeenCalledTimes(1);
  });

  it("uses the resource's own gate message from Notion when it has one", async () => {
    const custom = "취준 금지어 모음 바로 드려요! 팔로우하고 버튼 눌러 주세요";
    const graph = createFakeGraph({
      sendPrivateReply: vi
        .fn()
        .mockRejectedValueOnce(new InstagramDmError("GRAPH_100"))
        .mockResolvedValueOnce({ recipientId: "igsid-1", messageId: "mid-1" }),
    });
    const { service } = setup({ graph, resource: { ...RESOURCE, gateMessage: custom } });

    expect(await service.handleComment(comment())).toBe("gate_sent");
    expect(graph.sendPrivateReply.mock.calls[0][0].message.attachment.payload.text).toBe(custom);
    expect(graph.sendPrivateReply.mock.calls[1][0].message.text).toBe(gateTextFallback(RESOURCE.title, custom));
    expect(gateTextFallback(RESOURCE.title, custom)).toContain(custom);
  });

  it("fails loudly when the account was never connected", async () => {
    const { service } = setup({ db: createFakeDb({ credential: null }) });
    await expect(service.handleComment(comment())).rejects.toMatchObject({ code: "INSTAGRAM_NOT_CONNECTED" });
  });
});

describe("handleFollowCheck", () => {
  async function gated(options) {
    const ctx = setup(options);
    await ctx.service.handleComment(comment());
    const [row] = ctx.db.rows.values();
    return { ...ctx, row };
  }

  it("sends the link when the button is pressed by a follower", async () => {
    const { db, graph, service, row } = await gated();

    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-1", payload: followPayload(row.id), text: "" })).toBe("link_sent");
    expect(graph.sendMessage.mock.calls[0][0]).toMatchObject({ igsid: "igsid-1", message: { text: linkText(RESOURCE.title, RESOURCE.url) } });
    expect(db.rows.get(row.id)).toMatchObject({ status: "LINK_SENT", linkSentAt: NOW, followChecks: 1 });
  });

  it("sends the resource's current link message from Notion, with the link on the next line", async () => {
    const findByPageId = vi.fn(async () => ({ ...RESOURCE, linkMessage: "약속한 금지어 사전이에요 📩" }));
    const { graph, service, row } = await gated({ findByPageId });

    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-1", payload: followPayload(row.id), text: "" })).toBe("link_sent");
    expect(findByPageId).toHaveBeenCalledWith(RESOURCE.pageId);
    expect(graph.sendMessage.mock.calls[0][0].message.text).toBe(`약속한 금지어 사전이에요 📩\n${RESOURCE.url}`);
  });

  it("still sends the link with the default message when Notion cannot be read", async () => {
    const findByPageId = vi.fn(async () => {
      throw new InstagramDmError("NOTION_QUERY_FAILED", { transient: true });
    });
    const { graph, service, row } = await gated({ findByPageId });

    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-1", payload: followPayload(row.id), text: "" })).toBe("link_sent");
    expect(graph.sendMessage.mock.calls[0][0].message.text).toBe(linkText(RESOURCE.title, RESOURCE.url));
  });

  it("asks again with the button when not following yet", async () => {
    const graph = createFakeGraph({ isFollowingBusiness: vi.fn(async () => false) });
    const { db, service, row } = await gated({ graph });

    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-1", payload: followPayload(row.id), text: "" })).toBe("not_following");
    const message = graph.sendMessage.mock.calls[0][0].message;
    expect(message.attachment.payload.text).toBe(NOT_FOLLOWING_TEXT);
    expect(message.attachment.payload.buttons[0].payload).toBe(followPayload(row.id));
    expect(db.rows.get(row.id)).toMatchObject({ status: "GATE_SENT", followChecks: 1 });
  });

  it("accepts a text reply mentioning 팔로우 when no button payload exists", async () => {
    const { service } = await gated();
    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-1", payload: undefined, text: "팔로우 완료!" })).toBe("link_sent");
  });

  it("ignores ordinary DMs, strangers, finished deliveries and too many tries", async () => {
    const { db, graph, service, row } = await gated();

    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-1", payload: undefined, text: "안녕하세요" })).toBe("ignored");
    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "intruder", payload: followPayload(row.id), text: "" })).toBe("ignored");

    db.rows.get(row.id).followChecks = MAX_FOLLOW_CHECKS;
    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-1", payload: followPayload(row.id), text: "" })).toBe("ignored");

    db.rows.get(row.id).followChecks = 0;
    db.rows.get(row.id).status = "LINK_SENT";
    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-1", payload: followPayload(row.id), text: "" })).toBe("ignored");
    expect(graph.isFollowingBusiness).not.toHaveBeenCalled();
  });

  it("reports account_mismatch when the notification is for another account", async () => {
    const { graph, service, row } = await gated();
    expect(await service.handleFollowCheck({ accountId: "someone-else", igsid: "igsid-1", payload: followPayload(row.id), text: "" })).toBe("account_mismatch");
    expect(graph.isFollowingBusiness).not.toHaveBeenCalled();
  });

  it("binds the sender when the gate row has no igsid yet and the button payload matches", async () => {
    const { db, graph, service, row } = await gated();
    db.rows.get(row.id).igsid = null;

    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-9", payload: followPayload(row.id), text: "" })).toBe("link_sent");
    expect(db.rows.get(row.id)).toMatchObject({ igsid: "igsid-9", status: "LINK_SENT", followChecks: 1 });
    expect(graph.sendMessage.mock.calls[0][0]).toMatchObject({ igsid: "igsid-9" });
  });

  it("does not bind a null igsid from a text reply", async () => {
    const { db, service, row } = await gated();
    db.rows.get(row.id).igsid = null;
    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-9", payload: undefined, text: "팔로우" })).toBe("ignored");
    expect(db.rows.get(row.id).igsid).toBeNull();
  });

  it("ignores text replies to gates older than 7 days", async () => {
    const { db, service, row } = await gated();
    db.rows.get(row.id).createdAt = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000);
    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-1", payload: undefined, text: "팔로우" })).toBe("ignored");
  });
});
