import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";

import { ApiError } from "./api-handler.js";

// 채용공고 URL → 본문 텍스트. 사용자가 준 URL 을 서버가 대신 읽어 오므로 SSRF 가드(사설·예약 IPv4,
// 전역 유니캐스트가 아닌 IPv6, 기본 포트 외 거부, 리다이렉트 목적지마다 재검사, 연결 시점 IP 재검사)와
// 크기·시간·콘텐츠 타입 상한을 둔다. 외부 의존성 없음. URL·본문은 로그에 남기지 않는다.

const USER_AGENT = "Mozilla/5.0 (compatible; PreViewBot/1.0)";
const ACCEPT = "text/html,text/plain;q=0.9,*/*;q=0.1";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function invalidRequest() {
  return new ApiError("INVALID_REQUEST", 400);
}

function unreadable() {
  return new ApiError("POSTING_URL_UNREADABLE", 422);
}

// ── 주소 판정 ────────────────────────────────────────────────────────────────

/** 점 4개 표기를 정수로. 형식이 아니면 null. */
function parseIpv4(ip) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!match) return null;
  let value = 0;
  for (let i = 1; i <= 4; i += 1) {
    const octet = Number(match[i]);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

const PRIVATE_IPV4_RANGES = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // 멀티캐스트
  ["240.0.0.0", 4], // 예약·브로드캐스트
].map(([base, bits]) => ({ base: parseIpv4(base), mask: bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0 }));

function isPrivateIpv4Int(value) {
  return PRIVATE_IPV4_RANGES.some(({ base, mask }) => ((value & mask) >>> 0) === ((base & mask) >>> 0));
}

/** IPv6 앞 두 hextet. 형식이 아니면 null. "2001::1" 처럼 줄인 표기도 펼쳐서 읽는다. */
function leadingIpv6Hextets(ip) {
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  if (head.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  const first = head.length > 0 ? parseInt(head[0], 16) : 0;
  const second = head.length > 1 ? parseInt(head[1], 16) : 0;
  return [first, second];
}

/**
 * 공개 인터넷 주소가 아니면 true. IPv4 는 사설·예약 대역, IPv6 는 전역 유니캐스트(2000::/3)만 공개로 보되
 * 문서용(2001:db8::/32)·Teredo(2001::/32)·6to4(2002::/16)는 안쪽 IPv4 를 숨길 수 있어 거부한다.
 * IPv4-mapped IPv6(::ffff:a.b.c.d)는 안쪽 IPv4 로 판정.
 */
export function isPrivateAddress(ip) {
  if (typeof ip !== "string") return true;
  const trimmed = ip.trim().replace(/^\[|\]$/g, "").toLowerCase();
  if (!trimmed) return true;

  const v4 = parseIpv4(trimmed);
  if (v4 !== null) return isPrivateIpv4Int(v4);

  const mappedDotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(trimmed);
  if (mappedDotted) {
    const inner = parseIpv4(mappedDotted[1]);
    return inner === null ? true : isPrivateIpv4Int(inner);
  }

  // WHATWG URL 은 ::ffff:127.0.0.1 을 ::ffff:7f00:1 로 정규화한다.
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(trimmed);
  if (mappedHex) {
    const inner = parseInt(mappedHex[1], 16) * 0x10000 + parseInt(mappedHex[2], 16);
    return isPrivateIpv4Int(inner);
  }

  // ::, ::1, ::7f00:1(IPv4-compatible), 64:ff9b::(NAT64), fc00::/7, fe80::/10, fec0::/10, ff00::/8 는
  // 전부 2000::/3 밖이라 여기서 걸린다.
  const hextets = leadingIpv6Hextets(trimmed);
  if (!hextets) return true;
  const [first, second] = hextets;
  if (first < 0x2000 || first > 0x3fff) return true;
  if (first === 0x2001 && (second === 0x0db8 || second === 0)) return true;
  if (first === 0x2002) return true;
  return false;
}

function isIpLiteral(hostname) {
  return parseIpv4(hostname) !== null || hostname.includes(":");
}

// ── URL 검증 ────────────────────────────────────────────────────────────────

/**
 * http(s) 공개 호스트만 통과시킨다. IP 리터럴과 DNS 결과 모두 사설 범위를 거부한다.
 * 통과하면 URL 인스턴스를 돌려준다.
 */
export async function assertSafeUrl(urlString, { lookup = dns.promises.lookup } = {}) {
  let url;
  try {
    url = new URL(String(urlString));
  } catch {
    throw invalidRequest();
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") throw invalidRequest();
  if (url.username || url.password) throw invalidRequest();
  // 기본 포트(80/443)만. WHATWG URL 은 기본 포트를 빈 문자열로 정규화한다.
  if (url.port !== "") throw invalidRequest();

  // IPv6 리터럴은 URL 이 대괄호로 감싼다.
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname) throw invalidRequest();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) throw invalidRequest();

  if (isIpLiteral(hostname)) {
    if (isPrivateAddress(hostname)) throw invalidRequest();
    return url;
  }

  let addresses;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw invalidRequest();
  }
  const list = Array.isArray(addresses) ? addresses : [addresses];
  if (list.length === 0) throw invalidRequest();
  for (const entry of list) {
    const address = typeof entry === "string" ? entry : entry?.address;
    if (isPrivateAddress(address)) throw invalidRequest();
  }
  return url;
}

// ── HTML → 텍스트 ───────────────────────────────────────────────────────────

const DROP_BLOCKS = /<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const BLOCK_TAGS =
  /<\/?(?:p|div|br|li|tr|h[1-6]|section|article|header|footer|ul|ol|table|dl|dt|dd|blockquote|pre|hr)\b[^>]*\/?>/gi;
const ANY_TAG = /<\/?[a-zA-Z][^>]*>/g;

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === "#") {
      const codePoint = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return whole;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? whole : named;
  });
}

/** 마크업을 걷어내고 블록 경계를 줄바꿈으로 남긴 평문. 일반 텍스트는 공백 정리만 거쳐 그대로 나온다. */
export function htmlToText(html) {
  const text = String(html ?? "")
    .replace(DROP_BLOCKS, " ")
    .replace(COMMENTS, " ")
    .replace(BLOCK_TAGS, "\n")
    .replace(ANY_TAG, " ");

  return decodeEntities(text)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── 연결 시점 가드 ──────────────────────────────────────────────────────────

/**
 * net.connect 용 lookup. assertSafeUrl 의 DNS 검사 뒤 fetch 가 이름을 다시 풀 때 다른 IP 를 돌려주는
 * DNS rebinding 을 막으려고, 실제로 연결할 주소를 여기서 한 번 더 판정한다.
 */
export function guardedLookup(hostname, options, callback, { resolve = dns.lookup } = {}) {
  const opts = typeof options === "object" && options !== null ? options : { family: options };
  resolve(hostname, { ...opts, all: true }, (error, addresses) => {
    if (error) return callback(error);
    const list = Array.isArray(addresses) ? addresses : [];
    if (list.length === 0 || list.some((entry) => isPrivateAddress(entry?.address))) {
      const blocked = new Error("Blocked address");
      blocked.code = "EBLOCKEDADDRESS";
      return callback(blocked);
    }
    if (opts.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

/** fetchPostingText 가 쓰는 만큼만 흉내 낸 fetch. 연결은 guardedLookup 을 거친다. */
function guardedFetch(urlString, { headers, signal } = {}) {
  const url = new URL(urlString);
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      { method: "GET", headers, signal, lookup: guardedLookup, agent: false },
      (response) => {
        resolve({
          status: response.statusCode ?? 0,
          headers: {
            get(name) {
              const value = response.headers[String(name).toLowerCase()];
              return Array.isArray(value) ? value.join(", ") : (value ?? null);
            },
          },
          body: Readable.toWeb(response),
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

/** 읽지 않을 응답 본문을 닫아 소켓을 놓아준다. */
function discardBody(response) {
  const body = response?.body;
  if (body && typeof body.cancel === "function") body.cancel().catch(() => {});
}

// ── 본문 가져오기 ───────────────────────────────────────────────────────────

function parseContentType(header) {
  const value = String(header ?? "").toLowerCase();
  const [mime, ...params] = value.split(";").map((part) => part.trim());
  const charsetParam = params.find((part) => part.startsWith("charset="));
  const charset = charsetParam ? charsetParam.slice("charset=".length).replace(/^"|"$/g, "") : null;
  return { mime, charset };
}

function pickDecoder(charset) {
  if (charset && /^(euc-kr|cp949|ks_c_5601-1987|ksc5601|x-windows-949|windows-949)$/.test(charset)) {
    try {
      return new TextDecoder("euc-kr");
    } catch {
      // Node ICU 가 없으면 utf-8 로 떨어진다.
    }
  }
  return new TextDecoder("utf-8");
}

/** 본문을 바이트 상한까지만 읽는다. 넘치면 스트림을 끊고 null 을 돌려준다. */
async function readBodyLimited(response, maxBytes) {
  const chunks = [];
  let total = 0;

  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } else {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) return null;
    chunks.push(buffer);
    total = buffer.byteLength;
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

/**
 * URL 의 HTML/텍스트 본문을 평문으로. 리다이렉트는 목적지마다 assertSafeUrl 을 다시 거친다.
 * 검증 실패는 INVALID_REQUEST(400), 읽기 실패는 POSTING_URL_UNREADABLE(422).
 */
export async function fetchPostingText(
  urlString,
  { fetchImpl = guardedFetch, lookup, maxBytes = 1_500_000, maxRedirects = 3, timeoutMs = 8000 } = {},
) {
  const lookupOptions = lookup ? { lookup } : {};
  let current = await assertSafeUrl(urlString, lookupOptions);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let hop = 0; ; hop += 1) {
      let response;
      try {
        response = await fetchImpl(current.toString(), {
          method: "GET",
          redirect: "manual",
          headers: { "User-Agent": USER_AGENT, Accept: ACCEPT },
          signal: controller.signal,
        });
      } catch {
        throw unreadable();
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        discardBody(response);
        if (hop >= maxRedirects) throw unreadable();
        const location = response.headers.get("location");
        if (!location) throw unreadable();
        let next;
        try {
          next = new URL(location, current);
        } catch {
          throw unreadable();
        }
        current = await assertSafeUrl(next.toString(), lookupOptions);
        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        discardBody(response);
        throw unreadable();
      }

      const { mime, charset } = parseContentType(response.headers.get("content-type"));
      if (mime !== "text/html" && mime !== "text/plain") {
        discardBody(response);
        throw unreadable();
      }

      let bytes;
      try {
        bytes = await readBodyLimited(response, maxBytes);
      } catch {
        throw unreadable();
      }
      if (bytes === null) throw unreadable();

      return htmlToText(pickDecoder(charset).decode(bytes));
    }
  } finally {
    clearTimeout(timer);
  }
}
