import { requireAdministrator } from "../auth.js";
import prisma from "../prisma.js";
import {
  handleRequestError,
  requestIdFor,
  sendMethodNotAllowed,
} from "../request-errors.js";

function positiveInt(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

const RATINGS = new Set(["ALL", "THUMBS_UP", "THUMBS_DOWN"]);

// 코멘트는 FeedbackSection 에서 빈 문자열 대신 null 로 전송되지만, 과거 행이
// 빈 문자열로 남아 있어도 "코멘트 있음" 필터에 걸리지 않게 함께 배제한다.
const HAS_COMMENT = {
  AND: [{ comment: { not: null } }, { comment: { not: "" } }],
};

export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    await requireAdministrator(req, prisma);
    if (req.method !== "GET") return sendMethodNotAllowed(res, requestId);

    const page = positiveInt(req.query?.page, 1, 100_000);
    const pageSize = positiveInt(req.query?.pageSize, 15, 100);
    const rating = RATINGS.has(req.query?.rating) ? req.query.rating : "ALL";
    const commentsOnly = String(req.query?.commentsOnly ?? "") === "true";
    const search = String(req.query?.search ?? "")
      .trim()
      .slice(0, 120);

    const where = {};
    if (rating !== "ALL") where.rating = rating;
    if (commentsOnly) Object.assign(where, HAS_COMMENT);
    if (search) {
      where.OR = [
        { comment: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        {
          analysis: {
            project: { company: { contains: search, mode: "insensitive" } },
          },
        },
      ];
    }

    const [total, thumbsUp, thumbsDown, withComment, rows] =
      await prisma.$transaction([
        prisma.feedback.count({ where }),
        prisma.feedback.count({ where: { rating: "THUMBS_UP" } }),
        prisma.feedback.count({ where: { rating: "THUMBS_DOWN" } }),
        prisma.feedback.count({ where: HAS_COMMENT }),
        prisma.feedback.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            analysisId: true,
            rating: true,
            comment: true,
            createdAt: true,
            user: { select: { email: true, name: true } },
            analysis: {
              select: {
                questionText: true,
                modelName: true,
                createdAt: true,
                project: { select: { company: true, jobKeyword: true } },
              },
            },
          },
        }),
      ]);

    return res.status(200).json({
      total,
      summary: { thumbsUp, thumbsDown, withComment },
      items: rows.map(row => ({
        id: row.id,
        analysisId: row.analysisId,
        rating: row.rating,
        comment: row.comment ?? null,
        createdAt: row.createdAt,
        userEmail: row.user?.email ?? null,
        userName: row.user?.name ?? null,
        company: row.analysis?.project?.company ?? null,
        jobKeyword: row.analysis?.project?.jobKeyword ?? null,
        questionText: row.analysis?.questionText ?? null,
        modelName: row.analysis?.modelName ?? null,
        analyzedAt: row.analysis?.createdAt ?? null,
      })),
    });
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/feedback");
  }
}
