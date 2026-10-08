import { Fragment } from "react";
import { useLocation } from "wouter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { BreadcrumbSegment } from "@/types/admin";

// ============================================================
// 경로 세그먼트 → 표시 이름 매핑
// ============================================================

const SEGMENT_LABELS: Record<string, string> = {
  admin: "홈",
  behavior: "사용 행동",
  users: "사용자",
  "resume-analysis": "분석 기록",
  logs: "실패 로그",
  "ai-usage": "AI 사용량",
  "ai-models": "AI 모델",
  prompts: "프롬프트",
  feedback: "피드백",
  mentoring: "멘토링",
  notices: "공지",
  settings: "설정",
};

/**
 * wouter의 현재 경로를 파싱하여 BreadcrumbSegment 배열로 변환합니다.
 *
 * 예시:
 * - /admin                 → [{ label: '홈' }]
 * - /admin/users           → [{ label: '홈', href: '/admin' }, { label: '사용자' }]
 * - /admin/users/123       → [{ label: '홈', href: '/admin' }, { label: '사용자', href: '/admin/users' }, { label: '123' }]
 */
function parseSegments(location: string): BreadcrumbSegment[] {
  // /admin 또는 /admin/ → 홈만
  const normalized = location.replace(/\/$/, "") || "/admin";
  const parts = normalized.split("/").filter(Boolean); // ['admin', 'users', ...]

  if (parts.length === 0 || parts[0] !== "admin") {
    return [{ label: "홈" }];
  }

  const segments: BreadcrumbSegment[] = [];
  let cumulativePath = "";

  parts.forEach((part, idx) => {
    cumulativePath += `/${part}`;
    const isLast = idx === parts.length - 1;
    const label =
      SEGMENT_LABELS[part] ??
      // 알 수 없는 세그먼트(ID 등)는 그대로 표시
      part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " ");

    segments.push({
      label,
      href: isLast ? undefined : cumulativePath,
    });
  });

  return segments;
}

// ============================================================
// Component
// ============================================================

export function AdminBreadcrumb() {
  const [location] = useLocation();
  const segments = parseSegments(location);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1;
          return (
            <Fragment key={`${seg.href ?? seg.label}-${idx}`}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{seg.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={seg.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {seg.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
