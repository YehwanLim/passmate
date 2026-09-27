// 인앱 브라우저(앱 안에서 링크를 열면 뜨는 WebView) 판별.
// Google 은 WebView 안에서 로그인을 막는다(disallowed_useragent). 유입이 스레드·네이버 블로그라
// 방문자 상당수가 이 상태로 들어오므로, 로그인 화면이 미리 알고 카카오를 앞세우거나 외부 브라우저로 안내한다.
// 판별은 User-Agent 문자열만 본다 — 완벽하지 않지만 서버 기록(site_visits.in_app_browser)과 같은 기준을 쓴다.

export type InAppBrowserKind =
  | "kakaotalk"
  | "instagram"
  | "threads"
  | "facebook"
  | "naver"
  | "line"
  | "android-webview"
  | "ios-webview";

// 앱 이름이 UA 에 박히는 경우. 순서가 우선순위다(인스타그램 UA 에 'wv' 도 같이 있으므로 앱 이름을 먼저 본다).
const NAMED_APPS: ReadonlyArray<[InAppBrowserKind, RegExp]> = [
  ["kakaotalk", /KAKAOTALK/i],
  ["instagram", /Instagram/i],
  // 스레드 앱은 내부 코드명 Barcelona 를 UA 에 쓴다.
  ["threads", /Barcelona/i],
  ["facebook", /FBAN|FBAV/i],
  ["naver", /NAVER\(inapp/i],
  ["line", /\bLine\//i],
];

export function detectInAppBrowser(
  userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent,
): InAppBrowserKind | null {
  if (!userAgent) return null;
  for (const [kind, pattern] of NAMED_APPS) {
    if (pattern.test(userAgent)) return kind;
  }
  // Android WebView 는 UA 에 '; wv)' 토큰을 붙인다. Chrome·삼성 인터넷에는 없다.
  if (/Android/i.test(userAgent) && /;\s?wv\)/.test(userAgent)) return "android-webview";
  // iOS WebView 는 Safari/ 토큰 없이 AppleWebKit + Mobile/ 만 있다. Safari 와 iOS Chrome 은 Safari/ 가 붙는다.
  if (/iPhone|iPad|iPod/i.test(userAgent) && /AppleWebKit/i.test(userAgent) && !/Safari\//i.test(userAgent)) {
    return "ios-webview";
  }
  return null;
}

const LABELS: Record<InAppBrowserKind, string> = {
  kakaotalk: "카카오톡",
  instagram: "인스타그램",
  threads: "스레드",
  facebook: "페이스북",
  naver: "네이버 앱",
  line: "라인",
  "android-webview": "앱 안의 브라우저",
  "ios-webview": "앱 안의 브라우저",
};

export function inAppBrowserLabel(kind: InAppBrowserKind): string {
  return LABELS[kind];
}

export type ExternalBrowserAction = { type: "open"; href: string } | { type: "copy" };

/**
 * 외부 브라우저로 여는 방법. 카카오톡은 자체 스킴이 있고, Android 는 Chrome intent 링크가 통한다.
 * iOS 의 나머지 앱(인스타그램·스레드·네이버 등)은 강제로 못 열어서 링크 복사 + 안내로 대신한다.
 */
export function externalBrowserAction(
  kind: InAppBrowserKind,
  url: string,
  userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent,
): ExternalBrowserAction {
  if (kind === "kakaotalk") {
    return { type: "open", href: `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}` };
  }
  if (/Android/i.test(userAgent)) {
    const target = new URL(url);
    const withoutScheme = `${target.host}${target.pathname}${target.search}`;
    return {
      type: "open",
      href: `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`,
    };
  }
  return { type: "copy" };
}
