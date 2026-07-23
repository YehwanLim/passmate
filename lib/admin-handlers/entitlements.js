import { requireAdministrator } from "../auth.js";
import prisma from "../prisma.js";
import {
  handleRequestError,
  requestIdFor,
  sendMethodNotAllowed,
} from "../request-errors.js";

export default async function handler(req, res) {
  const requestId = requestIdFor(req);

  try {
    await requireAdministrator(req, prisma);
    if (req.method !== "GET") {
      return sendMethodNotAllowed(res, requestId);
    }

    return res.status(200).json({ premiumEnabled: false });

  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/entitlements");
  }
}
