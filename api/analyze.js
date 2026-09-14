import { waitUntil } from "@vercel/functions";

import {
  cancelAnalysisReservation,
  EntitlementUnavailableError,
  finalizeAnalysisReservation,
  getEntitlementSummary,
  reserveAnalysis,
} from "../lib/analysis-entitlements.js";
import {
  AnalysisConcurrencyLimitError,
  allocateAnalysisRequest,
  analysisReceipt,
  expirePendingRequest,
  expireStaleRequestsForUser,
  failUnstartedAnalysis,
  findExistingRequest,
  findUnfinishedRequest,
  idempotencyResult,
  recoverStagedRequest,
  runAllocatedAnalysis,
} from "../lib/analysis-request-lifecycle.js";
import { ApiError, sendError, sendJson, sendRateLimited, withApiHandler } from "../lib/api-handler.js";
import { requireActiveApplicationUser } from "../lib/auth.js";
import { COMPANY_HANDLER_DEFAULTS } from "../lib/company-analysis.js";
import { createJobPostingHandler } from "../lib/job-posting.js";
import { consumeUserRateLimit, getAnalysisThroughputPolicy } from "../lib/rate-limit.js";
import {
  analyzeCoverLetter,
  attachRequestAnswers,
  buildProjectTitle,
  normalizeRequest,
  requestHash,
  resumeAnalysisInput,
  verifyResumeRequest,
} from "../lib/resume-analysis.js";
import { createResumeSplitHandler } from "../lib/resume-split.js";
import prisma from "../lib/prisma.js";

export { attachRequestAnswers };

const SETTINGS_ID = "singleton";
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function getHeader(req, name) {
  return req.headers?.[name] ?? req.headers?.[name.toLowerCase()] ?? req.headers?.[name.toUpperCase()];
}

function getIdempotencyKey(req) {
  const key = getHeader(req, "Idempotency-Key");
  return typeof key === "string" && IDEMPOTENCY_KEY_PATTERN.test(key) ? key : null;
}

/** 이미 접수된 요청의 접수증. 끝났으면 200, 아직 돌고 있으면 202. */
function sendStoredReceipt(res, requestId, stored) {
  return sendJson(res, stored.status === "SUCCEEDED" ? 200 : 202, analysisReceipt({
    analysisId: stored.analysisId,
    analysisRequestId: stored.analysisRequestId,
    projectId: stored.projectId,
    requestId,
    status: stored.status,
  }), requestId);
}

/** PERSISTENCE_PENDING 요청은 스테이징된 결과를 확정한 뒤 200 으로, 못 하면 503 으로 답한다. */
async function respondWithRecoveredRequest({ db, existing, finalize, requestId, res, userId }) {
  const recovered = await recoverStagedRequest({ db, existing, finalize, userId });
  return recovered
    ? sendJson(res, 200, analysisReceipt({
      analysisId: recovered.analysisId,
      analysisRequestId: existing.id,
      projectId: recovered.projectId,
      requestId,
      status: "SUCCEEDED",
    }), requestId)
    : sendError(res, 503, "ANALYSIS_PERSISTENCE_PENDING", requestId);
}

export function createAnalyzeHandler({
  analysisInput = resumeAnalysisInput,
  buildProjectTitle: titleOf = buildProjectTitle,
  cancelReservation = cancelAnalysisReservation,
  consumeRateLimit = consumeUserRateLimit,
  creditsExhaustedCode = "ANALYSIS_CREDITS_EXHAUSTED",
  db = prisma,
  disabledCode = "ANALYSIS_DISABLED",
  enqueueBackgroundWork = (work) => waitUntil(work()),
  finalizeReservation = finalizeAnalysisReservation,
  getEntitlementSummary: getSummary = getEntitlementSummary,
  getAnalysisThroughputPolicy: getThroughputPolicy = getAnalysisThroughputPolicy,
  hashRequest = requestHash,
  isEnabled = (settings) => settings?.analysisEnabled === true,
  kind = "RESUME",
  model = analyzeCoverLetter,
  normalizeRequest: normalize = normalizeRequest,
  requireUser = requireActiveApplicationUser,
  reserveAnalysis: reserve = reserveAnalysis,
  verifyRequest = verifyResumeRequest,
} = {}) {
  return async function handler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") {
        return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      }

      const { applicationUser } = await requireUser(req, db);
      const userId = applicationUser.id;
      const idempotencyKey = getIdempotencyKey(req);
      if (!idempotencyKey) {
        throw new ApiError("INVALID_IDEMPOTENCY_KEY", 400);
      }
      const request = normalize(req.body);
      const hash = hashRequest(request);
      // 소유권 검증은 재생(replay) 처리보다 먼저 돈다. 연결한 자소서 분석이 그 사이 삭제되면
      // 완료된 요청의 POST 재생도 404 가 되지만, 클라이언트는 GET /api/analysis-requests/:id 로
      // 폴링하므로 실사용 영향은 없고, "일하기 전에 소유권" 원칙을 우선한다.
      await verifyRequest(request, { db, userId });

      // A completed request is a read-only replay: do not consume another rate
      // limit slot or allow a kill switch change to hide the original result.
      await expireStaleRequestsForUser({ db, requestId, userId });
      let existing = await findExistingRequest(db, userId, idempotencyKey);
      existing = await expirePendingRequest({ db, existing, requestId, userId });
      if (existing && existing.requestHash !== hash) {
        throw new ApiError("IDEMPOTENCY_KEY_REUSED", 409);
      }
      if (existing?.status === "PERSISTENCE_PENDING") {
        return respondWithRecoveredRequest({ db, existing, finalize: finalizeReservation, requestId, res, userId });
      }
      const stored = idempotencyResult(existing, hash);
      if (stored) return sendStoredReceipt(res, requestId, stored);

      // A refresh loses the client-held idempotency key. Find unfinished work
      // by its server-side request hash before reserving another credit.
      const unfinished = await findUnfinishedRequest(db, userId, hash);
      if (unfinished?.status === "PERSISTENCE_PENDING") {
        return respondWithRecoveredRequest({ db, existing: unfinished, finalize: finalizeReservation, requestId, res, userId });
      }
      if (unfinished) return sendError(res, 409, "ANALYSIS_IN_PROGRESS", requestId);

      const settings = await db.entitlementSetting.findUnique({
        where: { id: SETTINGS_ID },
        select: { analysisEnabled: true, companyAnalysisEnabled: true },
      });
      if (!isEnabled(settings, applicationUser)) {
        return sendError(res, 503, disabledCode, requestId);
      }

      let allocation;
      try {
        allocation = await allocateAnalysisRequest({
          analysisInput,
          buildProjectTitle: titleOf,
          consumeRateLimit,
          db,
          getSummary,
          getThroughputPolicy,
          hash,
          idempotencyKey,
          kind,
          request,
          reserve,
          userId,
        });
      } catch (error) {
        if (error instanceof AnalysisConcurrencyLimitError) {
          throw new ApiError("ANALYSIS_CONCURRENCY_LIMITED", 409);
        }
        if (error instanceof EntitlementUnavailableError) {
          throw new ApiError(error.code ?? creditsExhaustedCode, 409);
        }
        if (error?.code !== "P2002") throw error;
        // 같은 키가 동시에 두 번 들어와 유니크 충돌이 나면, 먼저 들어간 쪽의 접수증을 돌려준다.
        const raced = idempotencyResult(await findExistingRequest(db, userId, idempotencyKey), hash);
        if (raced) return sendStoredReceipt(res, requestId, raced);
        throw new ApiError("ANALYSIS_IN_PROGRESS", 409);
      }

      if (allocation.type === "rate_limited") {
        return sendRateLimited(res, allocation.rate, requestId);
      }
      if (allocation.type === "stored") {
        return sendStoredReceipt(res, requestId, allocation);
      }

      try {
        enqueueBackgroundWork(() => runAllocatedAnalysis({
          allocation,
          cancel: cancelReservation,
          db,
          finalize: finalizeReservation,
          model,
          request,
          requestId,
          userId,
        }));
      } catch {
        await failUnstartedAnalysis({ allocation, cancel: cancelReservation, db, requestId, userId });
        return sendError(res, 503, "ANALYSIS_FAILED", requestId);
      }

      return sendJson(res, 202, analysisReceipt({
        analysisId: allocation.analysis.id,
        analysisRequestId: allocation.analysisRequest.id,
        projectId: allocation.project.id,
        requestId,
        status: "PENDING",
      }), requestId);
    });
  };
}

export const maxDuration = 180;

/** 기업 분석 리포트 핸들러. 자소서 핸들러와 같은 파이프라인에 kind 조각만 주입한다. */
export function createCompanyAnalyzeHandler(overrides = {}) {
  return createAnalyzeHandler({ ...COMPANY_HANDLER_DEFAULTS, ...overrides });
}

const analyzeHandler = createAnalyzeHandler();
const companyAnalyzeHandler = createCompanyAnalyzeHandler();
const resumeSplitHandler = createResumeSplitHandler();
const jobPostingHandler = createJobPostingHandler();

/** 쿼리로 네 핸들러 중 하나를 고른다. split → posting → kind 순으로 우선한다(기존 동작 유지). */
export function selectAnalyzeHandler(query, { company, posting, resume, split }) {
  if (query?.split === "1") return split;
  if (query?.posting === "1") return posting;
  if (query?.kind === "company") return company;
  return resume;
}

// /api/analyze/split → ?split=1, /api/analyze/posting → ?posting=1, /api/analyze/company → ?kind=company
// 로 rewrite 되어 이 함수 하나로 들어온다 (Hobby 12함수 제한).
export default function handler(req, res) {
  return selectAnalyzeHandler(req.query, {
    company: companyAnalyzeHandler,
    posting: jobPostingHandler,
    resume: analyzeHandler,
    split: resumeSplitHandler,
  })(req, res);
}
