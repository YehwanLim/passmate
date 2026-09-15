import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import Logo from "@/components/Logo";
import MoodShiftBackground from "@/components/MoodShiftBackground";

/** 가이드 목록·본문이 함께 쓰는 껍데기. 약관 페이지(Terms.tsx)와 같은 다크 문서 레이아웃이다. */
export function GuideLayout({
  backHref,
  backLabel,
  children,
}: {
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <MoodShiftBackground />
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#050505]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-5 w-auto" />
          </Link>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">{children}</main>
    </div>
  );
}
