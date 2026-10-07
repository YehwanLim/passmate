import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogIn } from "lucide-react";
import { Link } from "wouter";

import GoogleSignInButton from "@/components/GoogleSignInButton";
import InAppBrowserNotice from "@/components/InAppBrowserNotice";
import KakaoSignInButton from "@/components/KakaoSignInButton";
import { Button } from "@/components/ui/button";
import { detectInAppBrowser, type InAppBrowserKind } from "@/lib/inAppBrowser";

/**
 * 분석 폼 제출 시점의 로그인 모달. 폼은 로그인 없이 쓰게 두고, 크레딧을 쓰는 순간에만 로그인을 받는다.
 * GIS 버튼은 페이지를 떠나지 않으므로 뒤의 입력이 메모리에 그대로 남는다.
 * 카카오는 전체 페이지 리다이렉트라 떠나기 직전 onBeforeRedirect 로 호출하는 쪽이 초안을 저장한다.
 * 로그인에 성공하면 호출하는 쪽이 isAuthenticated 를 보고 닫고, 분석 폼은 useSubmitAfterLogin 으로 제출까지 이어 준다.
 * 인앱 브라우저(카카오톡·인스타그램 등)에서는 Google 이 로그인을 막으므로 그 자리에 안내 카드를 놓고 카카오만 남긴다.
 */
export default function AnalyzeLoginModal({
  open,
  onClose,
  onBeforeRedirect,
  redirectPath = "/analyze",
  description = "로그인하면 바로 분석이 시작돼요. 작성한 내용은 그대로 남아 있어요. 첫 분석은 무료예요.",
  inAppBrowser,
}: {
  open: boolean;
  onClose: () => void;
  /** 페이지를 떠나는 로그인(카카오·구글 폴백) 직전에 호출된다 */
  onBeforeRedirect?: () => void;
  /** 로그인 뒤 돌아올 경로. 분석 폼 외(멘토링 예약)에서 재사용할 때 넘긴다 */
  redirectPath?: string;
  description?: string;
  /** 테스트용. 기본은 User-Agent 로 판별한다 */
  inAppBrowser?: InAppBrowserKind | null;
}) {
  const [detectedInApp] = useState(() => detectInAppBrowser());
  const inApp = inAppBrowser === undefined ? detectedInApp : inAppBrowser;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="analyze-login-title"
            className="bg-surface border border-line rounded-2xl w-full max-w-md p-6 shadow-[0_12px_32px_rgba(25,31,40,0.12)]"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-fill border border-line flex items-center justify-center flex-shrink-0">
                <LogIn className="w-5 h-5 text-ink-2" />
              </div>
              <h3 id="analyze-login-title" className="text-lg font-semibold text-ink">
                로그인이 필요해요
              </h3>
            </div>
            <p className="text-sm text-ink-3 leading-relaxed mb-6">{description}</p>

            <div className="space-y-3">
              {inApp ? (
                <InAppBrowserNotice kind={inApp} />
              ) : (
                <GoogleSignInButton
                  redirectPath={redirectPath}
                  onBeforeRedirect={onBeforeRedirect}
                  fallbackNotice={
                    <p className="text-[12px] leading-relaxed text-ink-4">
                      브라우저 설정에 따라 로그인 페이지를 거치며, 그 경우 내용을 다시
                      입력해야 할 수 있어요.
                    </p>
                  }
                />
              )}
              <KakaoSignInButton redirectPath={redirectPath} onBeforeRedirect={onBeforeRedirect} />
            </div>

            <p className="mt-4 text-center text-[12px] leading-relaxed text-ink-4">
              로그인 시{" "}
              <Link href="/terms" className="text-ink-3 underline underline-offset-2 hover:text-ink">
                이용약관
              </Link>{" "}
              및{" "}
              <Link href="/privacy" className="text-ink-3 underline underline-offset-2 hover:text-ink">
                개인정보 처리방침
              </Link>
              에 동의하는 것으로 간주합니다.
            </p>

            <Button
              onClick={onClose}
              className="mt-4 w-full bg-fill hover:bg-line text-ink-2 rounded-xl h-11 text-sm font-medium transition-colors"
            >
              닫기
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
