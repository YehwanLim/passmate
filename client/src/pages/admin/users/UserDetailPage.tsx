import { useParams, Link } from "wouter";
import { useUserDetail } from "@/hooks/admin/useUserDetail";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { UserRoleBadge } from "@/components/admin/users/UserRoleBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Bot,
  FolderOpen,
  FileText,
  Calendar,
  Activity,
  CreditCard,
} from "lucide-react";

// ============================================================
// 유틸
// ============================================================

function formatDate(iso: string, includeTime = false): string {
  const d = new Date(iso);
  if (includeTime) {
    return d.toLocaleString("ko-KR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }
  return d.toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) {
    const hours = Math.floor(diff / 3600000);
    if (hours === 0) return "방금 전";
    return `${hours}시간 전`;
  }
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

const STATUS_CONFIG = {
  SUCCESS: { icon: CheckCircle2, color: "text-emerald-500", label: "완료" },
  FAILED:  { icon: XCircle,       color: "text-destructive",  label: "실패" },
  PENDING: { icon: Clock,         color: "text-amber-500",    label: "대기" },
} as const;

// ============================================================
// 서브 컴포넌트: 개요 카드
// ============================================================

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
      <div className="flex items-center justify-center size-8 rounded-md bg-background border shrink-0">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        <p className="text-sm font-semibold leading-tight truncate">{value}</p>
      </div>
    </div>
  );
}

// ============================================================
// 로딩 스켈레톤
// ============================================================

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

// ============================================================
// UserDetailPage
// ============================================================

/**
 * UserDetailPage
 *
 * 관리자 사용자 상세 페이지 (/admin/users/:id).
 *
 * 표시 항목:
 * - 프로필 헤더 (아바타, 이름, 이메일, 역할, 가입일, 최근 활성)
 * - 통계 요약 (분석 수, 프로젝트 수, 누적 토큰, 누적 AI 비용)
 * - 분석 이력 테이블 (최근 20건)
 * - 피드백 이력 (최근 10건)
 * - 구독/결제 정보: "추후 구현 예정" (DB 미구현)
 */
export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id ?? "";
  const { user, isLoading, error } = useUserDetail(userId);

  // ── 에러 ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="size-4 mr-1.5" />
            목록으로
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // ── 로딩 ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-24" />
        <DetailSkeleton />
      </div>
    );
  }

  if (!user) return null;

  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* 뒤로 가기 */}
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" asChild>
        <Link href="/admin/users">
          <ArrowLeft className="size-4" />
          사용자 목록
        </Link>
      </Button>

      {/* ── 프로필 헤더 ──────────────────────────────────── */}
      <AdminPageHeader
        title={user.name ?? user.email}
        description={user.email}
        actions={<UserRoleBadge role={user.role} />}
      />

      {/* 기본 정보 카드 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">기본 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* 아바타 */}
            <Avatar className="size-14 shrink-0">
              <AvatarImage
                src={user.profile_image ?? undefined}
                alt={user.name ?? user.email}
              />
              <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* 정보 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">이메일</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">이름</p>
                <p className="font-medium">{user.name ?? "–"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">로그인 방식</p>
                <p className="font-medium capitalize">{user.provider ?? "–"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">역할</p>
                <UserRoleBadge role={user.role} className="mt-0.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">가입일</p>
                <p className="font-medium">{formatDate(user.created_at, true)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">최근 활성</p>
                <p className="font-medium" title={formatDate(user.updated_at, true)}>
                  {relativeTime(user.updated_at)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 통계 요약 ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatItem
          icon={FileText}
          label="총 분석"
          value={`${user.analysis_count.toLocaleString("ko-KR")}건`}
        />
        <StatItem
          icon={FolderOpen}
          label="총 프로젝트"
          value={`${user.project_count.toLocaleString("ko-KR")}개`}
        />
        <StatItem
          icon={Bot}
          label="누적 토큰"
          value={user.total_tokens.toLocaleString("ko-KR")}
        />
        <StatItem
          icon={Activity}
          label="누적 AI 비용"
          value={`$${user.total_ai_cost.toFixed(4)}`}
        />
      </div>

      {/* ── 분석 이력 ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">분석 이력</CardTitle>
          <CardDescription className="text-xs">
            최근 20건 표시 / 전체 {user.analysis_count}건
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {user.analyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <FileText className="size-8 mb-2 opacity-30" />
              <p className="text-sm">분석 이력이 없습니다.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>상태</TableHead>
                  <TableHead className="hidden sm:table-cell">프로젝트</TableHead>
                  <TableHead className="hidden md:table-cell">모델</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">점수</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">토큰</TableHead>
                  <TableHead className="text-right">일시</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.analyses.map((a) => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.PENDING;
                  const StatusIcon = cfg.icon;
                  const analysisTokens = a.token_usages.reduce(
                    (s, t) => s + (t.total_tokens ?? 0),
                    0
                  );
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
                          <StatusIcon className="size-3.5" />
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm truncate max-w-[140px]">
                        {a.project?.title ?? "–"}
                        {a.project?.company && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({a.project.company})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {a.model_name ?? "–"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-sm">
                        {a.ai_score != null ? a.ai_score.toFixed(1) : "–"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-sm">
                        {analysisTokens > 0
                          ? analysisTokens.toLocaleString("ko-KR")
                          : "–"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {relativeTime(a.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── 피드백 이력 ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">피드백 이력</CardTitle>
          <CardDescription className="text-xs">
            최근 10건 표시 / 전체 {user.feedback_count}건
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.feedbacks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              피드백 이력이 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {user.feedbacks.map((f) => (
                <li key={f.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  {f.rating === "THUMBS_UP" ? (
                    <ThumbsUp className="size-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ThumbsDown className="size-4 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      {f.comment ? (
                        <span className="text-foreground">{f.comment}</span>
                      ) : (
                        <span className="text-muted-foreground italic">코멘트 없음</span>
                      )}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">
                    {relativeTime(f.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── 결제 정보 (추후 구현 예정) ───────────────────── */}
      <Card className="opacity-60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="size-4" />
              구독 / 결제 정보
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">추후 구현 예정</Badge>
          </div>
          <CardDescription className="text-xs">
            payments / subscriptions 테이블 추가 후 활성화됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            현재 DB 스키마에 결제 테이블이 없어 표시할 수 없습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
