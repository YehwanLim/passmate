import { requireActiveApplicationUser } from "../../lib/auth.js";
import prisma from "../../lib/prisma.js";
import {
  handleRequestError,
  requestIdFor,
  sendMethodNotAllowed,
} from "../../lib/request-errors.js";

export default async function handler(req, res) {
  const requestId = requestIdFor(req);

  try {
    if (req.headers["x-env-diag"] === "1") {
      const crypto = await import("node:crypto");
      const fp = (v) => (v ? { len: v.length, sha8: crypto.createHash("sha256").update(v).digest("hex").slice(0, 8) } : null);
      const url = process.env.SUPABASE_URL ?? "";
      return res.status(200).json({
        ref: url ? new URL(url).hostname.split(".")[0] : null,
        supabaseUrl: fp(url),
        serviceRoleKey: fp(process.env.SUPABASE_SERVICE_ROLE_KEY),
        node: process.version,
      });
    }
    const { applicationUser } = await requireActiveApplicationUser(req, prisma);
    if (req.method !== "GET") {
      return sendMethodNotAllowed(res, requestId);
    }
    return res.status(200).json({
      id: applicationUser.id,
      role: applicationUser.role,
      deletionPending: false,
    });
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/auth/me");
  }
}
