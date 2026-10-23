import { describe, expect, it, vi } from "vitest";

import { InstagramDmError } from "./errors.js";
import {
  PUBLISHED_STATUS,
  createNotionResourceReader,
  normalizeKeyword,
  parseResourcePage,
} from "./notion-resources.js";

function page({ id = "page-1", title = "자소서 금지어 사전", keyword = "금지어", url = "https://hansi.notion.site/x", gate, link } = {}) {
  return {
    id,
    properties: {
      이름: { type: "title", title: title === null ? [] : [{ plain_text: title }] },
      "DM 키워드": { type: "rich_text", rich_text: keyword === null ? [] : [{ plain_text: keyword }] },
      "공개 링크": { type: "url", url },
      ...(gate === undefined ? {} : { "첫 DM 문구": { type: "rich_text", rich_text: [{ plain_text: gate }] } }),
      ...(link === undefined ? {} : { "링크 DM 문구": { type: "rich_text", rich_text: [{ plain_text: link }] } }),
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
      gateMessage: null,
      linkMessage: null,
    });
    expect(parseResourcePage(page({ title: null }))).toBeNull();
    expect(parseResourcePage(page({ keyword: null }))).toBeNull();
    expect(parseResourcePage(page({ url: null }))).toBeNull();
    expect(parseResourcePage(page({ url: "http://insecure.example" }))).toBeNull();
  });

  it("DB 열 길이(제목 200·키워드 50·링크 500)를 넘으면 자료로 보지 않는다", () => {
    expect(parseResourcePage(page({ title: "가".repeat(200) }))).not.toBeNull();
    expect(parseResourcePage(page({ title: "가".repeat(201) }))).toBeNull();
    expect(parseResourcePage(page({ keyword: "가".repeat(50) }))).not.toBeNull();
    expect(parseResourcePage(page({ keyword: "가".repeat(51) }))).toBeNull();
    expect(parseResourcePage(page({ url: `https://hansi.notion.site/${"a".repeat(474)}` }))).not.toBeNull();
    expect(parseResourcePage(page({ url: `https://hansi.notion.site/${"a".repeat(475)}` }))).toBeNull();
  });
});

describe("자료별 DM 문구", () => {
  it("첫 DM 문구·링크 DM 문구 칸을 읽고, 비었거나 500자를 넘으면 기본 문구(null)로 둔다", () => {
    expect(parseResourcePage(page({ gate: " 금지어 바로 드려요! ", link: "약속한 자료예요" }))).toMatchObject({
      gateMessage: "금지어 바로 드려요!",
      linkMessage: "약속한 자료예요",
    });
    expect(parseResourcePage(page({ gate: "", link: "  " }))).toMatchObject({ gateMessage: null, linkMessage: null });
    expect(parseResourcePage(page({ gate: "가".repeat(500) })).gateMessage).toHaveLength(500);
    expect(parseResourcePage(page({ gate: "가".repeat(501) })).gateMessage).toBeNull();
  });

  it("링크 DM 때 페이지 번호로 자료를 다시 찾는다", async () => {
    const fetchImpl = vi.fn(async () => notionResponse([page({ link: "약속한 자료예요" }), page({ id: "page-2", keyword: "경험" })]));
    const reader = createNotionResourceReader({ token: "secret", dataSourceId: "ds-1", fetchImpl });

    expect((await reader.findByPageId("page-1"))?.linkMessage).toBe("약속한 자료예요");
    expect(await reader.findByPageId("page-9")).toBeNull();
    expect(await reader.findByPageId(null)).toBeNull();
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

  it("네트워크 오류·타임아웃·깨진 응답도 일시 오류로 바꿔 던진다", async () => {
    const timeout = createNotionResourceReader({
      token: "t",
      dataSourceId: "d",
      fetchImpl: async () => {
        throw new DOMException("secret-detail", "TimeoutError");
      },
    });
    const timeoutError = await timeout.findByComment("금지어").catch((e) => e);
    expect(timeoutError).toBeInstanceOf(InstagramDmError);
    expect(timeoutError).toMatchObject({ code: "NOTION_QUERY_FAILED", transient: true });
    expect(timeoutError.message).toBe("NOTION_QUERY_FAILED");

    const brokenJson = createNotionResourceReader({
      token: "t",
      dataSourceId: "d",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      }),
    });
    await expect(brokenJson.findByComment("금지어")).rejects.toMatchObject({ code: "NOTION_QUERY_FAILED", transient: true });
  });
});
