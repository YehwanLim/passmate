import { createAdminHandler } from "./create-admin-handler.js";

export default createAdminHandler({ route: "api/admin/settings", methods: ["GET"] }, async ({ res }) => {
  return res.status(200).json({
    available: false,
    reason: "Settings are read-only until a server-backed settings schema is deployed.",
  });
});
