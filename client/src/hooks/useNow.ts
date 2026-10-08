import { useSyncExternalStore } from "react";

/**
 * 지금 시각(분 단위로 끊음). 프리렌더(SSR)와 하이드레이션 첫 패스는 null 이라 서버 HTML 과 첫 화면이 같고,
 * 바로 다음 렌더에서 브라우저 시각으로 바뀐다. "접수 중·D-n" 처럼 시각에 달린 표시는 이 값이 있을 때만 그린다.
 */
let cached: { minute: number; date: Date } = { minute: -1, date: new Date(0) };

function getSnapshot(): Date {
  const minute = Math.floor(Date.now() / 60_000);
  if (minute !== cached.minute) cached = { minute, date: new Date(minute * 60_000) };
  return cached.date;
}

function subscribe(onChange: () => void): () => void {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
}

const getServerSnapshot = () => null;

export function useNow(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
