import prisma from "../../../lib/prisma.js";
import { ApiError, sendError, sendJson, withApiHandler } from "../../../lib/api-handler.js";
import { requireActiveApplicationUser } from "../../../lib/auth.js";
// 목록(api/projects.js)과 같은 규칙으로 요약을 읽는다. 예전엔 여기만 구버전 summary 필드만 봤다.
import { extractSummary } from "../../../lib/report-fields.js";
import { normalizeProjectMeta, normalizeQuestionSave } from "../../../lib/application-drafts.js";
import { buildProjectTitle } from "../../../lib/resume-analysis.js";

const DETAIL_SELECT = {
  id: true,
  title: true,
  company: true,
  jobKeyword: true,
  deadline: true,
  postingSlug: true,
  createdAt: true,
  _count: { select: { analyses: true } },
  analyses: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, totalChars: true, aiResponseJson: true },
  },
  questions: {
    orderBy: { position: "asc" },
    select: { position: true, prompt: true, charLimit: true, answer: true, updatedAt: true },
  },
};

function latestQuestionTime(questions) {
  return questions.reduce((latest, q) => (!latest || q.updatedAt > latest ? q.updatedAt : latest), null);
}

export function createProjectDetailHandler({
  db = prisma,
  requireUser = requireActiveApplicationUser,
} = {}) {
  return async function handler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (!["GET", "DELETE", "PATCH", "PUT"].includes(req.method)) {
        return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      }

      const projectId = req.query?.projectId;
      if (typeof projectId !== "string" || projectId.length === 0) {
        throw new ApiError("INVALID_REQUEST", 400);
      }

      const { applicationUser } = await requireUser(req, db);
      const where = { id: projectId, userId: applicationUser.id };

      if (req.method === "DELETE") {
        const deleted = await db.project.deleteMany({ where });
        if (deleted.count === 0) {
          throw new ApiError("NOT_FOUND", 404);
        }
        return res.status(204).end();
      }

      if (req.method === "PATCH") {
        const data = normalizeProjectMeta(req.body);
        const current = await db.project.findFirst({
          where,
          select: { id: true, company: true, jobKeyword: true },
        });
        if (!current) throw new ApiError("NOT_FOUND", 404);
        if ("company" in data || "jobKeyword" in data) {
          const company = "company" in data ? data.company : current.company;
          const jobKeyword = "jobKeyword" in data ? data.jobKeyword : current.jobKeyword;
          data.title = buildProjectTitle(company, jobKeyword);
        }
        const updated = await db.project.update({
          where: { id: current.id },
          data,
          select: { id: true, title: true, company: true, jobKeyword: true, deadline: true },
        });
        return sendJson(res, 200, {
          id: updated.id,
          title: updated.title,
          company_name: updated.company ?? null,
          job_role: updated.jobKeyword ?? null,
          deadline: updated.deadline ?? null,
        }, requestId);
      }

      if (req.method === "PUT") {
        // 자동 저장 경로다. 본문은 자소서 원문이므로 감사 로그를 남기지 않는다.
        const { questions, baseUpdatedAt } = normalizeQuestionSave(req.body);
        const owned = await db.project.findFirst({ where, select: { id: true } });
        if (!owned) throw new ApiError("NOT_FOUND", 404);

        const savedAt = await db.$transaction(async (tx) => {
          const before = await tx.applicationQuestion.aggregate({
            where: { projectId: owned.id },
            _max: { updatedAt: true },
          });
          const serverLatest = before._max.updatedAt;
          // 다른 탭·기기가 더 최근에 저장했거나, 서버에 문항이 있는데 기준 시각 없이 덮어쓰려 하면 막는다.
          // 처음 저장(서버에 문항 없음)은 baseUpdatedAt 없이 통과한다.
          if (serverLatest && (!baseUpdatedAt || serverLatest > baseUpdatedAt)) {
            throw new ApiError("STALE_DRAFT", 409);
          }
          await tx.applicationQuestion.deleteMany({ where: { projectId: owned.id } });
          if (questions.length > 0) {
            await tx.applicationQuestion.createMany({
              data: questions.map((q) => ({ projectId: owned.id, ...q })),
            });
          }
          // 목록의 "최근 수정" 정렬이 projects.updated_at 을 보므로 문항 저장 때 지원서 행도 건드린다.
          await tx.project.update({ where: { id: owned.id }, data: { updatedAt: new Date() } });
          const after = await tx.applicationQuestion.aggregate({
            where: { projectId: owned.id },
            _max: { updatedAt: true },
          });
          return after._max.updatedAt ?? null;
        });
        return sendJson(res, 200, { questions_updated_at: savedAt }, requestId);
      }

      const project = await db.project.findFirst({ where, select: DETAIL_SELECT });
      if (!project) {
        throw new ApiError("NOT_FOUND", 404);
      }

      const latest = project.analyses?.[0];
      const questions = project.questions ?? [];
      return sendJson(res, 200, {
        id: project.id,
        title: project.title,
        company_name: project.company ?? null,
        job_role: project.jobKeyword ?? null,
        created_at: project.createdAt,
        analysis_count: project._count.analyses,
        total_chars: latest?.totalChars ?? 0,
        summary: extractSummary(latest?.aiResponseJson),
        deadline: project.deadline ?? null,
        posting_slug: project.postingSlug ?? null,
        latest_analysis_id: latest?.id ?? null,
        questions: questions.map((q) => ({
          position: q.position,
          prompt: q.prompt,
          char_limit: q.charLimit ?? null,
          answer: q.answer,
        })),
        questions_updated_at: latestQuestionTime(questions),
      }, requestId);
    });
  };
}

export default createProjectDetailHandler();
