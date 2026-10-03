import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error" | "conflict";

/**
 * 작업실 에디터 자동 저장. 입력이 delayMs 동안 멈추면 저장하고, 마지막 저장값과 같으면 보내지 않는다.
 * enabled 가 켜지는 순간의 값은 서버에서 불러온 값으로 보고 저장 기준선으로 삼는다.
 */
export function useDraftAutosave<T>({
  value,
  save,
  delayMs = 1500,
  enabled = true,
  baseline,
  isConflict = () => false,
}: {
  value: T;
  save: (value: T) => Promise<void>;
  delayMs?: number;
  enabled?: boolean;
  baseline?: T;
  isConflict?: (error: unknown) => boolean;
}) {
  const [state, setState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const savedSnapshot = useRef<string | null>(null);
  const hasSaved = useRef(false);
  const latest = useRef(value);
  const saveRef = useRef(save);
  const conflictRef = useRef(isConflict);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  latest.current = value;
  saveRef.current = save;
  conflictRef.current = isConflict;

  const run = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const snapshot = JSON.stringify(latest.current);
    if (snapshot === savedSnapshot.current) {
      setState((current) => (current === "pending" ? "saved" : current));
      return;
    }
    setState("saving");
    try {
      await saveRef.current(latest.current);
      savedSnapshot.current = snapshot;
      hasSaved.current = true;
      setLastSavedAt(new Date());
      setState("saved");
    } catch (error) {
      setState(conflictRef.current(error) ? "conflict" : "error");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const snapshot = JSON.stringify(value);
    if (savedSnapshot.current === null) {
      savedSnapshot.current = baseline === undefined ? snapshot : JSON.stringify(baseline);
      if (baseline === undefined) return;
    }
    if (snapshot === savedSnapshot.current) {
      // 저장 전에 값이 기준선으로 되돌아오면 대기 상태를 풀어 준다.
      setState((current) => (current === "pending" ? (hasSaved.current ? "saved" : "idle") : current));
      return;
    }
    setState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void run();
    }, delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // baseline 은 첫 활성화 때 한 번만 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled, delayMs, run]);

  return { state, lastSavedAt, flush: run };
}
