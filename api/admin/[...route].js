import aiModelsHandler from "../../lib/admin-handlers/ai-models.js";
import analysesHandler from "../../lib/admin-handlers/analyses.js";
import analysisDetailHandler from "../../lib/admin-handlers/analysis-detail.js";
import dashboardHandler from "../../lib/admin-handlers/dashboard.js";
import entitlementsHandler from "../../lib/admin-handlers/entitlements.js";
import promptDetailHandler from "../../lib/admin-handlers/prompt-detail.js";
import promptsHandler from "../../lib/admin-handlers/prompts.js";
import resumeAnalysisHandler from "../../lib/admin-handlers/resume-analysis.js";
import settingsHandler from "../../lib/admin-handlers/settings.js";
import usageHandler from "../../lib/admin-handlers/usage.js";
import userDetailHandler from "../../lib/admin-handlers/user-detail.js";
import usersHandler from "../../lib/admin-handlers/users.js";
import { requireAdministrator } from "../../lib/auth.js";
import prisma from "../../lib/prisma.js";
import { handleRequestError, requestIdFor, sendRequestError } from "../../lib/request-errors.js";

const DEFAULT_HANDLERS = {
  "ai-models": aiModelsHandler,
  analyses: analysesHandler,
  "analysis-detail": analysisDetailHandler,
  dashboard: dashboardHandler,
  entitlements: entitlementsHandler,
  "prompt-detail": promptDetailHandler,
  prompts: promptsHandler,
  "resume-analysis": resumeAnalysisHandler,
  settings: settingsHandler,
  usage: usageHandler,
  "user-detail": userDetailHandler,
  users: usersHandler,
};

function routeSegments(req) {
  const route = req.query?.route;
  if (Array.isArray(route)) return route.filter((part) => typeof part === "string");
  if (typeof route === "string") return route.split("/").filter(Boolean);

  const pathname = new URL(req.url ?? "/api/admin", "http://localhost").pathname;
  return pathname.replace(/^\/api\/admin\/?/, "").split("/").filter(Boolean);
}

function targetFor(segments, handlers) {
  if (segments.length === 1) return { handler: handlers[segments[0]], query: {} };
  if (segments.length !== 2) return null;

  const [resource, id] = segments;
  const handlerKey = resource === "users"
    ? "user-detail"
    : resource === "analyses"
      ? "analysis-detail"
      : resource === "prompts"
        ? "prompt-detail"
        : null;
  return handlerKey ? { handler: handlers[handlerKey], query: { id } } : null;
}

/** Consolidates all protected admin HTTP routes into one Vercel function. */
export function createAdminRouter({
  db = prisma,
  handlers = DEFAULT_HANDLERS,
  requireAdmin = (req) => requireAdministrator(req, db),
} = {}) {
  return async function adminRouter(req, res) {
    const target = targetFor(routeSegments(req), handlers);
    if (target?.handler) {
      return target.handler({ ...req, query: { ...(req.query ?? {}), ...target.query } }, res);
    }

    const requestId = requestIdFor(req);
    try {
      await requireAdmin(req);
      return sendRequestError(res, 404, requestId);
    } catch (error) {
      return handleRequestError(res, error, requestId, "api/admin");
    }
  };
}

export default createAdminRouter();
