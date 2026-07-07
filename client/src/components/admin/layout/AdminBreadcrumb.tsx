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
  admin: "Dashboard",
  users: "Users",
  "resume-analysis": "Resume Analysis",
  "ai-usage": "AI Usage",
  analytics: "Analytics",
  payments: "Payments",
  feedback: "Feedback",
  logs: "Logs",
  settings: "Settings",
};

/**
 * wouter의 현재 경로를 파싱하여 BreadcrumbSegment 배열로 변환합니다.
 *
 * 예시:
 * - /admin                 → [{ label: 'Dashboard' }]
 * - /admin/users           → [{ label: 'Dashboard', href: '/admin' }, { label: 'Users' }]
 * - /admin/users/123       → [{ label: 'Dashboard', href: '/admin' }, { label: 'Users', href: '/admin/users' }, { label: '123' }]
 */
function parseSegments(location: string): BreadcrumbSegment[] {
  // /admin 또는 /admin/ → Dashboard만
  const normalized = location.replace(/\/$/, "") || "/admin";
  const parts = normalized.split("/").filter(Boolean); // ['admin', 'users', ...]

  if (parts.length === 0 || parts[0] !== "admin") {
    return [{ label: "Dashboard" }];
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
            <BreadcrumbItem key={idx}>
              {isLast ? (
                <BreadcrumbPage>{seg.label}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink
                    href={seg.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {seg.label}
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
