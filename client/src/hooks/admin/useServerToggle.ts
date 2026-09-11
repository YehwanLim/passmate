import { useCallback, useState } from "react";

/**
 * 서버에 즉시 반영되는 on/off 스위치 하나의 상태(값·저장 중·오류).
 * 초기값은 호출자가 목록 조회 후 setEnabled 로 채운다(null = 아직 모름).
 */
export function useServerToggle({
  update,
  failMessage,
}: {
  /** 서버에 새 값을 저장하고, 서버가 확정한 값을 돌려준다. */
  update: (checked: boolean) => Promise<boolean>;
  failMessage: string;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(
    async (checked: boolean) => {
      setBusy(true);
      setError(null);
      try {
        setEnabled(await update(checked));
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : failMessage);
      } finally {
        setBusy(false);
      }
    },
    [failMessage, update],
  );

  return { enabled, setEnabled, busy, error, setError, toggle };
}
