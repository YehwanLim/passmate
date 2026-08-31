import { requireAdministrator } from "../auth.js";
import prisma from "../prisma.js";
import { handleRequestError, requestIdFor, sendMethodNotAllowed } from "../request-errors.js";
import {
  SURVEY_QUESTION_KEYS,
  SURVEY_SCORE_FIELDS,
  averageScore,
  readScores,
} from "../feedback-survey.js";

function positiveInt(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

// 추천 의향(recommend) 을 기준으로 나눈다. NPS 관례대로 9~10 을 추천,
// 6 이하를 비추천으로 본다. LEGACY 는 👍/👎 만 남아 있는 과거 응답이다.
const SEGMENTS = new Set(["ALL", "PROMOTER", "DETRACTOR", "LEGACY"]);
const RECOMMEND = SURVEY_SCORE_FIELDS.recommend;

const HAS_COMMENT = { AND: [{ comment: { not: null } }, { comment: { not: "" } }] };
const IS_SURVEY = { [RECOMMEND]: { not: null } };

function segmentWhere(segment) {
  if (segment === "PROMOTER") return { [RECOMMEND]: { gte: 9 } };
  if (segment === "DETRACTOR") return { [RECOMMEND]: { lte: 6 } };
  if (segment === "LEGACY") return { [RECOMMEND]: null, rating: { not: null } };
  return {};
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    await requireAdministrator(req, prisma);
    if (req.method !== "GET") return sendMethodNotAllowed(res, requestId);

    const page = positiveInt(req.query?.page, 1, 100_000);
    const pageSize = positiveInt(req.query?.pageSize, 15, 100);
    const segment = SEGMENTS.has(req.query?.segment) ? req.query.segment : "ALL";
    const commentsOnly = String(req.query?.commentsOnly ?? "") === "true";
    const search = String(req.query?.search ?? "").trim().slice(0, 120);

    const where = { ...segmentWhere(segment) };
    if (commentsOnly) Object.assign(where, HAS_COMMENT);
    if (search) {
      where.OR = [
        { comment: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { analysis: { project: { company: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const averageSelection = Object.fromEntries(
      SURVEY_QUESTION_KEYS.map((key) => [SURVEY_SCORE_FIELDS[key], true]),
    );

    const [total, surveyCount, withComment, averages, rows] = await prisma.$transaction([
      prisma.feedback.count({ where }),
      prisma.feedback.count({ where: IS_SURVEY }),
      prisma.feedback.count({ where: HAS_COMMENT }),
      // 평균은 필터와 무관하게 전체 기준으로 낸다 — 필터를 바꿀 때마다 기준선이
      // 흔들리면 개별 응답이 좋은지 나쁜지 비교할 대상이 사라진다.
      prisma.feedback.aggregate({ where: IS_SURVEY, _avg: averageSelection }),
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
          scoreReflection: true,
          scoreImprovement: true,
          scoreRecommend: true,
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

    const questionAverages = Object.fromEntries(
      SURVEY_QUESTION_KEYS.map((key) => {
        const value = averages?._avg?.[SURVEY_SCORE_FIELDS[key]];
        return [key, typeof value === "number" ? Math.round(value * 10) / 10 : null];
      }),
    );

    return res.status(200).json({
      total,
      summary: { surveyCount, withComment, questionAverages },
      items: rows.map((row) => ({
        id: row.id,
        analysisId: row.analysisId,
        scores: readScores(row),
        averageScore: averageScore(row),
        legacyRating: row.rating ?? null,
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
