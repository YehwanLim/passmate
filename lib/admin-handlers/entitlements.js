import { requireAdministrator } from "../auth.js";
import prisma from "../prisma.js";
import {
  handleRequestError,
  requestIdFor,
  sendMethodNotAllowed,
} from "../request-errors.js";

const SETTINGS_ID = "singleton";

function hasValidPremiumEnabledBody(body) {
  const keys = Object.keys(body ?? {});
  return keys.length === 1 && keys[0] === "premiumEnabled" && typeof body.premiumEnabled === "boolean";
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);

  try {
    await requireAdministrator(req, prisma);

    if (req.method === "GET") {
      const settings = await prisma.entitlementSetting.findUnique({
        where: { id: SETTINGS_ID },
        select: { premiumEnabled: true },
      });
      return res.status(200).json({ premiumEnabled: settings?.premiumEnabled ?? false });
    }

    if (req.method === "PATCH") {
      if (!hasValidPremiumEnabledBody(req.body)) {
        return res.status(400).json({ error: "PATCH accepts only { premiumEnabled: boolean }" });
      }

      const settings = await prisma.entitlementSetting.update({
        where: { id: SETTINGS_ID },
        data: { premiumEnabled: req.body.premiumEnabled },
      });
      return res.status(200).json({ premiumEnabled: settings.premiumEnabled });
    }

    return sendMethodNotAllowed(res, requestId);
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/entitlements");
  }
}
