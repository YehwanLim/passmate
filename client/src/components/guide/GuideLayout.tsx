import type { ReactNode } from "react";
import SiteHeader from "@/components/SiteHeader";
import { cn } from "@/lib/utils";

/**
 * 가이드 목록·본문이 함께 쓰는 껍데기. 전역 헤더와 같은 1280px 컨테이너 위에 페이지가 자기 그리드를 얹는다.
 * 목록은 회색 무대 위 흰 카드, 본문은 긴 글을 읽는 화면이라 흰 바탕(surface)으로 깐다.
 */
export function GuideLayout({ children, surface = "stage" }: { children: ReactNode; surface?: "stage" | "white" }) {
  return (
    <div className={cn("min-h-screen text-ink", surface === "white" ? "bg-surface" : "bg-stage")}>
      <SiteHeader variant="light" />

      <main className="mx-auto w-full max-w-7xl px-6 pb-24 pt-12 md:pt-16 lg:px-10">{children}</main>
    </div>
  );
}
