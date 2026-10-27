# 인스타 자동 DM 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** @hansionair 게시물의 키워드 댓글에 팔로우 확인 DM → 확인되면 노션 자료 링크 DM을 자동으로 보낸다.

**Architecture:** 메타 웹훅(`comments`·`messages`·`messaging_postbacks`)을 `api/entitlements.js` 에 `?instagramWebhook=1` 로 얹어 받는다(12함수 한도). 로직은 `lib/instagram-dm/` 의 작은 단위(노션 조회·그래프 API·발송 상태·웹훅·토큰)로 나누고 전부 의존성 주입으로 테스트한다. 기록은 Prisma 새 표 2개, 토큰 갱신·오래된 기록 정리는 기존 일일 크론에 붙인다.

**Tech Stack:** Vercel Serverless(ESM JS) · Prisma 7 + Supabase Postgres · Instagram API with Instagram Login(graph.instagram.com v23.0) · Notion API(2025-09-03, data sources) · Vitest · pnpm

**Spec:** `docs/superpowers/specs/2026-10-23-instagram-auto-dm-design.md`

## Global Constraints

- `pnpm` 만 쓴다. 의존성 추가 없음(Node 내장 `fetch`·`crypto` 만).
- 새 Vercel 함수 파일 금지 — `api/` 의 `.js` 파일 수는 12개 그대로(`scripts/vercel-function-limit.test.js`).
- 라우트를 얹을 때 `vercel.json` rewrite 와 `vite.config.ts` 의 `apiRoute()` 를 **둘 다** 고친다.
- 테스트에서 메타·노션·Supabase 를 실제로 호출하지 않는다. `fetchImpl`·`db` 를 주입한다. 응답 목은 `tests/helpers/http.js` 의 `createResponse()`.
- 로그·DB 에 댓글 본문, 사용자 이름, 토큰을 남기지 않는다. 로그에는 상태·키워드·오류 코드만(IGSID 도 로그 금지).
- 노션 상태 값은 정확히 `공개·DM 연결`, 칸 이름은 `이름`(title)·`DM 키워드`(text)·`공개 링크`(url)·`상태`(status).
- 키워드는 "정규화 후 정확히 일치": NFC → 글자·숫자 외 전부 제거 → 소문자.
- 스위치: `INSTAGRAM_DM_ENABLED === "1"` 일 때만 발송.
- DM 문구는 설계 문서 초안 그대로. 바꾸려면 계정 주인 검수.
- **커밋·푸시는 계정 주인 승인 없이 하지 않는다**(CLAUDE.md). 각 태스크 마지막 단계는 "변경 요약"이고, 커밋은 묶어서 승인받은 뒤 한다.
- **운영 DB 마이그레이션은 계정 주인이 지시할 때만** 실행한다. 이 계획은 마이그레이션 파일만 만든다.
- `prettier` 를 기존 파일에 돌리지 않는다(저장소가 포맷을 따르지 않음). 새 파일도 주변 스타일(2칸, 큰따옴표, 세미콜론)대로 손으로 맞춘다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `prisma/schema.prisma` (수정) | `InstagramDmStatus` enum, `InstagramDmDelivery`, `InstagramCredential` |
| `prisma/migrations/20261023_add_instagram_dm/migration.sql` (새) | 표 2개 + enum + RLS/REVOKE |
| `lib/instagram-dm/errors.js` (새) | `InstagramDmError(code, { transient })` |
| `lib/instagram-dm/notion-resources.js` (새) | 키워드 정규화, 노션 표 조회·파싱, 5분 캐시 |
| `lib/instagram-dm/graph-client.js` (새) | 댓글 답장 DM·일반 DM·팔로우 조회·토큰 갱신, 메시지 모양 |
| `lib/instagram-dm/messages.js` (새) | DM 문구 |
| `lib/instagram-dm/credential.js` (새) | 토큰 저장·갱신, 오래된 발송 기록 정리, 크론용 묶음 |
| `lib/instagram-dm/delivery.js` (새) | 댓글 → 첫 DM, 버튼/답장 → 팔로우 확인 → 링크 상태 전이 |
| `lib/instagram-dm/webhook.js` (새) | GET 확인, 서명 검증, 이벤트 추출·분배, 스위치 |
| `api/entitlements.js` (수정) | 인스타 웹훅 분기 |
| `vercel.json`, `vite.config.ts` (수정) | `/api/webhooks/instagram` 매핑 |
| `api/cron/purge-deleted-users.js` (수정) | 인스타 정비 단계 |
| `scripts/instagram-dm.mjs` (새) | 최초 연결(로그인 URL·코드 교환·웹훅 구독·토큰 저장)·상태 |
| `client/src/pages/Privacy.tsx` (수정) | 인스타 DM 기록 문장(계정 주인 검수) |

테스트: `lib/instagram-dm/*.test.js`(단위, lib 옆에 두는 기존 관례 — `lib/billing/groble-webhook.test.js`), `tests/api/instagram-webhook.test.js`, `tests/api/instagram-dm-migration.test.js`, `tests/security/deployment-security.test.js`(수정), `tests/api/account/deletion.test.js`(수정), `scripts/instagram-dm.test.js`.

---

### Task 1: DB 표와 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma` (파일 끝, `PromptTemplate` 모델 뒤)
- Create: `prisma/migrations/20261023_add_instagram_dm/migration.sql`
- Test: `tests/api/instagram-dm-migration.test.js`

**Interfaces:**
- Produces: Prisma 델리게이트 `db.instagramDmDelivery`, `db.instagramCredential`. 상태 문자열 `"SENDING" | "GATE_SENT" | "LINK_SENT" | "FAILED"`. 자격 증명 행 id `"singleton"`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/api/instagram-dm-migration.test.js`:

```js
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../prisma/migrations/20261023_add_instagram_dm/migration.sql", import.meta.url),
  "utf8",
);
const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

describe("instagram auto DM migration", () => {
  it("creates the status enum and both tables", () => {
    expect(migration).toContain(
      "CREATE TYPE instagram_dm_status AS ENUM ('SENDING', 'GATE_SENT', 'LINK_SENT', 'FAILED')",
    );
    expect(migration).toContain("CREATE TABLE instagram_dm_deliveries");
    expect(migration).toContain("comment_id VARCHAR(64) NOT NULL UNIQUE");
    expect(migration).toContain("CREATE TABLE instagram_credentials");
  });

  it("never stores comment text or usernames", () => {
    expect(migration).not.toMatch(/comment_text|username/i);
  });

  it("closes both tables to the public Supabase roles", () => {
    for (const table of ["instagram_dm_deliveries", "instagram_credentials"]) {
      expect(migration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL PRIVILEGES ON TABLE ${table} FROM anon`);
      expect(migration).toContain(`REVOKE ALL PRIVILEGES ON TABLE ${table} FROM authenticated`);
    }
  });

  it("only adds objects", () => {
    expect(migration).not.toMatch(/\bDROP\b|\bALTER TABLE (?!instagram_)/i);
  });

  it("declares the Prisma models the handlers query", () => {
    expect(schema).toContain("model InstagramDmDelivery");
    expect(schema).toContain('@@map("instagram_dm_deliveries")');
    expect(schema).toContain("model InstagramCredential");
    expect(schema).toContain('@@map("instagram_credentials")');
    expect(schema).toContain('@@map("instagram_dm_status")');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run tests/api/instagram-dm-migration.test.js`
Expected: FAIL (`ENOENT ... migration.sql`)

- [ ] **Step 3: 마이그레이션 작성**

`prisma/migrations/20261023_add_instagram_dm/migration.sql`:

```sql
-- 인스타 댓글 키워드 자동 DM: 댓글 하나당 발송 기록 한 줄 + 인스타 API 장기 토큰(단일 행).
-- 새 enum·표만 만든다. 기존 데이터는 건드리지 않는다. 댓글 본문·사용자 이름은 저장하지 않는다.
CREATE TYPE instagram_dm_status AS ENUM ('SENDING', 'GATE_SENT', 'LINK_SENT', 'FAILED');

CREATE TABLE instagram_dm_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id VARCHAR(64) NOT NULL UNIQUE,
  media_id VARCHAR(64),
  igsid VARCHAR(64),
  keyword VARCHAR(50) NOT NULL,
  notion_page_id VARCHAR(64) NOT NULL,
  resource_title VARCHAR(200) NOT NULL,
  resource_url VARCHAR(500) NOT NULL,
  status instagram_dm_status NOT NULL DEFAULT 'SENDING',
  follow_checks INTEGER NOT NULL DEFAULT 0,
  failure_code VARCHAR(64),
  link_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX instagram_dm_deliveries_igsid_status_created_at_idx
  ON instagram_dm_deliveries (igsid, status, created_at);
CREATE INDEX instagram_dm_deliveries_created_at_idx ON instagram_dm_deliveries (created_at);

CREATE TABLE instagram_credentials (
  id VARCHAR(16) PRIMARY KEY DEFAULT 'singleton',
  account_id VARCHAR(64) NOT NULL,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 나머지 애플리케이션 테이블과 같은 기본 거부 상태로 맞춘다(서버 API 로만 읽고 쓴다).
ALTER TABLE instagram_dm_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE instagram_dm_deliveries FROM anon;
    REVOKE ALL PRIVILEGES ON TABLE instagram_credentials FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE instagram_dm_deliveries FROM authenticated;
    REVOKE ALL PRIVILEGES ON TABLE instagram_credentials FROM authenticated;
  END IF;
END
$$;
```

- [ ] **Step 4: Prisma 모델 추가**

`prisma/schema.prisma` 끝에 붙인다(기존 섹션 구분 주석 스타일을 따른다):

```prisma
// =============================================================================
// Instagram 자동 DM — 댓글 키워드 → 팔로우 확인 → 노션 자료 링크
// =============================================================================

enum InstagramDmStatus {
  SENDING
  GATE_SENT
  LINK_SENT
  FAILED

  @@map("instagram_dm_status")
}

/// 댓글 하나당 한 줄. 댓글 본문·사용자 이름은 저장하지 않는다.
model InstagramDmDelivery {
  id            String            @id @default(uuid()) @db.Uuid
  commentId     String            @unique @map("comment_id") @db.VarChar(64)
  mediaId       String?           @map("media_id") @db.VarChar(64)
  /// 첫 DM 응답의 recipient_id(인스타 앱 전용 사용자 ID). 보내기 전에는 null.
  igsid         String?           @db.VarChar(64)
  keyword       String            @db.VarChar(50)
  notionPageId  String            @map("notion_page_id") @db.VarChar(64)
  resourceTitle String            @map("resource_title") @db.VarChar(200)
  resourceUrl   String            @map("resource_url") @db.VarChar(500)
  status        InstagramDmStatus @default(SENDING)
  followChecks  Int               @default(0) @map("follow_checks")
  failureCode   String?           @map("failure_code") @db.VarChar(64)
  linkSentAt    DateTime?         @map("link_sent_at") @db.Timestamptz
  createdAt     DateTime          @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime          @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@index([igsid, status, createdAt])
  @@index([createdAt])
  @@map("instagram_dm_deliveries")
}

/// @hansionair 인스타 API 장기 토큰(60일). 단일 행, 서버 전용.
model InstagramCredential {
  id          String   @id @default("singleton") @db.VarChar(16)
  accountId   String   @map("account_id") @db.VarChar(64)
  accessToken String   @map("access_token") @db.Text
  expiresAt   DateTime @map("expires_at") @db.Timestamptz
  refreshedAt DateTime @map("refreshed_at") @db.Timestamptz
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@map("instagram_credentials")
}
```

- [ ] **Step 5: 클라이언트 재생성과 테스트 통과 확인**

Run: `pnpm exec prisma generate && pnpm exec vitest run tests/api/instagram-dm-migration.test.js`
Expected: generate 성공, 5 tests PASS

- [ ] **Step 6: 변경 요약** — 파일 3개(스키마·마이그레이션·테스트). 운영 DB 적용은 하지 않았다고 적는다.

---

### Task 2: 오류 타입과 노션 자료 조회

**Files:**
- Create: `lib/instagram-dm/errors.js`
- Create: `lib/instagram-dm/notion-resources.js`
- Test: `lib/instagram-dm/notion-resources.test.js`

**Interfaces:**
- Produces:
  - `class InstagramDmError extends Error { code: string; transient: boolean }` — `new InstagramDmError(code, { transient = false } = {})`
  - `normalizeKeyword(text: unknown): string`
  - `parseResourcePage(page): { pageId, title, keyword, url } | null`
  - `PUBLISHED_STATUS = "공개·DM 연결"`
  - `createNotionResourceReader({ token, dataSourceId, fetchImpl, now, ttlMs }) → { findByComment(text): Promise<Resource | null> }`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/instagram-dm/notion-resources.test.js`:

```js
import { describe, expect, it, vi } from "vitest";

import { InstagramDmError } from "./errors.js";
import {
  PUBLISHED_STATUS,
  createNotionResourceReader,
  normalizeKeyword,
  parseResourcePage,
} from "./notion-resources.js";

function page({ id = "page-1", title = "자소서 금지어 사전", keyword = "금지어", url = "https://hansi.notion.site/x" } = {}) {
  return {
    id,
    properties: {
      이름: { type: "title", title: title === null ? [] : [{ plain_text: title }] },
      "DM 키워드": { type: "rich_text", rich_text: keyword === null ? [] : [{ plain_text: keyword }] },
      "공개 링크": { type: "url", url },
    },
  };
}

function notionResponse(results, { hasMore = false, nextCursor = null, status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ results, has_more: hasMore, next_cursor: nextCursor }),
  };
}

describe("normalizeKeyword", () => {
  it("공백·문장부호·이모지를 지우고 영문은 소문자로", () => {
    expect(normalizeKeyword(" 금지어! ")).toBe("금지어");
    expect(normalizeKeyword("AI 🙏")).toBe("ai");
    expect(normalizeKeyword("꼬리 질문")).toBe("꼬리질문");
    expect(normalizeKeyword(null)).toBe("");
  });
});

describe("parseResourcePage", () => {
  it("이름·키워드·https 링크가 다 있어야 자료로 본다", () => {
    expect(parseResourcePage(page())).toEqual({
      pageId: "page-1",
      title: "자소서 금지어 사전",
      keyword: "금지어",
      url: "https://hansi.notion.site/x",
    });
    expect(parseResourcePage(page({ title: null }))).toBeNull();
    expect(parseResourcePage(page({ keyword: null }))).toBeNull();
    expect(parseResourcePage(page({ url: null }))).toBeNull();
    expect(parseResourcePage(page({ url: "http://insecure.example" }))).toBeNull();
  });
});

describe("createNotionResourceReader", () => {
  it("공개 상태만 조회하고 정확히 일치하는 키워드만 찾는다", async () => {
    const fetchImpl = vi.fn(async () => notionResponse([page(), page({ id: "page-2", keyword: "꼬리질문", title: "꼬리질문 준비표" })]));
    const reader = createNotionResourceReader({ token: "secret", dataSourceId: "ds-1", fetchImpl });

    expect((await reader.findByComment("금지어!!"))?.pageId).toBe("page-1");
    expect((await reader.findByComment("꼬리 질문"))?.pageId).toBe("page-2");
    expect(await reader.findByComment("질문")).toBeNull();
    expect(await reader.findByComment("금지어 주세요")).toBeNull();

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.notion.com/v1/data_sources/ds-1/query");
    expect(init.headers.Authorization).toBe("Bearer secret");
    expect(init.headers["Notion-Version"]).toBe("2025-09-03");
    expect(JSON.parse(init.body).filter).toEqual({ property: "상태", status: { equals: PUBLISHED_STATUS } });
  });

  it("5분 동안은 다시 부르지 않고, 지나면 다시 부른다", async () => {
    let clock = 0;
    const fetchImpl = vi.fn(async () => notionResponse([page()]));
    const reader = createNotionResourceReader({ token: "t", dataSourceId: "d", fetchImpl, now: () => clock });

    await reader.findByComment("금지어");
    clock = 299_999;
    await reader.findByComment("금지어");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    clock = 300_000;
    await reader.findByComment("금지어");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("다음 쪽이 있으면 이어서 읽는다", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(notionResponse([page()], { hasMore: true, nextCursor: "c2" }))
      .mockResolvedValueOnce(notionResponse([page({ id: "page-9", keyword: "PT", title: "PT 장표" })]));
    const reader = createNotionResourceReader({ token: "t", dataSourceId: "d", fetchImpl });

    expect((await reader.findByComment("pt"))?.pageId).toBe("page-9");
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).start_cursor).toBe("c2");
  });

  it("빈 댓글은 노션을 부르지 않는다", async () => {
    const fetchImpl = vi.fn();
    const reader = createNotionResourceReader({ token: "t", dataSourceId: "d", fetchImpl });
    expect(await reader.findByComment(" !! ")).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("설정이 없거나 노션이 실패하면 코드가 붙은 오류를 던진다", async () => {
    await expect(createNotionResourceReader({ token: "", dataSourceId: "d", fetchImpl: vi.fn() }).findByComment("금지어"))
      .rejects.toMatchObject({ code: "NOTION_NOT_CONFIGURED", transient: false });

    const serverError = createNotionResourceReader({ token: "t", dataSourceId: "d", fetchImpl: async () => notionResponse([], { status: 502 }) });
    await expect(serverError.findByComment("금지어")).rejects.toMatchObject({ code: "NOTION_QUERY_FAILED", transient: true });

    const badRequest = createNotionResourceReader({ token: "t", dataSourceId: "d", fetchImpl: async () => notionResponse([], { status: 400 }) });
    const error = await badRequest.findByComment("금지어").catch((e) => e);
    expect(error).toBeInstanceOf(InstagramDmError);
    expect(error.transient).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run lib/instagram-dm/notion-resources.test.js`
Expected: FAIL (`Failed to load ./errors.js`)

- [ ] **Step 3: 구현**

`lib/instagram-dm/errors.js`:

```js
// 인스타 자동 DM 공용 오류. transient=true 면 웹훅이 5xx 로 답해 메타가 다시 보내게 하고,
// false 면 기록만 남기고 200 으로 끝낸다(댓글 답장 DM 은 1통뿐이라 다시 보내도 소용없는 경우).
export class InstagramDmError extends Error {
  constructor(code, { transient = false } = {}) {
    super(code);
    this.name = "InstagramDmError";
    this.code = code;
    this.transient = transient;
  }
}
```

`lib/instagram-dm/notion-resources.js`:

```js
// 노션 "DM 자료" 표에서 보낼 자료를 찾는다. 계정 주인은 노션 상태만 바꿔 자료를 켜고 끈다.
import { InstagramDmError } from "./errors.js";

export const PUBLISHED_STATUS = "공개·DM 연결";
const NOTION_VERSION = "2025-09-03";
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 정규화 후 정확히 일치: "금지어!" = "금지어", "꼬리 질문" = "꼬리질문", "AI" = "ai". "질문" ≠ "꼬리질문". */
export function normalizeKeyword(text) {
  if (typeof text !== "string") return "";
  return text.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

function plainText(property) {
  const parts = property?.title ?? property?.rich_text ?? [];
  return parts.map((part) => part?.plain_text ?? "").join("").trim();
}

export function parseResourcePage(page) {
  const properties = page?.properties ?? {};
  const title = plainText(properties["이름"]);
  const keyword = normalizeKeyword(plainText(properties["DM 키워드"]));
  const rawUrl = properties["공개 링크"]?.url;
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!page?.id || !title || !keyword || !url.startsWith("https://")) return null;
  return { pageId: page.id, title, keyword, url };
}

export function createNotionResourceReader({
  token = process.env.NOTION_DM_TOKEN,
  dataSourceId = process.env.NOTION_DM_DATA_SOURCE_ID,
  fetchImpl = fetch,
  now = Date.now,
  ttlMs = CACHE_TTL_MS,
} = {}) {
  let cache = null;

  async function queryPage(cursor) {
    const response = await fetchImpl(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        filter: { property: "상태", status: { equals: PUBLISHED_STATUS } },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new InstagramDmError("NOTION_QUERY_FAILED", {
        transient: response.status >= 500 || response.status === 429,
      });
    }
    return response.json();
  }

  async function loadResources() {
    if (cache && now() - cache.loadedAt < ttlMs) return cache.resources;
    if (!token || !dataSourceId) throw new InstagramDmError("NOTION_NOT_CONFIGURED");

    const resources = [];
    let cursor;
    do {
      const body = await queryPage(cursor);
      for (const page of body?.results ?? []) {
        const resource = parseResourcePage(page);
        if (resource) resources.push(resource);
      }
      cursor = body?.has_more ? body.next_cursor : undefined;
    } while (cursor);

    cache = { loadedAt: now(), resources };
    return resources;
  }

  return {
    async findByComment(text) {
      const keyword = normalizeKeyword(text);
      if (!keyword) return null;
      const resources = await loadResources();
      return resources.find((resource) => resource.keyword === keyword) ?? null;
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run lib/instagram-dm/notion-resources.test.js`
Expected: 7 tests PASS

- [ ] **Step 5: 변경 요약**

---

### Task 3: 인스타 그래프 API 클라이언트

**Files:**
- Create: `lib/instagram-dm/graph-client.js`
- Test: `lib/instagram-dm/graph-client.test.js`

**Interfaces:**
- Consumes: `InstagramDmError` (Task 2)
- Produces:
  - `GRAPH_VERSION = "v23.0"`, `GRAPH_HOST = "https://graph.instagram.com"`
  - `textMessage(text) → { text }`
  - `buttonMessage(text, buttonTitle, payload) → { attachment: { type: "template", payload: { template_type: "button", text, buttons: [{ type: "postback", title, payload }] } } }`
  - `createGraphClient({ fetchImpl }) → {`
    - `sendPrivateReply({ token, accountId, commentId, message }): Promise<{ recipientId: string, messageId: string }>`
    - `sendMessage({ token, accountId, igsid, message }): Promise<{ recipientId, messageId }>`
    - `isFollowingBusiness({ token, igsid }): Promise<boolean>`
    - `refreshToken({ token }): Promise<{ accessToken: string, expiresIn: number }>` `}`
  - 오류 코드: `GRAPH_<error.code 또는 HTTP 상태>`. transient = HTTP 5xx·429, 또는 메타 코드 1·2·4·17·341.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/instagram-dm/graph-client.test.js`:

```js
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
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run lib/instagram-dm/graph-client.test.js`
Expected: FAIL (`Failed to load ./graph-client.js`)

- [ ] **Step 3: 구현**

`lib/instagram-dm/graph-client.js`:

```js
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
    const response = await fetchImpl(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(8000),
    });
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
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run lib/instagram-dm/graph-client.test.js`
Expected: 7 tests PASS

- [ ] **Step 5: 변경 요약**

---

### Task 4: DM 문구와 발송 상태 전이

**Files:**
- Create: `lib/instagram-dm/messages.js`
- Create: `lib/instagram-dm/delivery.js`
- Test: `lib/instagram-dm/delivery.test.js`

**Interfaces:**
- Consumes: `InstagramDmError` (T2), `normalizeKeyword` (T2), `textMessage`·`buttonMessage` (T3), 그래프 클라이언트 메서드 (T3), 노션 리더 `findByComment` (T2), `db.instagramDmDelivery`·`db.instagramCredential` (T1)
- Produces:
  - `CREDENTIAL_ID = "singleton"` (delivery.js 에서 export, T5 가 import)
  - `MAX_FOLLOW_CHECKS = 5`
  - `followPayload(deliveryId) → "FOLLOW_CHECK:<id>"`, `deliveryIdFromPayload(payload) → string | null`
  - `createDeliveryService({ db, graph, resources, now }) → {`
    - `handleComment({ accountId, comment: { id, text, fromId, mediaId } }): Promise<"ignored" | "duplicate" | "gate_sent" | "failed">`
    - `handleFollowCheck({ accountId, igsid, payload, text }): Promise<"ignored" | "link_sent" | "not_following">` `}`
  - 일시 오류는 그대로 던진다(웹훅이 503). 영구 오류는 댓글 단계에서 `FAILED` 로 기록, 팔로우 단계에서는 던진다(웹훅이 기록만).

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/instagram-dm/delivery.test.js`:

```js
import { describe, expect, it, vi } from "vitest";

import { InstagramDmError } from "./errors.js";
import { CREDENTIAL_ID, MAX_FOLLOW_CHECKS, createDeliveryService, deliveryIdFromPayload, followPayload } from "./delivery.js";
import { FOLLOW_BUTTON_TITLE, NOT_FOLLOWING_TEXT, gateText, gateTextFallback, linkText } from "./messages.js";

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
    ...overrides,
  };
}

function setup({ db = createFakeDb(), graph = createFakeGraph(), resource = RESOURCE } = {}) {
  const resources = { findByComment: vi.fn(async () => resource) };
  const service = createDeliveryService({ db, graph, resources, now: () => NOW });
  return { db, graph, resources, service };
}

const comment = (overrides = {}) => ({ accountId: ACCOUNT, comment: { id: "c-1", text: "금지어", fromId: "user-1", mediaId: "m-1", ...overrides } });

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
  });

  it("ignores its own comments, unknown keywords and other accounts", async () => {
    const own = setup();
    expect(await own.service.handleComment(comment({ fromId: ACCOUNT }))).toBe("ignored");
    expect(own.resources.findByComment).not.toHaveBeenCalled();

    const unknown = setup({ resource: null });
    expect(await unknown.service.handleComment(comment())).toBe("ignored");
    expect(unknown.graph.sendPrivateReply).not.toHaveBeenCalled();

    const other = setup();
    expect(await other.service.handleComment({ ...comment(), accountId: "someone-else" })).toBe("ignored");
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

  it("ignores text replies to gates older than 7 days", async () => {
    const { db, service, row } = await gated();
    db.rows.get(row.id).createdAt = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000);
    expect(await service.handleFollowCheck({ accountId: ACCOUNT, igsid: "igsid-1", payload: undefined, text: "팔로우" })).toBe("ignored");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run lib/instagram-dm/delivery.test.js`
Expected: FAIL (`Failed to load ./delivery.js`)

- [ ] **Step 3: 문구 작성**

`lib/instagram-dm/messages.js` (설계 문서 초안 그대로 — 바꾸려면 계정 주인 검수):

```js
// 인스타 자동 DM 문구. 계정 주인 검수 전에는 바꾸지 않는다(설계 문서 2026-10-23 초안).
export const FOLLOW_BUTTON_TITLE = "팔로우했어요 ✅";
const FOLLOW_TEXT_HINT = "팔로우 완료";

export function gateText(title) {
  return `안녕하세요! 한시예요 🙌 댓글 고마워요. '${title}' 바로 보내 드릴게요. @hansionair 팔로우하고 아래 버튼만 눌러 주세요!`;
}

/** 댓글 답장 DM 에 버튼을 못 붙일 때(메타가 템플릿을 거절할 때) 쓰는 글자 안내. */
export function gateTextFallback(title) {
  return `안녕하세요! 한시예요 🙌 댓글 고마워요. '${title}' 바로 보내 드릴게요. @hansionair 팔로우하고 이 DM에 '${FOLLOW_TEXT_HINT}'라고 답장해 주세요!`;
}

export function linkText(title, url) {
  return `📩 ${title}\n${url}\n저장해 두고 필요할 때 꺼내 보세요!`;
}

export const NOT_FOLLOWING_TEXT = "아직 팔로우가 안 보여요 🥲 @hansionair 팔로우하고 다시 눌러 주세요!";
export const NOT_FOLLOWING_TEXT_FALLBACK = `아직 팔로우가 안 보여요 🥲 @hansionair 팔로우하고 다시 '${FOLLOW_TEXT_HINT}'라고 답장해 주세요!`;
```

- [ ] **Step 4: 상태 전이 구현**

`lib/instagram-dm/delivery.js`:

```js
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
    try {
      const sent = await sendWithTextFallback(
        send,
        buttonMessage(gateText(resource.title), FOLLOW_BUTTON_TITLE, followPayload(delivery.id)),
        textMessage(gateTextFallback(resource.title)),
      );
      await db.instagramDmDelivery.update({ where: { id: delivery.id }, data: { status: "GATE_SENT", igsid: sent.recipientId } });
      return "gate_sent";
    } catch (error) {
      if (isPermanent(error)) {
        await db.instagramDmDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", failureCode: error.code } });
        return "failed";
      }
      // 아무것도 보내지 못했으니 기록을 지워 메타 재전송 때 다시 시도하게 한다.
      await db.instagramDmDelivery.delete({ where: { id: delivery.id } });
      throw error;
    }
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
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm exec vitest run lib/instagram-dm/delivery.test.js`
Expected: 12 tests PASS

- [ ] **Step 6: 변경 요약**

---

### Task 5: 토큰 갱신·기록 정리와 크론 연결

**Files:**
- Create: `lib/instagram-dm/credential.js`
- Test: `lib/instagram-dm/credential.test.js`
- Modify: `api/cron/purge-deleted-users.js` (import 부분, 팩토리 인자, `purgeExpiredRateLimitBuckets` 다음 줄)
- Modify test: `tests/api/account/deletion.test.js` (기존 크론 케이스 근처에 1개 추가)

**Interfaces:**
- Consumes: `CREDENTIAL_ID` (T4), `createGraphClient().refreshToken` (T3)
- Produces:
  - `REFRESH_AFTER_MS = 30일`, `DELIVERY_RETENTION_MS = 365일`
  - `saveInstagramCredential({ db, accountId, accessToken, expiresIn, now }): Promise<void>` (T7 스크립트가 사용)
  - `refreshInstagramTokenIfDue({ db, graph, now }): Promise<"missing" | "skipped" | "refreshed">` (실패는 던짐)
  - `purgeExpiredInstagramDeliveries({ db, now }): Promise<number>`
  - `runInstagramMaintenance({ db, graph, now, logger }): Promise<{ token: string, purgedDeliveries: number | null }>` — **절대 던지지 않는다**(계정 삭제 크론을 막지 않게)

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/instagram-dm/credential.test.js`:

```js
import { describe, expect, it, vi } from "vitest";

import { InstagramDmError } from "./errors.js";
import {
  DELIVERY_RETENTION_MS,
  REFRESH_AFTER_MS,
  purgeExpiredInstagramDeliveries,
  refreshInstagramTokenIfDue,
  runInstagramMaintenance,
  saveInstagramCredential,
} from "./credential.js";

const NOW = new Date("2026-10-23T03:00:00.000Z");

function dbWith(row) {
  return {
    instagramCredential: {
      findUnique: vi.fn(async () => row),
      update: vi.fn(async () => row),
      upsert: vi.fn(async () => row),
    },
    instagramDmDelivery: { deleteMany: vi.fn(async () => ({ count: 3 })) },
  };
}

describe("saveInstagramCredential", () => {
  it("upserts the single row with an absolute expiry", async () => {
    const db = dbWith(null);
    await saveInstagramCredential({ db, accountId: "acc", accessToken: "tok", expiresIn: 60, now: NOW });
    const expected = { accountId: "acc", accessToken: "tok", expiresAt: new Date(NOW.getTime() + 60_000), refreshedAt: NOW };
    expect(db.instagramCredential.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: { id: "singleton", ...expected },
      update: expected,
    });
  });
});

describe("refreshInstagramTokenIfDue", () => {
  it("does nothing without a connected account or before 30 days", async () => {
    const graph = { refreshToken: vi.fn() };
    expect(await refreshInstagramTokenIfDue({ db: dbWith(null), graph, now: NOW })).toBe("missing");
    const fresh = dbWith({ accessToken: "old", refreshedAt: new Date(NOW.getTime() - REFRESH_AFTER_MS + 1) });
    expect(await refreshInstagramTokenIfDue({ db: fresh, graph, now: NOW })).toBe("skipped");
    expect(graph.refreshToken).not.toHaveBeenCalled();
  });

  it("refreshes and stores the new token after 30 days", async () => {
    const db = dbWith({ accessToken: "old", refreshedAt: new Date(NOW.getTime() - REFRESH_AFTER_MS) });
    const graph = { refreshToken: vi.fn(async () => ({ accessToken: "new", expiresIn: 5184000 })) };

    expect(await refreshInstagramTokenIfDue({ db, graph, now: NOW })).toBe("refreshed");
    expect(graph.refreshToken).toHaveBeenCalledWith({ token: "old" });
    expect(db.instagramCredential.update).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: { accessToken: "new", expiresAt: new Date(NOW.getTime() + 5184000 * 1000), refreshedAt: NOW },
    });
  });
});

describe("purgeExpiredInstagramDeliveries", () => {
  it("deletes rows older than a year", async () => {
    const db = dbWith(null);
    expect(await purgeExpiredInstagramDeliveries({ db, now: NOW })).toBe(3);
    expect(db.instagramDmDelivery.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date(NOW.getTime() - DELIVERY_RETENTION_MS) } },
    });
  });
});

describe("runInstagramMaintenance", () => {
  it("never throws and logs only codes", async () => {
    const db = dbWith({ accessToken: "secret-token", refreshedAt: new Date(0) });
    db.instagramDmDelivery.deleteMany.mockRejectedValue(new Error("db down"));
    const graph = { refreshToken: vi.fn(async () => { throw new InstagramDmError("GRAPH_190"); }) };
    const logger = { warn: vi.fn() };

    await expect(runInstagramMaintenance({ db, graph, now: NOW, logger })).resolves.toEqual({ token: "failed", purgedDeliveries: null });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("secret-token");
    expect(logger.warn).toHaveBeenCalledWith("[instagram-dm] token refresh failed", { code: "GRAPH_190" });
  });

  it("survives a db without the instagram tables (older test doubles)", async () => {
    await expect(runInstagramMaintenance({ db: {}, graph: {}, now: NOW, logger: { warn: vi.fn() } })).resolves.toEqual({
      token: "failed",
      purgedDeliveries: null,
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run lib/instagram-dm/credential.test.js`
Expected: FAIL (`Failed to load ./credential.js`)

- [ ] **Step 3: 구현**

`lib/instagram-dm/credential.js`:

```js
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
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run lib/instagram-dm/credential.test.js`
Expected: 6 tests PASS

- [ ] **Step 5: 크론 테스트 추가(실패)**

`tests/api/account/deletion.test.js` 의 크론 케이스(`expect(res.body).toEqual({ purged: 1 })` 가 있는 `it`) 바로 뒤에 추가. 기존 케이스의 요청·인증 헤더 만드는 방식을 그대로 복사해 쓴다(파일 상단의 헬퍼를 먼저 읽을 것):

```js
  it("runs instagram maintenance after the purge without changing the response", async () => {
    const instagramMaintenance = vi.fn(async () => ({ token: "skipped", purgedDeliveries: 0 }));
    const handler = createPurgeDeletedAccountsHandler({
      cronSecret: "cron-secret",
      purgeAccounts: vi.fn(async () => ({ purged: 1 })),
      instagramMaintenance,
    });
    const res = createResponse();

    await handler({ method: "GET", headers: { authorization: "Bearer cron-secret" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ purged: 1 });
    expect(instagramMaintenance).toHaveBeenCalledTimes(1);
  });
```

Run: `pnpm exec vitest run tests/api/account/deletion.test.js`
Expected: 새 케이스 FAIL (`instagramMaintenance` 호출 0회)

- [ ] **Step 6: 크론에 연결**

`api/cron/purge-deleted-users.js`:

import 추가(기존 import 알파벳 순서 근처):

```js
import { runInstagramMaintenance } from "../../lib/instagram-dm/credential.js";
import { createGraphClient } from "../../lib/instagram-dm/graph-client.js";
```

팩토리 인자에 추가:

```js
export function createPurgeDeletedAccountsHandler({
  cronSecret = process.env.CRON_SECRET,
  db = prisma,
  getAdminClient = getSupabaseAdminClient,
  purgeAccounts = purgeDueAccounts,
  instagramMaintenance = () => runInstagramMaintenance({ db, graph: createGraphClient() }),
} = {}) {
```

`await purgeExpiredRateLimitBuckets({ db });` 다음 줄에 추가:

```js
      // 인스타 자동 DM 토큰 갱신(30일마다)·발송 기록 1년 정리. 실패해도 계정 삭제 결과는 그대로 돌려준다.
      await instagramMaintenance();
```

- [ ] **Step 7: 통과 확인**

Run: `pnpm exec vitest run tests/api/account/deletion.test.js lib/instagram-dm/credential.test.js`
Expected: 전부 PASS (기존 케이스 포함 — 기존 케이스는 기본값 `runInstagramMaintenance` 가 목 DB 에서 실패해도 삼키므로 영향 없음)

- [ ] **Step 8: 변경 요약**

---

### Task 6: 웹훅 핸들러와 라우팅

**Files:**
- Create: `lib/instagram-dm/webhook.js`
- Test: `tests/api/instagram-webhook.test.js`
- Modify: `api/entitlements.js` (import, `isGrobleWebhookPath` 옆 판별 함수, `handler` 첫 분기)
- Modify: `vercel.json` (`/api/webhooks/groble` rewrite 바로 다음)
- Modify: `vite.config.ts:31-32` (groble 매핑 바로 다음)
- Modify test: `tests/security/deployment-security.test.js:36-39`, `:94`

**Interfaces:**
- Consumes: `createDeliveryService` (T4), `createGraphClient` (T3), `createNotionResourceReader` (T2), `InstagramDmError` (T2)
- Produces:
  - `verifyMetaSignature({ rawBody, signature, secret }): boolean`
  - `extractEvents(body): Array<{ type: "comment", accountId, comment } | { type: "follow_check", accountId, igsid, payload, text }>`
  - `createInstagramWebhookHandler({ appSecret, verifyToken, enabled, getService, logger }) → (req, res) => Promise`
  - default export: 실제 의존성으로 만든 핸들러

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/api/instagram-webhook.test.js`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run tests/api/instagram-webhook.test.js`
Expected: FAIL (`Failed to load ../../lib/instagram-dm/webhook.js`)

- [ ] **Step 3: 구현**

`lib/instagram-dm/webhook.js`:

```js
// 인스타 웹훅(comments·messages·messaging_postbacks). 12함수 한도 때문에 전용 api 파일 대신
// api/entitlements.js 가 rewrite(/api/webhooks/instagram)로 이 핸들러에 위임한다(bodyParser 꺼짐 → 원문 서명 검증).
import { createHmac, timingSafeEqual } from "node:crypto";

import prisma from "../prisma.js";
import { isRecord } from "../sanitize.js";
import { createDeliveryService } from "./delivery.js";
import { InstagramDmError } from "./errors.js";
import { createGraphClient } from "./graph-client.js";
import { createNotionResourceReader } from "./notion-resources.js";

export function verifyMetaSignature({ rawBody, signature, secret }) {
  if (!secret || typeof rawBody !== "string" || typeof signature !== "string" || !signature.startsWith("sha256=")) {
    return false;
  }
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"));
  const received = Buffer.from(signature.slice("sha256=".length));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function extractEvents(body) {
  if (!isRecord(body) || body.object !== "instagram" || !Array.isArray(body.entry)) return [];
  const events = [];
  for (const entry of body.entry) {
    const accountId = String(entry?.id ?? "");
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      if (change?.field !== "comments" || !isRecord(value)) continue;
      events.push({
        type: "comment",
        accountId,
        comment: { id: value.id, text: value.text ?? "", fromId: value.from?.id, mediaId: value.media?.id },
      });
    }
    for (const messaging of entry?.messaging ?? []) {
      const igsid = messaging?.sender?.id;
      if (!igsid || igsid === accountId || messaging?.message?.is_echo) continue;
      if (isRecord(messaging.postback)) {
        events.push({ type: "follow_check", accountId, igsid, payload: messaging.postback.payload, text: "" });
      } else if (isRecord(messaging.message)) {
        events.push({
          type: "follow_check",
          accountId,
          igsid,
          payload: messaging.message.quick_reply?.payload,
          text: messaging.message.text ?? "",
        });
      }
    }
  }
  return events;
}

async function readRawBody(req) {
  if (typeof req?.rawBody === "string") return req.rawBody;
  if (Buffer.isBuffer(req?.rawBody)) return req.rawBody.toString("utf8");
  if (!req || typeof req[Symbol.asyncIterator] !== "function") return "";
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function headerOf(req, name) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function answerVerification(req, res, verifyToken) {
  const query = req.query ?? {};
  const challenge = query["hub.challenge"];
  if (query["hub.mode"] === "subscribe" && verifyToken && query["hub.verify_token"] === verifyToken && typeof challenge === "string") {
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).end(challenge);
  }
  return res.status(403).json({ error: "INSTAGRAM_WEBHOOK_VERIFY_FAILED" });
}

export function createInstagramWebhookHandler({
  appSecret = process.env.INSTAGRAM_APP_SECRET,
  verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
  enabled = process.env.INSTAGRAM_DM_ENABLED === "1",
  getService,
  logger = console,
} = {}) {
  return async function instagramWebhookHandler(req, res) {
    if (req.method === "GET") return answerVerification(req, res, verifyToken);
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const rawBody = await readRawBody(req);
    if (!verifyMetaSignature({ rawBody, signature: headerOf(req, "x-hub-signature-256"), secret: appSecret })) {
      return res.status(401).json({ error: "INSTAGRAM_WEBHOOK_SIGNATURE_INVALID" });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: "MALFORMED_INSTAGRAM_PAYLOAD" });
    }
    if (!enabled) return res.status(200).json({ received: true, processed: 0 });

    const service = getService();
    const results = [];
    for (const event of extractEvents(body)) {
      try {
        results.push(event.type === "comment" ? await service.handleComment(event) : await service.handleFollowCheck(event));
      } catch (error) {
        const code = error instanceof InstagramDmError ? error.code : "UNEXPECTED";
        if (error instanceof InstagramDmError && !error.transient) {
          logger.warn("[instagram-dm] event failed", { code, type: event.type });
          results.push("failed");
          continue;
        }
        // 메타가 같은 알림을 다시 보내게 한다. 이미 처리한 앞 이벤트는 유니크·상태 검사로 다시 보내지지 않는다.
        logger.error("[instagram-dm] transient failure", { code, type: event.type });
        return res.status(503).json({ error: "INSTAGRAM_DM_RETRY" });
      }
    }
    logger.info("[instagram-dm] processed", { results });
    return res.status(200).json({ received: true, processed: results.length });
  };
}

// 노션 캐시가 따뜻한 인스턴스에서 이어지도록 서비스는 모듈에 한 번만 만든다.
let defaultService;
function getDefaultService() {
  defaultService ??= createDeliveryService({
    db: prisma,
    graph: createGraphClient(),
    resources: createNotionResourceReader(),
  });
  return defaultService;
}

export default createInstagramWebhookHandler({ getService: getDefaultService });
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run tests/api/instagram-webhook.test.js`
Expected: 11 tests PASS

- [ ] **Step 5: 배포 보안 테스트를 먼저 고친다(실패)**

`tests/security/deployment-security.test.js` 의 `"keeps the payment pipeline inside the entitlements function..."` 안, groble `toContainEqual` 블록 다음에 추가:

```js
    // 인스타 자동 DM 웹훅도 같은 이유(12함수·원문 서명)로 entitlements 에 합류한다.
    expect(existsSync(`${root}/api/webhooks/instagram.js`)).toBe(false);
    expect(config.rewrites).toContainEqual({
      source: "/api/webhooks/instagram",
      destination: "/api/entitlements?instagramWebhook=1",
    });
```

같은 파일 `expect(config.rewrites).toEqual([` 목록에서 groble 줄 바로 다음에:

```js
      { source: "/api/webhooks/instagram", destination: "/api/entitlements?instagramWebhook=1" },
```

Run: `pnpm exec vitest run tests/security/deployment-security.test.js`
Expected: FAIL (rewrite 없음)

- [ ] **Step 6: 라우팅 연결**

`vercel.json` — groble rewrite 객체 바로 다음에:

```json
    {
      "source": "/api/webhooks/instagram",
      "destination": "/api/entitlements?instagramWebhook=1"
    },
```

`vite.config.ts` — groble 매핑 두 줄 바로 다음에:

```ts
  // 인스타 웹훅도 서명을 원문으로 검증한다(lib/instagram-dm/webhook.js)
  if (pathname === "/api/webhooks/instagram")
    return { file: "api/entitlements.js", query: { instagramWebhook: "1" }, raw: true };
```

`api/entitlements.js`:

import 블록에 (groble 핸들러 import 다음 줄):

```js
import instagramWebhookHandler from "../lib/instagram-dm/webhook.js";
```

`isGrobleWebhookPath` 함수 다음에:

```js
function isInstagramWebhookPath(req) {
  if (req.query?.instagramWebhook === "1") {
    return true;
  }
  return pathnameOf(req) === "/api/webhooks/instagram";
}
```

`handler` 의 `try {` 바로 안, groble 분기 앞에:

```js
    // 인스타 웹훅도 메타 서버가 호출하므로 사용자 인증 대신 X-Hub-Signature-256 으로 검증한다.
    if (isInstagramWebhookPath(req)) {
      return await instagramWebhookHandler(req, res);
    }
```

파일 상단 `config` 주석의 "Groble 웹훅은" 을 "Groble·인스타 웹훅은" 으로 고친다.

- [ ] **Step 7: 통과 확인**

Run: `pnpm exec vitest run tests/security/deployment-security.test.js tests/api/entitlements.test.js tests/api/groble-webhook-handler.test.js tests/api/instagram-webhook.test.js scripts/vercel-function-limit.test.js`
Expected: 전부 PASS. `tests/api/entitlements.test.js` 가 새 import 때문에 실패하면, 그 파일의 기존 `vi.mock("../../lib/billing/groble-webhook-handler.js", ...)` 옆에 `vi.mock("../../lib/instagram-dm/webhook.js", () => ({ default: vi.fn() }));` 를 추가한다.

- [ ] **Step 8: 타입 체크**

Run: `pnpm check`
Expected: 오류 없음(`vite.config.ts` 를 고쳤으므로)

- [ ] **Step 9: 변경 요약**

---

### Task 7: 최초 연결 스크립트

**Files:**
- Create: `scripts/instagram-dm.mjs`
- Test: `scripts/instagram-dm.test.js`

**Interfaces:**
- Consumes: `saveInstagramCredential` (T5), `GRAPH_HOST`·`GRAPH_VERSION` (T3), `prisma` (`lib/prisma.js` named export)
- Produces: CLI
  - `node scripts/instagram-dm.mjs url` — 로그인 주소 출력
  - `INSTAGRAM_CONFIRM=1 node scripts/instagram-dm.mjs connect <리다이렉트 주소 또는 code>` — 코드 교환 → 장기 토큰 → 계정 확인 → 웹훅 구독 → DB 저장(**운영 DB**)
  - `node scripts/instagram-dm.mjs status` — 계정 ID·만료일·갱신일(토큰은 출력 안 함)
  - export: `SCOPES`, `buildAuthorizeUrl({ appId, redirectUri })`, `extractCode(input)`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/instagram-dm.test.js`:

```js
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({ prisma: {}, default: {} }));

const { SCOPES, buildAuthorizeUrl, extractCode } = await import("./instagram-dm.mjs");

describe("instagram-dm script helpers", () => {
  it("builds the Instagram business login URL with the three scopes", () => {
    const url = new URL(buildAuthorizeUrl({ appId: "123", redirectUri: "https://pre-view.me/" }));
    expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://pre-view.me/");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(SCOPES.join(","));
    expect(SCOPES).toEqual([
      "instagram_business_basic",
      "instagram_business_manage_comments",
      "instagram_business_manage_messages",
    ]);
  });

  it("extracts the code from a pasted redirect URL or a bare code, dropping #_", () => {
    expect(extractCode("https://pre-view.me/?code=AQBx123#_")).toBe("AQBx123");
    expect(extractCode("AQBx123#_")).toBe("AQBx123");
    expect(extractCode("  AQBx123  ")).toBe("AQBx123");
    expect(extractCode("")).toBe("");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run scripts/instagram-dm.test.js`
Expected: FAIL (`Failed to load ./instagram-dm.mjs`)

- [ ] **Step 3: 구현**

`scripts/instagram-dm.mjs`:

```js
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
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run scripts/instagram-dm.test.js`
Expected: 2 tests PASS

Run: `node scripts/instagram-dm.mjs`
Expected: `사용법: node scripts/instagram-dm.mjs url | connect <주소|code> | status` (DB·네트워크 호출 없음)

- [ ] **Step 5: 변경 요약**

---

### Task 8: 개인정보처리방침 문장 (계정 주인 검수)

**Files:**
- Modify: `client/src/pages/Privacy.tsx` — 1번 섹션 `groups` 끝, 3번 섹션 `table.rows`, 8번 섹션 `footer`

**Interfaces:** 없음(화면 문구만)

- [ ] **Step 1: 1번 섹션 `groups` 배열 끝("결제 서비스 이용 시" 그룹 뒤)에 추가**

```tsx
      {
        title: "인스타그램 자동 DM 신청 시",
        items: ["인스타그램 앱 전용 사용자 식별값", "댓글 번호와 신청 키워드", "자료 DM 발송 기록"],
        note: "댓글 본문과 인스타그램 사용자 이름은 저장하지 않습니다.",
      },
```

- [ ] **Step 2: 3번 섹션 `rows` 의 "서비스 이용 기록" 줄 다음에 추가**

```tsx
        ["인스타그램 자동 DM 발송 기록", "발송 후 1년까지"],
```

- [ ] **Step 3: 8번 섹션 `footer` 문자열 끝에 이어 붙이기**

```
 인스타그램 자동 DM 발송 기록의 삭제는 인스타그램 @hansionair DM 또는 아래 문의처로 요청할 수 있습니다.
```

(문자열 안 마지막 마침표 뒤에 공백 하나 두고 붙인다.)

- [ ] **Step 4: 확인**

Run: `pnpm check && pnpm exec vitest run client/src/pages` (Privacy 관련 테스트가 없으면 `pnpm check` 만)
Expected: 오류 없음

- [ ] **Step 5: 변경 요약** — "계정 주인 검수 필요한 문장 3곳"으로 따로 적는다.

---

### Task 9: 마무리 검증과 계정 주인 안내

- [ ] **Step 1: 관련 테스트 묶음 실행**

Run:
```bash
pnpm exec vitest run lib/instagram-dm tests/api/instagram-webhook.test.js tests/api/instagram-dm-migration.test.js tests/api/account/deletion.test.js tests/api/entitlements.test.js tests/api/groble-webhook-handler.test.js tests/security/deployment-security.test.js scripts/vercel-function-limit.test.js scripts/instagram-dm.test.js
```
Expected: 전부 PASS

- [ ] **Step 2: 전체 테스트(환경이 되면)**

Run: `pnpm exec vitest run`
Expected: 0 실패(기준선: `Checkout.test` 부하 타임아웃 플레이크만 허용). 못 돌렸으면 못 돌렸다고 보고.

- [ ] **Step 3: `.env.example` 플레이스홀더**

아래 줄을 `.env.example` 끝에 추가한다. 이 파일 읽기가 권한 규칙으로 막히면 건너뛰고 "계정 주인이 추가할 것"으로 보고에 적는다:

```
# 인스타 자동 DM (서버 전용)
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_REDIRECT_URI=https://pre-view.me/
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=
INSTAGRAM_DM_ENABLED=0
NOTION_DM_TOKEN=
NOTION_DM_DATA_SOURCE_ID=ba65767c-c77f-44aa-8d1d-230d19ad3b00
```

- [ ] **Step 4: 완료 보고(CLAUDE.md 형식: 가정/변경/검증/남은 위험)와 커밋 승인 요청** — 커밋은 승인 뒤 한 번에(관련 파일만 스테이징, 기존 미커밋 변경은 건드리지 않음).

- [ ] **Step 5: 계정 주인 연결 안내 전달** (아래 "연결 순서"를 채팅으로 쉽게 풀어서)

## 연결 순서 (계정 주인, 코드 머지·배포 후)

1. 인스타 → 크리에이터 계정 전환.
2. developers.facebook.com → 앱(스레드 앱에 사용 사례 추가 또는 새 앱) → **Instagram API(Instagram 로그인)** 사용 사례 추가.
   - "Instagram 비즈니스 로그인" 설정에 리다이렉트 URI `https://pre-view.me/` 등록
   - 권한 3개(`instagram_business_basic`·`_manage_comments`·`_manage_messages`)
   - 앱 설정에 개인정보처리방침 URL `https://pre-view.me/privacy`
   - 이 화면의 **Instagram 앱 ID·앱 시크릿**을 적어 둔다(메타 앱 시크릿과 다름)
3. 노션 → 설정 → 연결 → 내부 연동 만들기(읽기 권한만) → "자동 DM 배포용" 페이지 ⋯ → 연결 추가.
4. Vercel 환경변수(Production): 위 `.env.example` 항목들. `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` 은 아무 긴 무작위 문자열. `INSTAGRAM_DM_ENABLED=0` 으로 시작.
5. 운영 DB 마이그레이션(`20261023_add_instagram_dm`) 실행 지시 → 에이전트가 실행.
6. 재배포 후 메타 앱 웹훅 설정: 콜백 `https://pre-view.me/api/webhooks/instagram`, 확인 토큰 = 4번 값 → "확인 및 저장" → 필드 `comments`·`messages`·`messaging_postbacks` 구독.
7. 로컬 `.env` 에 `INSTAGRAM_APP_ID`·`INSTAGRAM_APP_SECRET`·`INSTAGRAM_REDIRECT_URI` 넣고 `node scripts/instagram-dm.mjs url` → 브라우저 로그인 → 이동한 주소 복사 → `INSTAGRAM_CONFIRM=1 node scripts/instagram-dm.mjs connect "<주소>"`.
8. 노션에서 자료 1개만 상태를 `공개·DM 연결` + `공개 링크` 채우기 → Vercel `INSTAGRAM_DM_ENABLED=1` → 재배포.
9. 시험: 본인 계정 → 키워드 댓글 → 첫 DM·버튼·링크 확인. 이어서 앱 역할 없는 다른 계정으로 확인 → 안 오면 앱 심사 신청(별도 과제).
