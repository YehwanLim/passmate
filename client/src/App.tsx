import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";
import Analyze from "./pages/Analyze";
import ReportResult from "./pages/ReportResult";
import MyProjects from "./pages/MyProjects";
import MyAnalyses from "./pages/MyAnalyses";
import Login from "./pages/Login";
import AdminRoot from "./pages/admin/AdminRoot";

const ADMIN_EXPLICIT_ROUTES = [
  "/admin/resume-analysis/:id",
  "/admin/prompts/resume-analysis",
  "/admin/prompts/cover-letter",
  "/admin/prompts/summary",
  "/admin/prompts/feedback",
  "/admin/prompts/interview-questions",
];

function Router() {
  return (
    <Switch>
      {/* ── Admin routes (자체 레이아웃 + 권한 가드 포함) ── */}
      {ADMIN_EXPLICIT_ROUTES.map(path => (
        <Route key={path} path={path} component={AdminRoot} />
      ))}
      <Route path={"/admin"} component={AdminRoot} />
      <Route path={"/admin/:rest*"} component={AdminRoot} />

      {/* ── User-facing routes ── */}
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/analyze"} component={Analyze} />
      <Route path={"/report-new"} component={ReportResult} />
      <Route path={"/my"} component={MyProjects} />
      <Route path={"/my/:projectId"} component={MyAnalyses} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
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
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
