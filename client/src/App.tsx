import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { VisitTracker } from "./components/VisitTracker";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";

// 랜딩(Home)만 초기 번들에 두고 나머지 페이지는 라우트 진입 시 받는다.
// 전부 즉시 import하면 관리자 차트 라이브러리까지 랜딩 첫 로드에 실린다.
const FeedbackSurvey = lazy(() => import("@/pages/FeedbackSurvey"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Analyze = lazy(() => import("./pages/Analyze"));
const AnalysisPending = lazy(() => import("./pages/AnalysisPending"));
const CompanyAnalyze = lazy(() => import("./pages/CompanyAnalyze"));
const CompanyReport = lazy(() => import("./pages/CompanyReport"));
const ReportResult = lazy(() => import("./pages/ReportResult"));
const MyProjects = lazy(() => import("./pages/MyProjects"));
const Entitlements = lazy(() => import("./pages/Entitlements"));
const Checkout = lazy(() => import("./pages/Checkout"));
const MyEntitlements = lazy(() => import("./pages/MyEntitlements"));
const MyAnalyses = lazy(() => import("./pages/MyAnalyses"));
const Login = lazy(() => import("./pages/Login"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const AccountDeletion = lazy(() => import("./pages/AccountDeletion"));
const AdminRoot = lazy(() => import("./pages/admin/AdminRoot"));

function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
        {/* ── Admin routes (자체 레이아웃 + 권한 가드 포함) ── */}
        <Route path={"/admin/*?"} component={AdminRoot} />

        {/* ── User-facing routes ── */}
        <Route path={"/"} component={Home} />
        <Route path={"/login"} component={Login} />
        <Route path={"/terms"} component={Terms} />
        <Route path={"/privacy"} component={Privacy} />
        <Route path={"/account/deletion"} component={AccountDeletion} />
        <Route path={"/analyze"} component={Analyze} />
        <Route path={"/analysis-pending"} component={AnalysisPending} />
        <Route path={"/report-new"} component={ReportResult} />
        <Route path={"/company-analysis"} component={CompanyAnalyze} />
        <Route path={"/company-report"} component={CompanyReport} />
        <Route path={"/feedback"} component={FeedbackSurvey} />
        <Route path={"/entitlements"} component={Entitlements} />
        <Route path={"/checkout"} component={Checkout} />
        <Route path={"/my"} component={MyProjects} />
        {/* /my/:projectId 보다 먼저 선언해야 "entitlements"가 projectId로 잡히지 않는다 */}
        <Route path={"/my/entitlements"} component={MyEntitlements} />
        <Route path={"/my/:projectId"} component={MyAnalyses} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            {/* 분석을 돌리지 않아도 사이트에 들어오면 관리자 대시보드 방문자에 잡히게 한다 */}
            <VisitTracker />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
