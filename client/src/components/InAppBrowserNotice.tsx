import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Smartphone } from "lucide-react";

import { externalBrowserAction, inAppBrowserLabel, type InAppBrowserKind } from "@/lib/inAppBrowser";
import { sendClientEvent } from "@/lib/siteVisits";

/**
 * 인앱 브라우저(카카오톡·인스타그램·스레드·네이버 앱 등) 안에서 로그인 화면이 열렸을 때 보이는 안내.
 * Google 은 WebView 로그인을 막으므로, 로그인 페이지와 분석 폼의 로그인 모달이 이 카드를 Google 버튼 자리에 놓고
 * 카카오 버튼을 앞세운다. 외부 브라우저로 열 수 있는 앱(카카오톡·Android)은 링크를, 못 여는 iOS 앱은 링크 복사를 준다.
 */
export default function InAppBrowserNotice({
  kind,
  url = typeof window === "undefined" ? "" : window.location.href,
  userAgent,
}: {
  kind: InAppBrowserKind;
  /** 외부 브라우저에서 이어서 열 주소. 기본은 현재 주소 */
  url?: string;
  /** 테스트용. 기본은 navigator.userAgent */
  userAgent?: string;
}) {
  const action = externalBrowserAction(kind, url, userAgent);
  const [copied, setCopied] = useState(false);

  // 이 카드가 보였다 = 인앱에서 로그인 화면까지 왔다. 몇 명이 여기서 막히는지 대시보드가 센다.
  useEffect(() => {
    void sendClientEvent("login_prompt_in_app", kind);
  }, [kind]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // 클립보드가 막힌 브라우저에서는 아래 메뉴 안내만 남는다.
    }
  };

  return (
    <div className="mx-auto w-full max-w-[336px] rounded-[12px] bg-blank-soft p-4 text-left">
      <div className="flex items-start gap-2.5">
        <Smartphone aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-blank" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-snug text-blank">
            지금은 {inAppBrowserLabel(kind)} 안의 브라우저예요
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
            여기서는 Google 로그인이 막혀 있어요. 아래 카카오로 로그인하거나, 외부 브라우저에서 열어 주세요.
          </p>
          {action.type === "open" ? (
            <a
              href={action.href}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-surface px-3 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-fill"
            >
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              외부 브라우저로 열기
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={copyLink}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-surface px-3 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-fill"
              >
                {copied ? (
                  <>
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-ok" />
                    복사했어요
                  </>
                ) : (
                  <>
                    <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                    링크 복사
                  </>
                )}
              </button>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-4">
                오른쪽 위 ··· 메뉴의 &lsquo;브라우저에서 열기&rsquo;를 눌러도 돼요.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
