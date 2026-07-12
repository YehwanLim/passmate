import { LockKeyhole } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

interface ReportAccessGateProps {
  isLocked: boolean;
  children: ReactNode;
  onLogin: () => void;
  showOverlay?: boolean;
}

export function ReportAccessGate({
  isLocked,
  children,
  onLogin,
  showOverlay = true,
}: ReportAccessGateProps) {
  if (!isLocked) {
    return <>{children}</>;
  }

  if (!showOverlay) {
    return null;
  }

  return (
    <div className="relative">
      <div className="relative max-h-[650px] overflow-hidden">
        <div
          className="pointer-events-none relative z-10 select-none opacity-95 [mask-image:linear-gradient(to_bottom,black_0%,black_18%,rgba(0,0,0,0.98)_28%,rgba(0,0,0,0.95)_38%,rgba(0,0,0,0.90)_48%,rgba(0,0,0,0.82)_58%,rgba(0,0,0,0.70)_68%,rgba(0,0,0,0.55)_76%,rgba(0,0,0,0.35)_84%,rgba(0,0,0,0.15)_92%,transparent_100%)]"
          aria-hidden="true"
        >
          {children}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 select-none opacity-30 blur-[0.75px] [mask-image:linear-gradient(to_bottom,transparent_0%,transparent_58%,rgba(0,0,0,0.15)_68%,rgba(0,0,0,0.36)_80%,rgba(0,0,0,0.12)_94%,transparent_100%)]"
        >
          {children}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30 select-none opacity-[0.18] blur-[2px] [mask-image:linear-gradient(to_bottom,transparent_0%,transparent_72%,rgba(0,0,0,0.14)_82%,rgba(0,0,0,0.28)_92%,transparent_100%)]"
        >
          {children}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-40 h-[76%] bg-gradient-to-b from-transparent via-[#09090B]/28 via-[52%] to-[#09090B]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-50 h-[22%] bg-[#09090B]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="relative z-[100] -mt-2 px-4 pb-24 sm:-mt-4"
      >
        <div className="report-lock-card mx-auto w-full max-w-3xl rounded-[1.35rem] p-5 text-white backdrop-blur-2xl sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:p-6">
          <div className="flex items-start gap-4 text-left">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.14] bg-white/[0.07] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <LockKeyhole className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                Continue Report
              </p>
              <h3 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-zinc-50">
                로그인하고 리포트 전체 확인하기
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-300">
                Google 계정으로 1초 만에 이어볼 수 있어요. 첫 분석은 무료입니다.
              </p>
            </div>
          </div>

          <div className="mt-5 sm:mt-0">
            <button
              type="button"
              onClick={onLogin}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.18] bg-white/[0.92] px-4 py-3 text-sm font-semibold text-zinc-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_40px_-24px_rgba(255,255,255,0.9)] active:translate-y-0 sm:w-auto"
            >
              <GoogleIcon className="h-4 w-4" />
              Google로 1초 만에 확인하기
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

interface FreeAnalysisNoticeProps {
  show: boolean;
}

export function FreeAnalysisNotice({ show }: FreeAnalysisNoticeProps) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
    >
      다음 분석부터는 이용권이 필요합니다.
    </motion.div>
  );
}
