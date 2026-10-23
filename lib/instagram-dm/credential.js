// 인스타 장기 토큰(60일) 저장·갱신과 발송 기록 보관 기간(1년) 정리. 일일 크론이 runInstagramMaintenance 를 부른다.
import { CREDENTIAL_ID } from "./delivery.js";
import { InstagramDmError } from "./errors.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const REFRESH_AFTER_MS = 30 * DAY_MS;
export const DELIVERY_RETENTION_MS = 365 * DAY_MS;

function credentialData({ accountId, accessToken, expiresIn, now }) {
  return {
    ...(accountId ? { accountId } : {}),
    accessToken,
    expiresAt: new Date(now.getTime() + expiresIn * 1000),
    refreshedAt: now,
  };
}

export async function saveInstagramCredential({ db, accountId, accessToken, expiresIn, now = new Date() }) {
  const data = credentialData({ accountId, accessToken, expiresIn, now });
  await db.instagramCredential.upsert({
    where: { id: CREDENTIAL_ID },
    create: { id: CREDENTIAL_ID, ...data },
    update: data,
  });
}

export async function refreshInstagramTokenIfDue({ db, graph, now = new Date() }) {
  const credential = await db.instagramCredential.findUnique({ where: { id: CREDENTIAL_ID } });
  if (!credential) return "missing";
  if (now.getTime() - credential.refreshedAt.getTime() < REFRESH_AFTER_MS) return "skipped";

  const { accessToken, expiresIn } = await graph.refreshToken({ token: credential.accessToken });
  // 메타가 2xx 인데 본문이 비정상이면 멀쩡한 기존 토큰을 덮어쓰지 않는다.
  if (typeof accessToken !== "string" || accessToken.length === 0 || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new InstagramDmError("INSTAGRAM_REFRESH_INVALID");
  }
  await db.instagramCredential.update({
    where: { id: CREDENTIAL_ID },
    data: credentialData({ accessToken, expiresIn, now }),
  });
  return "refreshed";
}

export async function purgeExpiredInstagramDeliveries({ db, now = new Date() }) {
  const { count } = await db.instagramDmDelivery.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - DELIVERY_RETENTION_MS) } },
  });
  return count;
}

function diagnosticCode(error) {
  return error instanceof InstagramDmError ? error.code : "UNEXPECTED";
}

/** 계정 삭제 크론에 붙는 부가 단계라 실패해도 던지지 않는다. 로그에는 코드만 남긴다. */
export async function runInstagramMaintenance({ db, graph, now = new Date(), logger = console }) {
  let token = "failed";
  try {
    token = await refreshInstagramTokenIfDue({ db, graph, now });
  } catch (error) {
    logger.warn("[instagram-dm] token refresh failed", { code: diagnosticCode(error) });
  }

  let purgedDeliveries = null;
  try {
    purgedDeliveries = await purgeExpiredInstagramDeliveries({ db, now });
  } catch (error) {
    logger.warn("[instagram-dm] delivery purge failed", { code: diagnosticCode(error) });
  }
  return { token, purgedDeliveries };
}
