import { useEffect, useState, type KeyboardEvent } from "react";

/**
 * 자동완성 목록의 키보드 탐색. 회사·직무 콤보박스가 함께 쓴다.
 * ↓/↑ 로 강조 항목을 옮기고, 강조된 상태에서 Enter 로 고르고, Escape 로 닫는다.
 * 목록이 바뀌거나(resetKey) 닫히면 강조를 푼다. 한글 조합 중 키는 무시한다.
 */
export function useComboboxNavigation({
  count,
  isOpen,
  resetKey,
  onSelect,
  onClose,
}: {
  count: number;
  isOpen: boolean;
  resetKey: string;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const [highlight, setHighlight] = useState(-1);

  useEffect(() => {
    setHighlight(-1);
  }, [resetKey, isOpen]);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if ((e.nativeEvent as globalThis.KeyboardEvent).isComposing) return;
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (!isOpen || count === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => (h + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => (h <= 0 ? count - 1 : h - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      onSelect(highlight);
    }
  }

  return { highlight, onKeyDown };
}
