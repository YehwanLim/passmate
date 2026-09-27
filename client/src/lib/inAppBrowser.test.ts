import { describe, expect, it } from "vitest";

import { detectInAppBrowser, externalBrowserAction, inAppBrowserLabel } from "./inAppBrowser";

const IOS_WEBKIT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const ANDROID_WV =
  "Mozilla/5.0 (Linux; Android 13; SM-S908N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36";

describe("detectInAppBrowser", () => {
  it("일반 브라우저(데스크톱 Chrome, iOS Safari, Android Chrome, 삼성 인터넷)는 null", () => {
    expect(
      detectInAppBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
    ).toBeNull();
    expect(detectInAppBrowser(`${IOS_WEBKIT} Version/17.0 Mobile/15E148 Safari/604.1`)).toBeNull();
    expect(
      detectInAppBrowser("Mozilla/5.0 (Linux; Android 13; SM-S908N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"),
    ).toBeNull();
    expect(
      detectInAppBrowser("Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S908N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36"),
    ).toBeNull();
    expect(detectInAppBrowser("")).toBeNull();
  });

  it("앱 이름이 UA 에 박히는 인앱 브라우저를 앱별로 가려낸다", () => {
    expect(detectInAppBrowser(`${IOS_WEBKIT} Mobile/15E148 KAKAOTALK 10.4.0`)).toBe("kakaotalk");
    expect(detectInAppBrowser(`${ANDROID_WV} Instagram 300.0.0.0 Android`)).toBe("instagram");
    expect(detectInAppBrowser(`${IOS_WEBKIT} Mobile/15E148 Barcelona 300.0.0.0`)).toBe("threads");
    expect(detectInAppBrowser(`${IOS_WEBKIT} Mobile/15E148 [FBAN/FBIOS;FBAV/430.0.0]`)).toBe("facebook");
    expect(detectInAppBrowser(`${IOS_WEBKIT} Mobile/15E148 NAVER(inapp; search; 1000; 12.0.0)`)).toBe("naver");
    expect(detectInAppBrowser(`${IOS_WEBKIT} Mobile/15E148 Line/13.0.0`)).toBe("line");
  });

  it("앱 이름은 없지만 WebView 인 경우도 잡는다 (Android 'wv', iOS 에서 Safari 토큰 없음)", () => {
    expect(detectInAppBrowser(ANDROID_WV)).toBe("android-webview");
    expect(detectInAppBrowser(`${IOS_WEBKIT} Mobile/15E148`)).toBe("ios-webview");
  });
});

describe("externalBrowserAction", () => {
  const url = "https://pre-view.me/analyze?utm_source=threads";

  it("카카오톡은 앱 스킴으로 기본 브라우저를 연다", () => {
    expect(externalBrowserAction("kakaotalk", url, `${IOS_WEBKIT} KAKAOTALK 10.4.0`)).toEqual({
      type: "open",
      href: `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`,
    });
  });

  it("Android 인앱은 Chrome intent 로 열고, 실패하면 같은 주소로 돌아온다", () => {
    const action = externalBrowserAction("instagram", url, `${ANDROID_WV} Instagram 300.0.0.0`);
    expect(action.type).toBe("open");
    if (action.type !== "open") throw new Error("unreachable");
    expect(action.href.startsWith("intent://pre-view.me/analyze?utm_source=threads#Intent;scheme=https;")).toBe(true);
    expect(action.href).toContain("package=com.android.chrome;");
    expect(action.href).toContain(`S.browser_fallback_url=${encodeURIComponent(url)};`);
    expect(action.href.endsWith(";end")).toBe(true);
  });

  it("iOS 의 다른 앱은 강제로 못 열어서 링크 복사 안내로 대신한다", () => {
    expect(externalBrowserAction("instagram", url, `${IOS_WEBKIT} Mobile/15E148 Instagram 300.0.0.0`)).toEqual({ type: "copy" });
    expect(externalBrowserAction("ios-webview", url, `${IOS_WEBKIT} Mobile/15E148`)).toEqual({ type: "copy" });
  });
});

describe("inAppBrowserLabel", () => {
  it("앱 이름은 한국어 표기, 이름 모를 WebView 는 일반 표현", () => {
    expect(inAppBrowserLabel("kakaotalk")).toBe("카카오톡");
    expect(inAppBrowserLabel("threads")).toBe("스레드");
    expect(inAppBrowserLabel("naver")).toBe("네이버 앱");
    expect(inAppBrowserLabel("android-webview")).toBe("앱 안의 브라우저");
    expect(inAppBrowserLabel("ios-webview")).toBe("앱 안의 브라우저");
  });
});
