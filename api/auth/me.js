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
