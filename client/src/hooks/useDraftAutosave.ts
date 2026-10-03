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
  const inFlight = useRef(false);
  const latest = useRef(value);
  const saveRef = useRef(save);
  const conflictRef = useRef(isConflict);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  latest.current = value;
  saveRef.current = save;
  conflictRef.current = isConflict;

  // 대기 중이던 상태를 풀 때: 저장한 적이 있으면 saved, 없으면 idle.
  const settle = useCallback(() => {
    setState((current) => (current === "pending" ? (hasSaved.current ? "saved" : "idle") : current));
  }, []);

  const run = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // 저장은 한 번에 하나만. 진행 중이면 끝난 뒤 최신 값과 비교해서 다시 보낸다(flush 포함).
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      for (;;) {
        const snapshot = JSON.stringify(latest.current);
        if (snapshot === savedSnapshot.current) {
          settle();
          return;
        }
        setState("saving");
        try {
          await saveRef.current(latest.current);
        } catch (error) {
          setState(conflictRef.current(error) ? "conflict" : "error");
          return;
        }
        savedSnapshot.current = snapshot;
        hasSaved.current = true;
        setLastSavedAt(new Date());
        // 저장하는 동안 값이 또 바뀌었으면 saved 로 두지 않고 한 번 더 보낸다.
        if (JSON.stringify(latest.current) === snapshot) {
          setState("saved");
          return;
        }
        if (timer.current) {
          clearTimeout(timer.current);
          timer.current = null;
        }
      }
    } finally {
      inFlight.current = false;
    }
  }, [settle]);

  useEffect(() => {
    if (!enabled) return;
    const snapshot = JSON.stringify(value);
    if (savedSnapshot.current === null) {
      savedSnapshot.current = baseline === undefined ? snapshot : JSON.stringify(baseline);
      if (baseline === undefined) return;
    }
    if (snapshot === savedSnapshot.current) {
      // 저장 전에 값이 기준선으로 되돌아오면 대기 상태를 풀어 준다.
      settle();
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
  }, [value, enabled, delayMs, run, settle]);

  return { state, lastSavedAt, flush: run };
}
