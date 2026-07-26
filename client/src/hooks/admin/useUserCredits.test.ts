import { describe, expect, it, vi } from "vitest";
import type { CreditCoupon, UserCreditDetail } from "@/lib/admin-credits";

vi.mock("@/lib/admin-credits", () => ({
  applyCouponToUser: vi.fn(),
  fetchCreditCoupons: vi.fn(),
  fetchUserCreditDetail: vi.fn(),
  grantUserCredits: vi.fn(),
}));

import * as userCreditsModule from "./useUserCredits";

const USER_A = "22222222-2222-4222-8222-222222222222";
const USER_B = "33333333-3333-4333-8333-333333333333";

const DETAIL: UserCreditDetail = {
  summary: {
    freeRemaining: 1,
    bonusRemaining: 0,
    premiumRemaining: 0,
    premiumEnabled: false,
    remaining: 1,
  },
  grants: [],
};

interface TestStore {
  getSnapshot: () => {
    detail: UserCreditDetail | null;
    coupons: CreditCoupon[];
    isLoading: boolean;
    error: string | null;
  };
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<void>;
  grant: (credits: number, note?: string) => Promise<void>;
  applyCoupon: (couponId: string) => Promise<void>;
  dispose: () => void;
}

function dependencies() {
  return {
    fetchDetail: vi.fn<() => Promise<UserCreditDetail>>(),
    fetchCoupons: vi.fn<() => Promise<CreditCoupon[]>>(),
    grantCredits: vi.fn<() => Promise<unknown>>(),
    applyCreditCoupon: vi.fn<() => Promise<unknown>>(),
  };
}

function createStore(
  userId: string,
  deps: ReturnType<typeof dependencies>
): TestStore {
  return (
    userCreditsModule.createUserCreditsStore as unknown as (
      userId: string,
      deps: ReturnType<typeof dependencies>
    ) => TestStore
  )(userId, deps);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("user credit state", () => {
  it("provides a testable user-bound credit store", () => {
    expect(userCreditsModule).toHaveProperty("createUserCreditsStore");
  });

  it("does not reject a successful direct grant when its refresh fails", async () => {
    const deps = dependencies();
    deps.grantCredits.mockResolvedValue({});
    deps.fetchDetail.mockRejectedValue(new Error("새로고침 실패"));
    deps.fetchCoupons.mockResolvedValue([]);
    const store = createStore(USER_A, deps);

    await expect(store.grant(2, "support")).resolves.toBeUndefined();

    expect(deps.grantCredits).toHaveBeenCalledOnce();
    expect(store.getSnapshot().error).toBe("새로고침 실패");
  });

  it("does not reject a successful coupon application when its refresh fails", async () => {
    const deps = dependencies();
    deps.applyCreditCoupon.mockResolvedValue({});
    deps.fetchDetail.mockRejectedValue(new Error("새로고침 실패"));
    deps.fetchCoupons.mockResolvedValue([]);
    const store = createStore(USER_A, deps);

    await expect(store.applyCoupon("coupon-id")).resolves.toBeUndefined();

    expect(deps.applyCreditCoupon).toHaveBeenCalledOnce();
    expect(store.getSnapshot().error).toBe("새로고침 실패");
  });

  it("ignores an old user's load completion after disposal", async () => {
    const deps = dependencies();
    const detailRequest = deferred<UserCreditDetail>();
    const couponsRequest = deferred<CreditCoupon[]>();
    deps.fetchDetail.mockReturnValue(detailRequest.promise);
    deps.fetchCoupons.mockReturnValue(couponsRequest.promise);
    const store = createStore(USER_A, deps);
    const listener = vi.fn();
    store.subscribe(listener);

    const loading = store.refresh();
    store.dispose();
    detailRequest.resolve(DETAIL);
    couponsRequest.resolve([]);
    await loading;

    expect(store.getSnapshot().detail).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("blocks actions retained from a disposed user store", async () => {
    const deps = dependencies();
    const store = createStore(USER_A, deps);
    store.dispose();

    await expect(store.grant(2)).rejects.toThrow("사용자가 변경되었습니다");
    await expect(store.applyCoupon("coupon-id")).rejects.toThrow(
      "사용자가 변경되었습니다"
    );
    expect(deps.grantCredits).not.toHaveBeenCalled();
    expect(deps.applyCreditCoupon).not.toHaveBeenCalled();
  });

  it("starts a new user store without the previous user's detail", async () => {
    const firstDeps = dependencies();
    firstDeps.fetchDetail.mockResolvedValue(DETAIL);
    firstDeps.fetchCoupons.mockResolvedValue([]);
    const firstStore = createStore(USER_A, firstDeps);
    await firstStore.refresh();

    const nextDeps = dependencies();
    const nextStore = createStore(USER_B, nextDeps);

    expect(firstStore.getSnapshot().detail).toBe(DETAIL);
    expect(nextStore.getSnapshot().detail).toBeNull();
    expect(nextStore.getSnapshot().isLoading).toBe(true);
  });
});
