# Admin Report Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin resume-analysis detail page show a user-facing report preview first, with a compact admin insight view and Raw JSON moved to the final debugging tab.

**Architecture:** Keep the change scoped to the existing `AnalysisDetailPage.tsx`. Add local parser/renderer helpers for known report JSON fields and graceful fallbacks for partial/unknown responses. Preserve prompt and raw JSON debugging access in secondary tabs.

**Tech Stack:** React, TypeScript, wouter, existing shadcn-style UI components, lucide-react icons, Vitest source-structure tests.

## Global Constraints

- Do not add new dependencies.
- Keep score displays removed because the product does not grade reports numerically.
- Raw JSON must remain available for debugging but must not be the default admin experience.
- Mock admin data should continue to render usefully.

---

### Task 1: Report Preview And Admin Insight UI

**Files:**
- Modify: `client/src/pages/admin/resume-analysis/AnalysisDetailPage.tsx`
- Modify: `client/src/pages/admin/resume-analysis/AnalysisDetailPage.layout.test.ts`

**Interfaces:**
- Consumes: `AnalysisDetail.ai_response_json`, `AnalysisDetail.project_analyses`, `AnalysisDetail.token_usages`
- Produces: local helpers `toReportObject`, `stringList`, `calculateInsightSummary`

- [ ] Add tests that expect "리포트 미리보기", "관리자 인사이트", and "Raw JSON" tabs.
- [ ] Add helpers that safely read known JSON fields without throwing on unknown model output.
- [ ] Render first impression, company insight, strengths, gaps, PM comment, and per-question feedback as normal UI instead of code blocks.
- [ ] Render admin insight cards for response completeness, model/runtime, token/cost, and project coverage.
- [ ] Keep prompt and raw JSON in secondary tabs.
- [ ] Run focused Vitest tests.

### Task 2: Verification

**Files:**
- Test: `client/src/pages/admin/resume-analysis/AnalysisDetailPage.layout.test.ts`

- [ ] Run `pnpm exec vitest run --root . client/src/pages/admin/resume-analysis/AnalysisDetailPage.layout.test.ts client/src/components/admin/resume-analysis/AnalysesTableNavigation.test.ts client/src/pages/admin/adminRouting.test.ts`
- [ ] Run `pnpm exec tsc --noEmit --pretty false` and report any unrelated existing failures.
