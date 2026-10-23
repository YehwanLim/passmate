#!/usr/bin/env node
// 인스타 자동 DM 최초 연결. 스레드(scripts/threads.sh)처럼 한 번 로그인해 장기 토큰을 받는다.
//   node scripts/instagram-dm.mjs url                                  # 로그인 주소 출력
//   INSTAGRAM_CONFIRM=1 node scripts/instagram-dm.mjs connect <주소|code> # 토큰 교환·웹훅 구독·DB 저장(운영 DB!)
//   node scripts/instagram-dm.mjs status                               # 연결 상태(토큰은 출력하지 않음)
// 필요한 env(.env): INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI, DATABASE_URL
import { pathToFileURL } from "node:url";

import { saveInstagramCredential } from "../lib/instagram-dm/credential.js";
import { CREDENTIAL_ID } from "../lib/instagram-dm/delivery.js";
import { GRAPH_HOST, GRAPH_VERSION } from "../lib/instagram-dm/graph-client.js";
import { prisma } from "../lib/prisma.js";

export const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
];
const WEBHOOK_FIELDS = "comments,messages,messaging_postbacks";

export function buildAuthorizeUrl({ appId, redirectUri }) {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(","));
  return url.toString();
}

/** 리다이렉트 주소 통째나 code 만 붙여 넣어도 된다. 인스타는 code 끝에 "#_" 를 붙인다. */
export function extractCode(input) {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return "";
  let code = trimmed;
  if (/^https?:\/\//.test(trimmed)) code = new URL(trimmed).searchParams.get("code") ?? "";
  return code.replace(/#_$/, "");
}

function need(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`환경변수 ${name} 가 없습니다(.env 확인).`);
    process.exit(1);
  }
  return value;
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    const code = body?.error?.code ?? body?.error_type ?? response.status;
    throw new Error(`인스타 API 실패(${code})`);
  }
  return body;
}

async function connect(input) {
  if (process.env.INSTAGRAM_CONFIRM !== "1") {
    console.error("운영 DB 에 토큰을 저장합니다. 확인했다면 INSTAGRAM_CONFIRM=1 을 붙여 다시 실행하세요.");
    process.exit(1);
  }
  const code = extractCode(input);
  if (!code) {
    console.error("connect 뒤에 로그인 후 이동한 주소(또는 code)를 붙여 주세요.");
    process.exit(1);
  }
  const appId = need("INSTAGRAM_APP_ID");
  const appSecret = need("INSTAGRAM_APP_SECRET");
  const redirectUri = need("INSTAGRAM_REDIRECT_URI");

  const shortBody = await requestJson("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const shortToken = (shortBody.data?.[0] ?? shortBody).access_token;

  const longUrl = new URL(`${GRAPH_HOST}/access_token`);
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("access_token", shortToken);
  const long = await requestJson(longUrl);

  const auth = { Authorization: `Bearer ${long.access_token}` };
  const me = await requestJson(`${GRAPH_HOST}/${GRAPH_VERSION}/me?fields=user_id,username`, { headers: auth });
  await requestJson(`${GRAPH_HOST}/${GRAPH_VERSION}/me/subscribed_apps?subscribed_fields=${WEBHOOK_FIELDS}`, {
    method: "POST",
    headers: auth,
  });
  await saveInstagramCredential({
    db: prisma,
    accountId: String(me.user_id),
    accessToken: long.access_token,
    expiresIn: long.expires_in,
  });
  console.log(`연결 완료: @${me.username} (계정 ID ${me.user_id}), 웹훅 구독 ${WEBHOOK_FIELDS}`);
}

async function status() {
  const row = await prisma.instagramCredential.findUnique({ where: { id: CREDENTIAL_ID } });
  if (!row) {
    console.log("아직 연결 안 됨");
    return;
  }
  console.log(`계정 ID ${row.accountId} · 만료 ${row.expiresAt.toISOString()} · 갱신 ${row.refreshedAt.toISOString()}`);
}

async function main([command, argument]) {
  if (command === "url") {
    console.log(buildAuthorizeUrl({ appId: need("INSTAGRAM_APP_ID"), redirectUri: need("INSTAGRAM_REDIRECT_URI") }));
  } else if (command === "connect") {
    await connect(argument);
  } else if (command === "status") {
    await status();
  } else {
    console.log("사용법: node scripts/instagram-dm.mjs url | connect <주소|code> | status");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect?.());
}
