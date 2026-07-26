import { useCallback, useEffect, useState } from "react";
import {
  applyCouponToUser,
  fetchCreditCoupons,
  fetchUserCreditDetail,
  grantUserCredits,
  type CreditCoupon,
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

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "사용자 이용권 정보를 처리하지 못했습니다.";
}

export function useUserCredits(userId: string): UseUserCreditsResult {
  const [detail, setDetail] = useState<UserCreditDetail | null>(null);
  const [coupons, setCoupons] = useState<CreditCoupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setDetail(null);
      setCoupons([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [nextDetail, nextCoupons] = await Promise.all([
        fetchUserCreditDetail(userId),
        fetchCreditCoupons(),
      ]);
      setDetail(nextDetail);
      setCoupons(nextCoupons);
    } catch (cause) {
      setError(errorMessage(cause));
      throw cause;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh().catch(() => {
      // refresh stores the server message in state for the card to render.
    });
  }, [refresh]);

  const grant = useCallback(
    async (credits: number, note?: string) => {
      setError(null);
      try {
        await grantUserCredits({ userId, credits, ...(note ? { note } : {}) });
        await refresh();
      } catch (cause) {
        setError(errorMessage(cause));
        throw cause;
      }
    },
    [refresh, userId]
  );

  const applyCoupon = useCallback(
    async (couponId: string) => {
      setError(null);
      try {
        await applyCouponToUser({ userId, couponId });
        await refresh();
      } catch (cause) {
        setError(errorMessage(cause));
        throw cause;
      }
    },
    [refresh, userId]
  );

  return { detail, coupons, isLoading, error, refresh, grant, applyCoupon };
}
