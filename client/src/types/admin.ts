import type { LucideIcon } from "lucide-react";

// ============================================================
// Navigation
// ============================================================

/** 사이드바 단일 메뉴 아이템 */
export type AdminNavItem = {
  /** 라우트 매칭에 사용하는 고유 키 */
  key: string;
  /** 사이드바에 표시되는 이름 */
  label: string;
  /** lucide-react 아이콘 컴포넌트 */
  icon: LucideIcon;
  /** /admin/... 형태의 경로 */
  href: string;
  /** 미읽음 카운트 등 알림 뱃지 (null이면 미표시) */
  badge?: number | null;
};

/** 사이드바 메뉴 그룹 (label 없으면 구분선만 출력) */
export type AdminNavGroup = {
  /** 그룹 헤딩 텍스트 (없으면 헤딩 미출력) */
  label?: string;
  items: AdminNavItem[];
};

// ============================================================
// Breadcrumb
// ============================================================

/** 브레드크럼 단일 세그먼트 */
export type BreadcrumbSegment = {
  label: string;
  /** href가 없으면 링크 없이 텍스트만 렌더링 */
  href?: string;
};

// ============================================================
// Page Meta (각 관리자 페이지에서 공통으로 사용)
// ============================================================

/** AdminPageHeader에 전달하는 페이지 메타 정보 */
export type AdminPageMeta = {
  title: string;
  description?: string;
};

// ============================================================
// Role-based Access Control
// ============================================================

/** users 테이블 role 컬럼 값 */
export type UserRole = "user" | "admin";

/**
 * AdminGuard 내부 상태 머신
 * - loading       : 인증 및 role 확인 중
 * - unauthenticated: 비로그인 → /admin/login 리다이렉트
 * - forbidden     : 로그인됐지만 admin role 아님 → 403 페이지
 * - admin         : admin role 확인 → 콘텐츠 렌더링
 */
export type AdminRoleState =
  | "loading"
  | "unauthenticated"
  | "forbidden"
  | "admin";

