import { requireAdministrator } from "../auth.js";
import prisma from "../prisma.js";
import { handleRequestError, requestIdFor, sendMethodNotAllowed } from "../request-errors.js";

function positiveInt(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

const ERROR_TYPES = new Set(["ALL", "TIMEOUT", "API_ERROR", "HTTP_500", "PARSE_ERROR", "UNKNOWN"]);

export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    await requireAdministrator(req, prisma);
    if (req.method !== "GET") return sendMethodNotAllowed(res, requestId);

    const page = positiveInt(req.query?.page, 1, 100_000);
    const pageSize = positiveInt(req.query?.pageSize, 15, 100);
    const errorType = ERROR_TYPES.has(req.query?.errorType) ? req.query.errorType : "ALL";
    const search = String(req.query?.search ?? "").trim().slice(0, 120);
    const where = { status: "FAILED" };
    if (["TIMEOUT", "API_ERROR", "PARSE_ERROR", "UNKNOWN"].includes(errorType)) where.errorCode = errorType;
    if (errorType === "HTTP_500") where.tokenUsages = { some: { httpStatus: 500 } };
    if (search) where.OR = [
      { errorMessage: { contains: search, mode: "insensitive" } },
      { errorCode: { equals: search } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
    const [total, rows] = await prisma.$transaction([
      prisma.analysis.count({ where }),
      prisma.analysis.findMany({
        where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
        select: {
          id: true, errorCode: true, errorMessage: true, questionText: true, inputText: true,
          modelName: true, responseTime: true, createdAt: true,
          user: { select: { email: true, name: true } },
          tokenUsages: { select: { httpStatus: true }, take: 1, orderBy: { createdAt: "desc" } },
        },
      }),
    ]);
    return res.status(200).json({
      total,
      logs: rows.map((row) => ({
        id: row.id, analysisId: row.id, userEmail: row.user?.email ?? null, userName: row.user?.name ?? null,
        errorCode: row.errorCode ?? "UNKNOWN", errorMessage: row.errorMessage ?? null,
        httpStatus: row.tokenUsages[0]?.httpStatus ?? null, modelName: row.modelName ?? null,
        responseTimeMs: row.responseTime ?? null, createdAt: row.createdAt,
        questionText: row.questionText, inputText: row.inputText,
      })),
    });
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/analyses");
  }
}
