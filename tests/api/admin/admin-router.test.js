import { describe, expect, it, vi } from "vitest";

import { createAdminRouter } from "../../../api/admin/[...route].js";

function response() {
  return {
    body: undefined,
    statusCode: 200,
    json(body) { this.body = body; return this; },
    status(statusCode) { this.statusCode = statusCode; return this; },
  };
}

describe("admin catch-all router", () => {
  it("dispatches the users detail route while preserving the verified request", async () => {
    const usersDetail = vi.fn(async (req, res) => res.status(200).json({ id: req.query.id }));
    const handler = createAdminRouter({ handlers: { "user-detail": usersDetail } });
    const res = response();

    await handler({ method: "GET", query: { route: ["users", "user-1"] } }, res);

    expect(usersDetail).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ id: "user-1" }) }), res);
    expect(res.body).toEqual({ id: "user-1" });
  });

  it("dispatches a reconciliation action through the admin-only catch-all route", async () => {
    const reconcile = vi.fn(async (req, res) => res.status(200).json({ id: req.query.id }));
    const handler = createAdminRouter({ handlers: { "analysis-reconciliation": reconcile } });
    const res = response();

    await handler({ method: "POST", query: { route: ["analysis-reconciliation", "request-1"] } }, res);

    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ id: "request-1" }) }), res);
    expect(res.body).toEqual({ id: "request-1" });
  });

  it("does not expose an unknown admin route before authenticating the requester", async () => {
    const requireAdmin = vi.fn(async () => { throw Object.assign(new Error("secret"), { statusCode: 401 }); });
    const handler = createAdminRouter({ handlers: {}, requireAdmin });
    const res = response();

    await handler({ headers: {}, method: "GET", query: { route: ["unknown"] } }, res);

    expect(requireAdmin).toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Request failed", requestId: expect.any(String) });
  });

  it.each(["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"])(
    "answers %s with an authenticated 404 instead of dispatching an inherited property",
    async (segment) => {
      const requireAdmin = vi.fn(async () => {
        throw Object.assign(new Error("secret"), { statusCode: 401 });
      });
      const handler = createAdminRouter({ handlers: { users: vi.fn() }, requireAdmin });
      const res = response();

      await handler({ headers: {}, method: "GET", query: { route: [segment] } }, res);

      expect(requireAdmin).toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: "Request failed", requestId: expect.any(String) });
    },
  );

  it("does not treat an inherited resource name as a detail route", async () => {
    const userDetail = vi.fn();
    const requireAdmin = vi.fn(async () => undefined);
    const handler = createAdminRouter({ handlers: { "user-detail": userDetail }, requireAdmin });
    const res = response();

    await handler({ headers: {}, method: "GET", query: { route: ["constructor", "user-1"] } }, res);

    expect(userDetail).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
  });

  it("returns a safe error when a dispatched handler throws", async () => {
    const failing = vi.fn(async () => {
      throw Object.assign(new Error("resume text must never leak"), { statusCode: 500 });
    });
    const handler = createAdminRouter({ handlers: { users: failing } });
    const res = response();

    await handler({ headers: {}, method: "GET", query: { route: ["users"] } }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Request failed", requestId: expect.any(String) });
  });
});
