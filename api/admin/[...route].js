import aiModelsHandler from "../../lib/admin-handlers/ai-models.js";
import analysisReconciliationHandler from "../../lib/admin-handlers/analysis-reconciliation.js";
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
  "analysis-reconciliation": analysisReconciliationHandler,
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

const HANDLER_KEY_BY_RESOURCE = Object.freeze({
  analyses: "analysis-detail",
  "analysis-reconciliation": "analysis-reconciliation",
  prompts: "prompt-detail",
  users: "user-detail",
});

/**
 * Route segments arrive from the network, so a handler may only be looked up as
 * an own property. A plain property read would resolve inherited names such as
 * `constructor` or `__proto__` to values that are not request handlers, and the
 * router would then either never answer or throw before authentication runs.
 */
function resolveHandler(handlers, handlerKey) {
  if (typeof handlerKey !== "string" || !Object.hasOwn(handlers, handlerKey)) return null;
  const handler = handlers[handlerKey];
  return typeof handler === "function" ? handler : null;
}

function targetFor(segments, handlers) {
  if (segments.length === 1) {
    const handler = resolveHandler(handlers, segments[0]);
    return handler ? { handler, query: {} } : null;
  }
  if (segments.length !== 2) return null;

  const [resource, id] = segments;
  const handlerKey = Object.hasOwn(HANDLER_KEY_BY_RESOURCE, resource)
    ? HANDLER_KEY_BY_RESOURCE[resource]
    : null;
  const handler = resolveHandler(handlers, handlerKey);
  return handler ? { handler, query: { id } } : null;
}

/** Consolidates all protected admin HTTP routes into one Vercel function. */
export function createAdminRouter({
  db = prisma,
  handlers = DEFAULT_HANDLERS,
  requireAdmin = (req) => requireAdministrator(req, db),
} = {}) {
  return async function adminRouter(req, res) {
    const requestId = requestIdFor(req);

    try {
      const target = targetFor(routeSegments(req), handlers);
      if (target) {
        return await target.handler(
          { ...req, query: { ...(req.query ?? {}), ...target.query } },
          res,
        );
      }

      await requireAdmin(req);
      return sendRequestError(res, 404, requestId);
    } catch (error) {
      return handleRequestError(res, error, requestId, "api/admin");
    }
  };
}

export default createAdminRouter();
