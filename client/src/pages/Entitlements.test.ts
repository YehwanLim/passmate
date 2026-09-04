import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("./Entitlements.tsx", import.meta.url),
  "utf8"
);
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("Entitlements page", () => {
  it("shows guests the pricing guide and routes purchase through login instead of blocking the page", () => {
    // 페이지 진입만으로 로그인을 강제하지 않는다
    expect(pageSource).not.toContain("useRequireAuth(");
    expect(pageSource).toContain('getLoginRedirectPath("/entitlements")');
    expect(pageSource).toContain("무료로 분석하기");
    expect(pageSource).toContain('navigate("/analyze")');
  });

  it("renders every plan card from the shared pricing constants for guests and signed-in users alike", () => {
    // 가격 숫자는 pricing.ts 단일 정의처에서 온다 — 페이지에 하드코딩하지 않는다.
    expect(pageSource).toContain('from "@/lib/pricing"');
    expect(pageSource).toContain("PRICING[product]");
    expect(pageSource).toContain("TRIPLE_PER_USE_PRICE");
    expect(pageSource).not.toContain("9,900원");
    // 무료 체험 + 1회권 + 3회권 카드는 로그인 여부와 무관하게 렌더된다.
    expect(pageSource).toContain("무료 체험");
    expect(pageSource).toContain('renderPaidPlanCard("single")');
    expect(pageSource).toContain('renderPaidPlanCard("triple")');
    // 정가는 취소선으로, 할인율 배지와 함께 보여준다.
    expect(pageSource).toContain("line-through");
    expect(pageSource).toContain("plan.discountLabel");
  });

  it("keeps the purchase gate server-driven while delegating the balance view to /my/entitlements", () => {
    expect(pageSource).toContain("supabase.auth.getSession");
    expect(pageSource).toContain("session.access_token");
    // 요약 조회는 구매 게이트(판매 스위치·결제 URL) 판단에만 쓴다.
    expect(pageSource).toContain("fetchEntitlementSummary");
    // 보유 현황 블록은 /my/entitlements로 분리됐다 — 여기서는 렌더하지 않는다.
    expect(pageSource).not.toContain("남은 분석");
    expect(pageSource).not.toContain("CreditSummaryRow");
    expect(pageSource).toContain('navigate("/my/entitlements")');
    expect(appSource).toContain(
      'path={"/entitlements"} component={Entitlements}'
    );
  });

  it("gates the checkout button behind the server-driven sales switch", () => {
    expect(pageSource).toContain("다시 시도");
    // 판매 스위치가 꺼져 있으면 준비 안내만 보인다
    expect(pageSource).toContain("현재 추가 이용권 판매를 준비하고 있어요.");
    // 상품별 결제 URL과 판매 스위치를 함께 확인한다.
    expect(pageSource).toContain("summary.premiumEnabled && paymentUrl");
    expect(pageSource).toContain("summary.grobleSinglePaymentUrl");
    expect(pageSource).toContain("summary.groblePaymentUrl");
    // 체크아웃은 새 탭으로 연다 — 현재 페이지를 결제 도메인으로 넘기지 않는다.
    // 구매 의도 생성은 /checkout 탭이 맡는다: 클릭과 창 열기 사이에 서버 왕복을
    // 두면 브라우저가 팝업으로 보고 막는다(동작 검증은 Entitlements.purchase.test.tsx).
    expect(pageSource).not.toContain("createPurchaseIntent");
    expect(pageSource).toContain('window.open(path, "_blank")');
    expect(pageSource).not.toContain("window.location.assign");
    expect(pageSource).toContain("결제를 완료하면 이용권이 곧 반영돼요");
  });

  it("offers a payment inquiry channel", () => {
    // 환불을 포함한 결제 문의 채널: 메일 링크 (숨김 톤이지만 존재해야 한다)
    expect(pageSource).toContain("mailto:hansitoring@gmail.com");
    expect(pageSource).toContain("이메일로 문의하기");
  });
});
