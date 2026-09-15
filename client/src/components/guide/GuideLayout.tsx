import type { ReactNode } from "react";
import MoodShiftBackground from "@/components/MoodShiftBackground";
import SiteHeader from "@/components/SiteHeader";

/** 가이드 목록·본문이 함께 쓰는 껍데기. 전역 헤더와 같은 1280px 컨테이너 위에 페이지가 자기 그리드를 얹는다. */
export function GuideLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <MoodShiftBackground />
      <SiteHeader variant="transparent" />

      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-24 pt-12 md:pt-16 lg:px-10">{children}</main>
    </div>
  );
}
