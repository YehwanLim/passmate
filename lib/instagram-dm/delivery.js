// 댓글 → 첫 DM(팔로우 안내) → 버튼/답장 → 팔로우 확인 → 자료 링크. 상태는 instagram_dm_deliveries 한 줄.
// 메타는 같은 알림을 다시 보내므로 comment_id 유니크로 1통만 보내고, 링크는 GATE_SENT 일 때만 보낸다.
import { InstagramDmError } from "./errors.js";
import { buttonMessage, textMessage } from "./graph-client.js";
import {
  FOLLOW_BUTTON_TITLE,
  NOT_FOLLOWING_TEXT,
  NOT_FOLLOWING_TEXT_FALLBACK,
  gateText,
  gateTextFallback,
  linkText,
} from "./messages.js";
import { normalizeKeyword } from "./notion-resources.js";

export const CREDENTIAL_ID = "singleton";
export const MAX_FOLLOW_CHECKS = 5;

const FOLLOW_PAYLOAD_PREFIX = "FOLLOW_CHECK:";
const GATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

export function followPayload(deliveryId) {
  return `${FOLLOW_PAYLOAD_PREFIX}${deliveryId}`;
}

export function deliveryIdFromPayload(payload) {
  if (typeof payload !== "string" || !payload.startsWith(FOLLOW_PAYLOAD_PREFIX)) return null;
  const id = payload.slice(FOLLOW_PAYLOAD_PREFIX.length);
  return UUID_PATTERN.test(id) ? id : null;
}

function isPermanent(error) {
  return error instanceof InstagramDmError && !error.transient;
}

/** 버튼 메시지를 먼저 보내고, 메타가 영구 거절하면 같은 뜻의 글자 메시지로 한 번 더 보낸다. */
async function sendWithTextFallback(send, primary, fallback) {
  try {
    return await send(primary);
  } catch (error) {
    if (!isPermanent(error)) throw error;
    return send(fallback);
  }
}

export function createDeliveryService({ db, graph, resources, now = () => new Date() }) {
  async function readCredential() {
    const credential = await db.instagramCredential.findUnique({ where: { id: CREDENTIAL_ID } });
    if (!credential) throw new InstagramDmError("INSTAGRAM_NOT_CONNECTED");
    return credential;
  }

  async function handleComment({ accountId, comment }) {
    if (!comment?.id || !comment.fromId || comment.fromId === accountId) return "ignored";
    const resource = await resources.findByComment(comment.text);
    if (!resource) return "ignored";
    const credential = await readCredential();
    if (accountId !== credential.accountId) return "ignored";

    let delivery;
    try {
      delivery = await db.instagramDmDelivery.create({
        data: {
          commentId: comment.id,
          mediaId: comment.mediaId ?? null,
          keyword: resource.keyword,
          notionPageId: resource.pageId,
          resourceTitle: resource.title,
          resourceUrl: resource.url,
          status: "SENDING",
        },
      });
    } catch (error) {
      if (error?.code === "P2002") return "duplicate";
      throw error;
    }

    const send = (message) =>
      graph.sendPrivateReply({ token: credential.accessToken, accountId: credential.accountId, commentId: comment.id, message });
    let sent;
    try {
      sent = await sendWithTextFallback(
        send,
        buttonMessage(gateText(resource.title), FOLLOW_BUTTON_TITLE, followPayload(delivery.id)),
        textMessage(gateTextFallback(resource.title)),
      );
    } catch (error) {
      if (isPermanent(error)) {
        await db.instagramDmDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", failureCode: error.code } });
        return "failed";
      }
      // 전송이 실패했으니(보내지 못했으니) 기록을 지워 메타 재전송 때 다시 시도하게 한다.
      await db.instagramDmDelivery.delete({ where: { id: delivery.id } });
      throw error;
    }
    // 이미 보냈으니 여기서 실패해도 기록을 지우지 않는다. 메타 재전송은 P2002 로 "duplicate" 가 되어 두 번 보내지 않는다.
    await db.instagramDmDelivery.update({ where: { id: delivery.id }, data: { status: "GATE_SENT", igsid: sent.recipientId } });
    return "gate_sent";
  }

  async function findPendingDelivery({ igsid, payload }) {
    const payloadId = deliveryIdFromPayload(payload);
    if (payloadId) return db.instagramDmDelivery.findUnique({ where: { id: payloadId } });
    return db.instagramDmDelivery.findFirst({
      where: { igsid, status: "GATE_SENT", createdAt: { gte: new Date(now().getTime() - GATE_REPLY_WINDOW_MS) } },
      orderBy: { createdAt: "desc" },
    });
  }

  async function handleFollowCheck({ accountId, igsid, payload, text }) {
    if (!igsid) return "ignored";
    // 버튼이 아닌 글자 답장은 "팔로우" 가 들어 있을 때만 확인 요청으로 본다(평범한 DM 에 끼어들지 않는다).
    if (!deliveryIdFromPayload(payload) && !normalizeKeyword(text).includes("팔로우")) return "ignored";

    const delivery = await findPendingDelivery({ igsid, payload });
    if (!delivery || delivery.igsid !== igsid || delivery.status !== "GATE_SENT") return "ignored";
    if (delivery.followChecks >= MAX_FOLLOW_CHECKS) return "ignored";
    const credential = await readCredential();
    if (accountId !== credential.accountId) return "ignored";

    const token = credential.accessToken;
    const send = (message) => graph.sendMessage({ token, accountId: credential.accountId, igsid, message });
    if (await graph.isFollowingBusiness({ token, igsid })) {
      await send(textMessage(linkText(delivery.resourceTitle, delivery.resourceUrl)));
      await db.instagramDmDelivery.update({
        where: { id: delivery.id },
        data: { status: "LINK_SENT", linkSentAt: now(), followChecks: { increment: 1 } },
      });
      return "link_sent";
    }

    // 보내기 전에 횟수부터 올려, 전송이 실패해도 상한이 지켜지게 한다.
    await db.instagramDmDelivery.update({ where: { id: delivery.id }, data: { followChecks: { increment: 1 } } });
    await sendWithTextFallback(
      send,
      buttonMessage(NOT_FOLLOWING_TEXT, FOLLOW_BUTTON_TITLE, followPayload(delivery.id)),
      textMessage(NOT_FOLLOWING_TEXT_FALLBACK),
    );
    return "not_following";
  }

  return { handleComment, handleFollowCheck };
}
