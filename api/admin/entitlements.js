import { requireAdministrator } from "../../lib/admin-auth.js";
import prisma from "../../lib/prisma.js";

const SETTINGS_ID = "singleton";

function hasValidPremiumEnabledBody(body) {
  const keys = Object.keys(body ?? {});
  return keys.length === 1 && keys[0] === "premiumEnabled" && typeof body.premiumEnabled === "boolean";
}

export default async function handler(req, res) {
  try {
    const administrator = await requireAdministrator(req, res);
    if (!administrator) {
      return;
    }

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

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    console.error("[api/admin/entitlements] error:", error);
    return res.status(500).json({ error: "Unable to process entitlement request" });
  }
}
