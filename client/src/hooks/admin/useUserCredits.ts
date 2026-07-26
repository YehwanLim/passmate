import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  applyCouponToUser,
  fetchCreditCoupons,
  fetchUserCreditDetail,
  grantUserCredits,
  type ApplyCouponToUserInput,
  type CreditCoupon,
  type GrantUserCreditsInput,
  type UserCreditDetail,
} from "@/lib/admin-credits";

export interface UseUserCreditsResult {
  detail: UserCreditDetail | null;
  coupons: CreditCoupon[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  grant: (credits: number, note?: string) => Promise<void>;
  applyCoupon: (couponId: string) => Promise<void>;
}

interface UserCreditsSnapshot {
  detail: UserCreditDetail | null;
  coupons: CreditCoupon[];
  isLoading: boolean;
  error: string | null;
}

interface UserCreditsDependencies {
  fetchDetail: (userId: string) => Promise<UserCreditDetail>;
  fetchCoupons: () => Promise<CreditCoupon[]>;
  grantCredits: (input: GrantUserCreditsInput) => Promise<unknown>;
  applyCreditCoupon: (input: ApplyCouponToUserInput) => Promise<unknown>;
}

export interface UserCreditsStore {
  getSnapshot: () => UserCreditsSnapshot;
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<void>;
  grant: (credits: number, note?: string) => Promise<void>;
  applyCoupon: (couponId: string) => Promise<void>;
  dispose: () => void;
}

const defaultDependencies: UserCreditsDependencies = {
  fetchDetail: fetchUserCreditDetail,
  fetchCoupons: fetchCreditCoupons,
  grantCredits: grantUserCredits,
  applyCreditCoupon: applyCouponToUser,
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "사용자 이용권 정보를 처리하지 못했습니다.";
}

export function createUserCreditsStore(
  userId: string,
  dependencies: UserCreditsDependencies = defaultDependencies
): UserCreditsStore {
  let snapshot: UserCreditsSnapshot = {
    detail: null,
    coupons: [],
    isLoading: Boolean(userId),
    error: null,
  };
  let disposed = false;
  let requestVersion = 0;
  const listeners = new Set<() => void>();

  const setSnapshot = (next: Partial<UserCreditsSnapshot>) => {
    if (disposed) return;
    snapshot = { ...snapshot, ...next };
    listeners.forEach(listener => listener());
  };

  const assertActive = () => {
    if (disposed)
      throw new Error(
        "사용자가 변경되었습니다. 이용권 정보를 다시 확인해 주세요."
      );
  };

  const refresh = async () => {
    assertActive();
    if (!userId) {
      setSnapshot({ detail: null, coupons: [], isLoading: false, error: null });
      return;
    }

    const currentRequest = ++requestVersion;
    setSnapshot({ isLoading: true, error: null });
    try {
      const [detail, coupons] = await Promise.all([
        dependencies.fetchDetail(userId),
        dependencies.fetchCoupons(),
      ]);
      if (disposed || currentRequest !== requestVersion) return;
      setSnapshot({ detail, coupons });
    } catch (cause) {
      if (disposed || currentRequest !== requestVersion) return;
      setSnapshot({ error: errorMessage(cause) });
      throw cause;
    } finally {
      if (!disposed && currentRequest === requestVersion) {
        setSnapshot({ isLoading: false });
      }
    }
  };

  const refreshAfterMutation = async () => {
    try {
      await refresh();
    } catch {
      // The write succeeded. Keep it non-retryable and expose refresh.error in state.
    }
  };

  const grant = async (credits: number, note?: string) => {
    assertActive();
    setSnapshot({ error: null });
    try {
      await dependencies.grantCredits({
        userId,
        credits,
        ...(note ? { note } : {}),
      });
    } catch (cause) {
      setSnapshot({ error: errorMessage(cause) });
      throw cause;
    }
    await refreshAfterMutation();
  };

  const applyCoupon = async (couponId: string) => {
    assertActive();
    setSnapshot({ error: null });
    try {
      await dependencies.applyCreditCoupon({ userId, couponId });
    } catch (cause) {
      setSnapshot({ error: errorMessage(cause) });
      throw cause;
    }
    await refreshAfterMutation();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    grant,
    applyCoupon,
    dispose: () => {
      disposed = true;
      requestVersion += 1;
      listeners.clear();
    },
  };
}

export function useUserCredits(userId: string): UseUserCreditsResult {
  const store = useMemo(() => createUserCreditsStore(userId), [userId]);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );

  useEffect(() => {
    void store.refresh().catch(() => {
      // The store exposes the server message for the card to render.
    });
    return store.dispose;
  }, [store]);

  return {
    ...snapshot,
    refresh: store.refresh,
    grant: store.grant,
    applyCoupon: store.applyCoupon,
  };
}
