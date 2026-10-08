import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    siteNotice: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({ requireAdministrator: mocks.requireAdministrator }));
vi.mock("../../../lib/prisma.js", () => ({ default: mocks.prisma }));

const { noticesHandler, noticeDetailHandler } = await import("../../../lib/admin-handlers/notices.js");
import { createResponse } from "../../helpers/http.js";

const ADMIN = { applicationUser: { id: "11111111-1111-4111-8111-111111111111", role: "admin" } };
const EXISTING = {
  id: "n1", kind: "POPUP", title: "안내", body: "", active: false,
  startsAt: new Date("2026-10-10T00:00:00Z"), endsAt: null,
};

async function call(handler, { method = "GET", body, query = {} } = {}) {
  const res = createResponse();
  await handler({ method, body, query, headers: {} }, res);
  return res;
}

describe("admin notices — 공지 관리", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdministrator.mockResolvedValue(ADMIN);
    mocks.prisma.siteNotice.findMany.mockResolvedValue([]);
    mocks.prisma.siteNotice.findUnique.mockResolvedValue(EXISTING);
    mocks.prisma.siteNotice.create.mockImplementation(async ({ data }) => ({ id: "new", ...data }));
    mocks.prisma.siteNotice.update.mockImplementation(async ({ data }) => ({ ...EXISTING, ...data }));
    mocks.prisma.auditEvent.create.mockResolvedValue({});
  });

  it("관리자가 아니면 401/403 이고 DB 를 건드리지 않는다", async () => {
    for (const statusCode of [401, 403]) {
      mocks.requireAdministrator.mockRejectedValueOnce(Object.assign(new Error("x"), { statusCode }));
      const res = await call(noticesHandler, { method: "POST", body: { kind: "BANNER", title: "t" } });
      expect(res.statusCode).toBe(statusCode);
    }
    expect(mocks.prisma.siteNotice.create).not.toHaveBeenCalled();
  });

  it("목록은 최근 만든 순으로 100개까지", async () => {
    const res = await call(noticesHandler);
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.siteNotice.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "desc" }, take: 100 });
  });

  it("만들기: 검증을 통과하면 201, 감사 기록엔 id 만 남긴다", async () => {
    const res = await call(noticesHandler, { method: "POST", body: { kind: "BANNER", title: "점검 안내", body: "본문", active: true } });
    expect(res.statusCode).toBe(201);
    expect(mocks.prisma.siteNotice.create).toHaveBeenCalledWith({ data: { kind: "BANNER", title: "점검 안내", body: "본문", active: true } });
    const audit = mocks.prisma.auditEvent.create.mock.calls[0][0].data;
    expect(audit).toEqual(expect.objectContaining({ outcome: "NOTICE_CREATED", targetId: "new", targetType: "site_notice" }));
    expect(JSON.stringify(audit)).not.toContain("점검");
  });

  it("만들기: 잘못된 입력은 400", async () => {
    const res = await call(noticesHandler, { method: "POST", body: { kind: "POPUP", title: "x", linkUrl: "javascript:alert(1)" } });
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.siteNotice.create).not.toHaveBeenCalled();
  });

  it("고치기: 온 필드만 바꾸고, 저장된 시작보다 앞선 끝은 400", async () => {
    const ok = await call(noticeDetailHandler, { method: "PATCH", query: { id: "n1" }, body: { active: true } });
    expect(ok.statusCode).toBe(200);
    expect(mocks.prisma.siteNotice.update).toHaveBeenCalledWith({ where: { id: "n1" }, data: { active: true } });

    const bad = await call(noticeDetailHandler, { method: "PATCH", query: { id: "n1" }, body: { endsAt: "2026-10-09T00:00:00Z" } });
    expect(bad.statusCode).toBe(400);
  });

  it("없는 공지는 404, 지우기는 감사 기록을 남긴다", async () => {
    mocks.prisma.siteNotice.findUnique.mockResolvedValueOnce(null);
    const missing = await call(noticeDetailHandler, { method: "DELETE", query: { id: "nope" } });
    expect(missing.statusCode).toBe(404);

    const deleted = await call(noticeDetailHandler, { method: "DELETE", query: { id: "n1" } });
    expect(deleted.statusCode).toBe(200);
    expect(mocks.prisma.siteNotice.delete).toHaveBeenCalledWith({ where: { id: "n1" } });
    expect(mocks.prisma.auditEvent.create.mock.calls.at(-1)[0].data.outcome).toBe("NOTICE_DELETED");
  });
});
