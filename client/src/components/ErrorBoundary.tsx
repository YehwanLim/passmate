import { canReloadForChunkError, getPrerenderedHtml, isChunkLoadError, markChunkReload } from "@/lib/prerenderedSnapshot";
import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** 테스트용. 기본은 window.location.reload */
  reload?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** 청크 실패라 지금 주소를 새로 불러오는 중 — 아무것도 그리지 않는다 */
  reloading: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, reloading: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // 지금 주소의 프리렌더 본문이 없으면(다른 화면에서 넘어온 경우) 저장본 대신 이 주소를 한 번 새로 불러온다.
    const reloading = isChunkLoadError(error) && getPrerenderedHtml() === null && canReloadForChunkError();
    return { hasError: true, error, reloading };
  }

  componentDidCatch() {
    if (!this.state.reloading) return;
    markChunkReload();
    (this.props.reload ?? (() => window.location.reload()))();
  }

  render() {
    if (this.state.reloading) return null;
    if (this.state.hasError) {
      // 지연 청크 로드 실패(배포 전환 직후, 크롤러 렌더러의 리소스 타임아웃)면 프리렌더된 본문을 되살린다.
      // 오류 화면이 본문을 덮으면 검색 엔진이 Soft 404 로 판정한다. 링크는 일반 앵커라 그대로 동작한다.
      const prerenderedHtml = isChunkLoadError(this.state.error) ? getPrerenderedHtml() : null;
      if (prerenderedHtml) {
        return <div dangerouslySetInnerHTML={{ __html: prerenderedHtml }} />;
      }
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-3 font-semibold">
              일시적인 오류가 발생했어요
            </h2>
            <p className="mb-6 text-center text-sm text-muted-foreground leading-relaxed">
              페이지를 새로고침하면 대부분 해결돼요. 문제가 계속되면{" "}
              <a
                href="mailto:hansitoring@gmail.com"
                className="underline underline-offset-4"
              >
                hansitoring@gmail.com
              </a>
              으로 알려주세요.
            </p>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
