import { createAdminHandler } from "./create-admin-handler.js";
import prisma from "../prisma.js";

const SETTINGS_ID = "singleton";
const SWITCH_KEYS = new Set(["premiumEnabled", "companyAnalysisEnabled"]);
const SWITCH_SELECT = { premiumEnabled: true, companyAnalysisEnabled: true };

/** PATCH 는 스위치 하나만 받는다 — 두 스위치를 한 요청에 섞어 실수로 같이 켜는 것을 막는다. */
function parseSwitchBody(body) {
  const keys = Object.keys(body ?? {});
  if (keys.length !== 1 || !SWITCH_KEYS.has(keys[0]) || typeof body[keys[0]] !== "boolean") {
    return null;
  }
  return { [keys[0]]: body[keys[0]] };
}

function switchResponse(settings) {
  return {
    premiumEnabled: settings?.premiumEnabled ?? false,
    companyAnalysisEnabled: settings?.companyAnalysisEnabled ?? false,
  };
}

export default createAdminHandler({ route: "api/admin/entitlements", methods: ["GET", "PATCH"] }, async ({ req, res }) => {
  if (req.method === "GET") {
    const settings = await prisma.entitlementSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: SWITCH_SELECT,
    });
    return res.status(200).json(switchResponse(settings));
  }

  if (req.method === "PATCH") {
    const data = parseSwitchBody(req.body);
    if (!data) {
      return res.status(400).json({
        error: "PATCH accepts exactly one of { premiumEnabled: boolean } or { companyAnalysisEnabled: boolean }",
      });
    }

    const settings = await prisma.entitlementSetting.update({
      where: { id: SETTINGS_ID },
      data,
    });
    return res.status(200).json(switchResponse(settings));
  }
});
