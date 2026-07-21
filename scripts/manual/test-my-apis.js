// =============================================================================
// API 로직 로컬 테스트 스크립트
// node --env-file=.env api/_test-my-apis.js
// =============================================================================

import prisma from "../../lib/prisma.js";

// ── extractSummary (projects.js와 동일 로직) ──
function extractSummary(aiResponseJson) {
  try {
    if (aiResponseJson == null) return null;
    const data =
      typeof aiResponseJson === "string"
        ? JSON.parse(aiResponseJson)
        : aiResponseJson;
    if (!data || typeof data !== "object") return null;
    return data.summary ?? null;
  } catch (e) {
    console.error("[extractSummary] 파싱 실패:", e.message);
    return null;
  }
}

// ── sanitizeAiResponse (analysis/[id].js와 동일 로직) ──
function sanitizeAiResponse(json) {
  try {
    if (json == null) return null;
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (!data || typeof data !== "object") return null;
    const { score, ...rest } = data;
    return rest;
  } catch (e) {
    console.error("[sanitizeAiResponse] 정제 실패:", e.message);
    return null;
  }
}

async function test() {
  console.log("\n========== 🧪 My Tab API Logic Test ==========\n");

  // ── 1. GET /api/projects 로직 ──
  console.log("━━━ 1️⃣ Project 리스트 ━━━");
  const firstUser = await prisma.user.findFirst({ select: { id: true } });
  if (!firstUser) {
    console.log("유저 없음 → [] 반환");
  } else {
    const projects = await prisma.project.findMany({
      where: { userId: firstUser.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        company: true,
        jobKeyword: true,
        createdAt: true,
        _count: { select: { analyses: true } },
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { totalChars: true, aiResponseJson: true },
        },
      },
    });

    const result = projects.map((p) => {
      const latest = p.analyses?.[0];
      return {
        id: p.id,
        title: p.title,
        company_name: p.company ?? null,
        job_role: p.jobKeyword ?? null,
        created_at: p.createdAt,
        analysis_count: p._count.analyses,
        total_chars: latest?.totalChars ?? 0,
        summary: extractSummary(latest?.aiResponseJson),
      };
    });

    console.log(`  프로젝트 ${result.length}개`);
    console.log("  ✅ score 포함 여부:", JSON.stringify(result).includes('"score"') ? "❌ 포함됨!" : "✅ 없음");
    console.log("  응답:", JSON.stringify(result, null, 2).substring(0, 500));

    // ── 2. GET /api/projects/:id/analyses 로직 ──
    if (result.length > 0) {
      const pid = result[0].id;
      console.log(`\n━━━ 2️⃣ Analysis 리스트 (project: ${pid.substring(0, 8)}...) ━━━`);

      const analyses = await prisma.analysis.findMany({
        where: { projectId: pid },
        orderBy: { createdAt: "desc" },
        select: { id: true, questionText: true, status: true, createdAt: true },
      });

      const analysisList = analyses.map((a) => ({
        id: a.id,
        question_text: a.questionText,
        status: a.status,
        created_at: a.createdAt,
      }));

      console.log(`  분석 ${analysisList.length}개`);
      console.log("  응답:", JSON.stringify(analysisList, null, 2).substring(0, 500));

      // ── 3. GET /api/analysis/:id 로직 ──
      if (analysisList.length > 0) {
        const aid = analysisList[0].id;
        console.log(`\n━━━ 3️⃣ Analysis 상세 (id: ${aid.substring(0, 8)}...) ━━━`);

        const detail = await prisma.analysis.findUnique({
          where: { id: aid },
          select: {
            id: true,
            questionText: true,
            inputText: true,
            aiResponseJson: true,
            status: true,
            totalChars: true,
            createdAt: true,
          },
        });

        if (detail) {
          const detailResult = {
            id: detail.id,
            question_text: detail.questionText,
            input_text: detail.inputText?.substring(0, 50) + "...",
            ai_response_json: sanitizeAiResponse(detail.aiResponseJson),
            status: detail.status,
            total_chars: detail.totalChars ?? 0,
            created_at: detail.createdAt,
          };

          console.log("  ✅ score 포함 여부:", JSON.stringify(detailResult.ai_response_json).includes('"score"') ? "❌ 포함됨!" : "✅ 없음");
          console.log("  응답 키:", Object.keys(detailResult));
          console.log("  ai_response_json 키:", detailResult.ai_response_json ? Object.keys(detailResult.ai_response_json) : "null");
        } else {
          console.log("  404: 분석 데이터 없음");
        }
      }
    }
  }

  console.log("\n========== ✅ 테스트 완료 ==========\n");
  process.exit(0);
}

test().catch((e) => {
  console.error("❌ 테스트 실패:", e);
  process.exit(1);
});
