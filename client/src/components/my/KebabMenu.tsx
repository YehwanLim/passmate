import { useState, useRef, useEffect } from "react";
import { MoreVertical, RotateCcw, PenLine, Trash2 } from "lucide-react";

interface KebabMenuItem {
  label: string;
  icon: typeof RotateCcw;
  onClick: () => void;
  /** true이면 빨간색 위험 아이템 */
  danger?: boolean;
}

interface KebabMenuProps {
  items: KebabMenuItem[];
  /** 여는 버튼의 읽기용 이름. 한 화면에 여러 개면 무엇의 메뉴인지 적는다. */
  label?: string;
}

export default function KebabMenu({ items, label = "More actions" }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-2 rounded-lg hover:bg-fill transition-colors duration-150"
        aria-label={label}
      >
        <MoreVertical className="w-4 h-4 text-ink-4" />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-44 bg-surface border border-line rounded-xl shadow-[0_12px_32px_rgba(18,32,90,0.12)] py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {items.map((item, idx) => {
            const Icon = item.icon;
            const isDanger = item.danger;
            return (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium transition-colors duration-100
                  ${
                    isDanger
                      ? "text-danger hover:bg-danger-soft"
                      : "text-ink-2 hover:bg-fill"
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 기본 My 탭용 케밥 메뉴 아이템 생성 헬퍼 */
export function createDefaultKebabItems(handlers: {
  onReanalyze?: () => void;
  onEditAndReanalyze?: () => void;
  onDelete?: () => void;
}): KebabMenuItem[] {
  const items: KebabMenuItem[] = [];

  if (handlers.onReanalyze) {
    items.push({
      label: "다시 분석하기",
      icon: RotateCcw,
      onClick: handlers.onReanalyze,
    });
  }
  if (handlers.onEditAndReanalyze) {
    items.push({
      label: "수정 후 재분석",
      icon: PenLine,
      onClick: handlers.onEditAndReanalyze,
    });
  }
  if (handlers.onDelete) {
    items.push({
      label: "삭제",
      icon: Trash2,
      onClick: handlers.onDelete,
      danger: true,
    });
  }

  return items;
}
