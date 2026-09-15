import type { ReactNode } from "react";
import MoodShiftBackground from "@/components/MoodShiftBackground";
import SiteHeader from "@/components/SiteHeader";

/** 가이드 목록·본문이 함께 쓰는 껍데기. 약관 페이지(Terms.tsx)와 같은 다크 문서 레이아웃이다. */
export function GuideLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <MoodShiftBackground />
      <SiteHeader variant="transparent" />

      <main className="relative z-10 mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">{children}</main>
    </div>
  );
}
