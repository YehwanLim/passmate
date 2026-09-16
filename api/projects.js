import prisma from "../lib/prisma.js";
import { ApiError, sendError, sendJson, withApiHandler } from "../lib/api-handler.js";
import { requireActiveApplicationUser } from "../lib/auth.js";
import { normalizeKeywords, stripEmphasis } from "../lib/report-fields.js";

// questionText는 문항들을 "[문항 N]" 마커로 합쳐 저장한다(api/analyze.js).
// 마커 수 = 실제 문항 수. 마커가 없는 비어있지 않은 텍스트는 단일 문항으로 본다.
function countQuestions(questionText) {
  if (typeof questionText !== "string" || questionText.trim().length === 0) return 0;
  const markers = questionText.match(/(?:^|\n)\[문항 \d+\]/g);
  return markers ? markers.length : 1;
}

export function createProjectsHandler({
  db = prisma,
  requireUser = requireActiveApplicationUser,
} = {}) {
  return async function handler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "GET") {
        return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      }

      const { applicationUser } = await requireUser(req, db);
      // 카드가 쓰는 건 한 줄 요약·키워드뿐이다. Prisma 중첩 take:1 은 프로젝트들의 analyses 를 리포트 JSON 째로
      // 전부 끌어와 메모리에서 자르므로(09-16 실측 18건 386KB), 최신 1건과 필요한 JSON 경로만 SQL 에서 고른다.
      // 요약 후보 순서는 report-fields.extractSummary 와 같다: 구버전 summary → 자소서 첫인상 → 기업 리포트 한 줄.
      const rows = await db.$queryRaw`
        SELECT
          p.id,
          p.title,
          p.company,
          p.job_keyword,
          p.created_at,
          (SELECT count(*)::int FROM analyses a WHERE a.project_id = p.id) AS analysis_count,
          latest.id AS latest_id,
          latest.status::text AS latest_status,
          latest.kind::text AS latest_kind,
          latest.total_chars,
          latest.question_text,
          COALESCE(
            latest.ai_response_json #>> '{summary}',
            latest.ai_response_json #>> '{firstImpression,summaryOneLiner}',
            latest.ai_response_json #>> '{firstImpression,persona}',
            latest.ai_response_json #>> '{brief,oneLiner}'
          ) AS summary,
          COALESCE(
            latest.ai_response_json #> '{firstImpression,hashtags}',
            latest.ai_response_json #> '{brief,keywords}'
          ) AS keywords
        FROM projects p
        LEFT JOIN LATERAL (
          SELECT a.id, a.status, a.kind, a.total_chars, a.question_text, a.ai_response_json
          FROM analyses a
          WHERE a.project_id = p.id
          ORDER BY a.created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE p.user_id = ${applicationUser.id}::uuid
        ORDER BY p.created_at DESC
      `;

      return sendJson(res, 200, rows.map((row) => ({
        id: row.id,
        title: row.title,
        company_name: row.company ?? null,
        job_role: row.job_keyword ?? null,
        created_at: row.created_at,
        analysis_count: row.analysis_count,
        kind: row.latest_kind ?? "RESUME",
        question_count: countQuestions(row.question_text),
        latest_analysis_id: row.latest_id ?? null,
        latest_status: row.latest_status ?? null,
        total_chars: row.total_chars ?? 0,
        summary: stripEmphasis(row.summary) ?? null,
        keywords: normalizeKeywords(row.keywords),
      })), requestId);
    });
  };
}

export default createProjectsHandler();
