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

  it("does not expose an unknown admin route before authenticating the requester", async () => {
    const requireAdmin = vi.fn(async () => { throw Object.assign(new Error("secret"), { statusCode: 401 }); });
    const handler = createAdminRouter({ handlers: {}, requireAdmin });
    const res = response();

    await handler({ headers: {}, method: "GET", query: { route: ["unknown"] } }, res);

    expect(requireAdmin).toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Request failed", requestId: expect.any(String) });
  });
});
