import { Route, Switch } from "wouter";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminGuard } from "@/components/admin/AdminGuard";
import AdminLoginPage from "./login/AdminLoginPage";
import UserDetailPage from "./users/UserDetailPage";
import AnalysisDetailPage from "./resume-analysis/AnalysisDetailPage";

// ── 관리자 페이지 ────────────────────────────────────────────
import DashboardPage from "./dashboard/DashboardPage";
import UsersPage from "./users/UsersPage";
import ResumeAnalysisPage from "./resume-analysis/ResumeAnalysisPage";
import AiUsagePage from "./ai-usage/AiUsagePage";
import AiModelsPage from "./ai-models/AiModelsPage";
import AiSettingsPage from "./ai-settings/AiSettingsPage";
import PromptDetailPage from "./prompts/PromptDetailPage";
import PromptsPage from "./prompts/PromptsPage";
import AnalyticsPage from "./analytics/AnalyticsPage";
import PaymentsPage from "./payments/PaymentsPage";
import FeedbackPage from "./feedback/FeedbackPage";
import LogsPage from "./logs/LogsPage";
import SettingsPage from "./settings/SettingsPage";
import NotFound from "@/pages/NotFound";

const PROMPT_DETAIL_ROUTES = [
  "/admin/prompts/resume-analysis",
  "/admin/prompts/cover-letter",
  "/admin/prompts/summary",
  "/admin/prompts/feedback",
  "/admin/prompts/interview-questions",
];

/**
 * AdminRoot
 *
 * /admin 하위 전체 라우팅의 진입점.
 *
 * 구조:
 *   Switch
 *     ├── /admin/login  → AdminLoginPage  (가드 없음, 레이아웃 없음)
 *     └── /admin/*      → AdminGuard      (SPA 미들웨어)
 *                            └── AdminLayout
 *                                  └── Switch (각 페이지)
 *
 * AdminGuard 동작:
 *   - 비로그인          → /admin/login 리다이렉트
 *   - role ≠ admin     → 403 (AdminForbiddenPage) 렌더링
 *   - role = admin     → AdminLayout + 페이지 렌더링
 */
export default function AdminRoot() {
  return (
    <Switch>
      {/* ── 관리자 로그인 (가드 없음) ── */}
      <Route path="/admin/login" component={AdminLoginPage} />

      {/* ── 관리자 페이지 전체 (/admin 및 하위 경로) ── */}
      <Route path="/admin/*?">
        {() => (
          <AdminGuard>
            <AdminLayout>
              <Switch>
                <Route path="/admin" component={DashboardPage} />

                {/* /admin/users/:id 는 /admin/users 보다 먼저 매칭되어야 합니다 */}
                <Route path="/admin/users/:id" component={UserDetailPage} />
                <Route path="/admin/users" component={UsersPage} />

                {/* /admin/resume-analysis/:id 는 /admin/resume-analysis 보다 먼저 매칭되어야 합니다 */}
                <Route
                  path="/admin/resume-analysis/:id"
                  component={AnalysisDetailPage}
                />
                <Route
                  path="/admin/resume-analysis"
                  component={ResumeAnalysisPage}
                />

                <Route path="/admin/ai-usage" component={AiUsagePage} />
                <Route path="/admin/ai-models" component={AiModelsPage} />
                <Route path="/admin/ai-settings" component={AiSettingsPage} />
                {PROMPT_DETAIL_ROUTES.map(path => (
                  <Route
                    key={path}
                    path={path}
                    component={PromptDetailPage}
                  />
                ))}
                <Route
                  path="/admin/prompts/:type"
                  component={PromptDetailPage}
                />
                <Route path="/admin/prompts" component={PromptsPage} />
                <Route path="/admin/analytics" component={AnalyticsPage} />
                <Route path="/admin/payments" component={PaymentsPage} />
                <Route path="/admin/feedback" component={FeedbackPage} />
                <Route path="/admin/logs" component={LogsPage} />
                <Route path="/admin/settings" component={SettingsPage} />
                {/* 관리자 영역 내 404 */}
                <Route component={NotFound} />
              </Switch>
            </AdminLayout>
          </AdminGuard>
        )}
      </Route>
    </Switch>
  );
}
