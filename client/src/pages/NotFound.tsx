import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [location, setLocation] = useLocation();
  const isAdminRoute = location.startsWith("/admin");

  const handleGoHome = () => {
    setLocation(isAdminRoute ? "/admin" : "/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-stage">
      <Card className="w-full max-w-lg mx-4 shadow-none border-0 rounded-[20px] bg-surface">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-fill">
              <AlertCircle className="h-8 w-8 text-ink-3" />
            </div>
          </div>

          <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-ink mb-2">404</h1>

          <h2 className="text-xl font-semibold text-ink-2 mb-4">
            Page Not Found
          </h2>

          <p className="text-ink-3 mb-8 leading-relaxed">
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleGoHome}
              className="h-11 bg-brand hover:bg-brand-hover text-white px-6 rounded-[10px] font-semibold transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              {isAdminRoute ? "Go Admin Home" : "Go Home"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
