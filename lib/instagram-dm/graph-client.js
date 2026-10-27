// Instagram API with Instagram Login(graph.instagram.com) 호출. 토큰은 Authorization 헤더로만 보낸다
// (갱신 엔드포인트만 쿼리 파라미터를 요구한다). 오류에는 코드만 싣고 토큰·응답 본문은 싣지 않는다.
import { InstagramDmError } from "./errors.js";

export const GRAPH_HOST = "https://graph.instagram.com";
export const GRAPH_VERSION = "v23.0";

// 메타 그래프 오류 코드 중 잠시 뒤 다시 하면 되는 것: 1 알 수 없음, 2 일시 오류, 4·17·341 호출 한도.
const TRANSIENT_GRAPH_CODES = new Set([1, 2, 4, 17, 341]);

export function textMessage(text) {
  return { text };
}

export function buttonMessage(text, buttonTitle, payload) {
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text,
        buttons: [{ type: "postback", title: buttonTitle, payload }],
      },
    },
  };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createGraphClient({ fetchImpl = fetch } = {}) {
  async function call(url, { token, method = "GET", body } = {}) {
    // 네트워크 오류·타임아웃은 원본 메시지(URL·토큰이 섞일 수 있음)를 싣지 않고 일시 오류로만 알린다.
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        // 댓글 비밀 답장은 4초를 넘기는 일이 실제로 있었다(10-24, 보냈는데 시간 초과로 처리됨).
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new InstagramDmError("GRAPH_NETWORK", { transient: true });
    }
    const payload = await readJson(response);
    if (!response.ok || payload?.error) {
      const graphCode = Number.isInteger(payload?.error?.code) ? payload.error.code : null;
      throw new InstagramDmError(`GRAPH_${graphCode ?? response.status}`, {
        transient: response.status >= 500 || response.status === 429 || TRANSIENT_GRAPH_CODES.has(graphCode),
      });
    }
    return payload ?? {};
  }

  async function send({ token, accountId, recipient, message }) {
    const result = await call(`${GRAPH_HOST}/${GRAPH_VERSION}/${accountId}/messages`, {
      token,
      method: "POST",
      body: { recipient, message },
    });
    return { recipientId: result.recipient_id, messageId: result.message_id };
  }

  return {
    sendPrivateReply({ token, accountId, commentId, message }) {
      return send({ token, accountId, recipient: { comment_id: commentId }, message });
    },
    sendMessage({ token, accountId, igsid, message }) {
      return send({ token, accountId, recipient: { id: igsid }, message });
    },
    /** 댓글 아래 공개 대댓글. 비밀 답장(DM)과 달리 모두에게 보인다. */
    async replyToComment({ token, commentId, message }) {
      const result = await call(`${GRAPH_HOST}/${GRAPH_VERSION}/${commentId}/replies`, { token, method: "POST", body: { message } });
      return { replyId: result.id };
    },
    async isFollowingBusiness({ token, igsid }) {
      const result = await call(`${GRAPH_HOST}/${GRAPH_VERSION}/${igsid}?fields=is_user_follow_business`, { token });
      return result.is_user_follow_business === true;
    },
    async refreshToken({ token }) {
      const url = new URL(`${GRAPH_HOST}/refresh_access_token`);
      url.searchParams.set("grant_type", "ig_refresh_token");
      url.searchParams.set("access_token", token);
      const result = await call(url.toString());
      return { accessToken: result.access_token, expiresIn: result.expires_in };
    },
  };
}
