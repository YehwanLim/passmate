// 실제 Gemini 를 1회 호출해 그라운딩 조합·지연·출처를 기록하는 수동 프로브.
// 실행: GEMINI_API_KEY=... node scripts/manual/company-analysis-probe.mjs "현대자동차" "전략기획"
// 리포트 본문은 출력하지 않는다(로그에 AI 응답 금지 규칙). 구조 요약만 찍는다.
// sourceIdsBySection/sourceIdRange 는 섹션별 sourceIds 가 출처 개수를 넘는지 사람이 눈으로
// 확인하기 위한 것이고, searchEntryPointHtmlPath 는 본문 대신 임시 파일 경로만 출력한다.
import os from "node:os";
import path from "node:path";
import { writeFileSync } from "node:fs";

import { analyzeCompany } from "../../lib/company-analysis.js";

const [company = "현대자동차", jobKeyword = "전략기획"] = process.argv.slice(2);
const db = { aiModelSetting: { findUnique: async () => null } };
const startedAt = Date.now();

const SOURCE_ID_SECTIONS = [
  ["businessMap", "segments"],
  ["focusBusinesses", "items"],
  ["financialSnapshot", "keyFigures"],
  ["financialSnapshot", "recentDisclosures"],
  ["currentIssues"],
  ["roleInContext", "recentNewsForRole"],
  ["opportunitiesAndRisks", "opportunities"],
  ["opportunitiesAndRisks", "risks"],
];

function collectSourceIds(result) {
  const bySection = {};
  const allIds = [];
  for (const sectionPath of SOURCE_ID_SECTIONS) {
    const items = sectionPath.reduce((value, key) => value?.[key], result);
    const ids = Array.isArray(items)
      ? items.flatMap((item) => (Array.isArray(item?.sourceIds) ? item.sourceIds.filter((id) => Number.isInteger(id)) : []))
      : [];
    const unique = [...new Set(ids)].sort((a, b) => a - b);
    bySection[sectionPath.join(".")] = unique;
    allIds.push(...unique);
  }
  const min = allIds.length > 0 ? Math.min(...allIds) : null;
  const max = allIds.length > 0 ? Math.max(...allIds) : null;
  return { sourceIdsBySection: bySection, sourceIdRange: { min, max } };
}

try {
  const result = await analyzeCompany({ company, jobKeyword, postingText: "", resumeAnalysisId: null }, db);
  const elapsedMs = Date.now() - startedAt;
  if (result.error) {
    console.log(JSON.stringify({ outcome: result.error, elapsedMs }, null, 2));
    process.exit(0);
  }
  const searchEntryPointHtml = result.reportMeta.searchEntryPointHtml;
  let searchEntryPointHtmlPath = null;
  if (typeof searchEntryPointHtml === "string" && searchEntryPointHtml.length > 0) {
    searchEntryPointHtmlPath = path.join(os.tmpdir(), "company-analysis-search-entry-point.html");
    writeFileSync(searchEntryPointHtmlPath, searchEntryPointHtml, "utf8");
  }
  const { sourceIdsBySection, sourceIdRange } = collectSourceIds(result);
  console.log(JSON.stringify({
    outcome: "ok",
    elapsedMs,
    repaired: result.reportMeta.repaired,
    modelName: result.analysisMeta.modelName,
    tokenUsage: result.analysisMeta.tokenUsage,
    sourceCount: result.sources.length,
    sourceIdsBySection,
    sourceIdRange,
    searchQueries: result.reportMeta.searchQueries,
    searchEntryPointHtmlLength: searchEntryPointHtml?.length ?? 0,
    searchEntryPointHtmlPath,
    sectionKeys: Object.keys(result).filter((key) => !["sources", "reportMeta", "analysisMeta"].includes(key)),
    counts: {
      segments: result.businessMap?.segments?.length ?? 0,
      focusItems: result.focusBusinesses?.items?.length ?? 0,
      keyFigures: result.financialSnapshot?.keyFigures?.length ?? 0,
      issues: result.currentIssues?.length ?? 0,
      roleNews: result.roleInContext?.recentNewsForRole?.length ?? 0,
      candidates: result.businessCandidates?.length ?? 0,
      questions: result.interviewPrep?.questions?.length ?? 0,
    },
  }, null, 2));
} catch (error) {
  console.log(JSON.stringify({
    outcome: "failed",
    elapsedMs: Date.now() - startedAt,
    code: error?.code ?? null,
    statusCode: error?.statusCode ?? null,
    name: error?.name ?? null,
  }, null, 2));
  process.exit(1);
}
