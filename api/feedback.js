import prisma from "../lib/prisma.js";
import { ApiError, sendError, sendJson, withApiHandler } from "../lib/api-handler.js";
import { requireActiveApplicationUser } from "../lib/auth.js";
import {
  FEEDBACK_REWARD_CREDITS,
  grantFeedbackCredit,
} from "../lib/analysis-entitlements.js";
import {
  SURVEY_MAX_COMMENT_LENGTH,
  SURVEY_MIN_COMMENT_LENGTH,
  isCompleteScoreSet,
  toScoreColumns,
} from "../lib/feedback-survey.js";

/**
 * 설문은 전부 채워야 접수된다 — 5문항 점수와 주관식이 함께 있어야 응답 하나가
 * 의미를 갖고, 보상 조건과 제출 조건이 갈리면 "썼는데 왜 안 주냐"가 생긴다.
 */
function readSurveyBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (!Object.keys(body).every((key) => ["analysisId", "scores", "comment"].includes(key))) {
    return null;
  }
  if (typeof body.analysisId !== "string" || body.analysisId.length === 0) return null;
  if (!isCompleteScoreSet(body.scores)) return null;
  if (typeof body.comment !== "string") return null;

  const comment = body.comment.trim();
  if (comment.length < SURVEY_MIN_COMMENT_LENGTH) return null;
  if (comment.length > SURVEY_MAX_COMMENT_LENGTH) return null;

  return { analysisId: body.analysisId, scores: body.scores, comment };
}

export function createFeedbackHandler({
  db = prisma,
  requireUser = requireActiveApplicationUser,
} = {}) {
  return async function handler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") {
        return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      }

      const survey = readSurveyBody(req.body);
      if (!survey) {
        throw new ApiError("INVALID_REQUEST", 400);
      }

      const { applicationUser } = await requireUser(req, db);
      const { analysisId, scores, comment } = survey;
      const analysis = await db.analysis.findFirst({
        where: { id: analysisId, userId: applicationUser.id },
        select: { id: true },
      });
      if (!analysis) {
        throw new ApiError("NOT_FOUND", 404);
      }

      const scoreColumns = toScoreColumns(scores);
      const { feedback, creditGranted } = await db.$transaction(async (tx) => {
        const saved = await tx.feedback.upsert({
          where: { analysisId_userId: { analysisId, userId: applicationUser.id } },
          update: { comment, ...scoreColumns },
          create: { analysisId, userId: applicationUser.id, comment, ...scoreColumns },
          select: { id: true, comment: true, createdAt: true },
        });

        const granted = await grantFeedbackCredit(tx, {
          userId: applicationUser.id,
          feedbackId: saved.id,
        });

        return { feedback: saved, creditGranted: granted };
      });

      return sendJson(res, 200, {
        id: feedback.id,
        comment: feedback.comment,
        created_at: feedback.createdAt,
        credit_granted: creditGranted,
        credits_granted: creditGranted ? FEEDBACK_REWARD_CREDITS : 0,
      }, requestId);
    });
  };
}

export default createFeedbackHandler();
