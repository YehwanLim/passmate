import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BriefcaseBusiness, Plus, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { filterJobRoleCategories } from "@/constants/jobRoles";
import { useComboboxNavigation } from "@/hooks/useComboboxNavigation";

/** 직무명 자동완성 입력. 자소서 분석(Analyze)과 기업 분석(CompanyAnalyze)이 함께 쓴다. */
export default function JobRoleCombobox({
  value,
  onChange,
  onCommit,
  ariaLabel,
  inputRef,
  placeholder = "직무를 검색하거나 직접 입력하세요",
  disabled = false,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  /** 값이 정해졌을 때(목록에서 고름·Enter·위젯 밖으로 나감). 마이페이지 새 지원서가 이때 지원서를 만든다. */
  onCommit?: (v: string) => void;
  ariaLabel?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  placeholder?: string;
  disabled?: boolean;
  /** 마이페이지 옆 칸처럼 좁은 자리에 맞춘 높이·글자 */
  compact?: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 입력값으로 필터링된 카테고리별 직무 목록
  const filtered = useMemo(() => filterJobRoleCategories(value), [value]);
  // 카테고리를 펼친 순서가 방향키 인덱스다
  const flatRoles = useMemo(
    () => filtered.flatMap(category => category.roles),
    [filtered]
  );

  const showDropdown =
    isFocused && (filtered.length > 0 || value.trim() !== "");

  // 목록이 비면 "직접 입력하기" 한 줄만 있다
  const { highlight, onKeyDown } = useComboboxNavigation({
    count: flatRoles.length > 0 ? flatRoles.length : 1,
    isOpen: showDropdown,
    resetKey: value,
    onSelect: index => {
      if (flatRoles.length > 0) onChange(flatRoles[index]);
      onCommit?.(flatRoles.length > 0 ? flatRoles[index] : value);
      setIsFocused(false);
    },
    onClose: () => setIsFocused(false),
  });

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 방향키로 옮긴 강조 항목이 보이게 스크롤
  useEffect(() => {
    if (highlight < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-highlighted="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [highlight]);

  let cursor = 0;

  return (
    <div
      ref={wrapperRef}
      className="relative"
      // Tab·프로그램 포커스 이동으로 포커스가 이 위젯(인풋·초기화 버튼·목록) 밖으로 나가면 닫는다.
      // 목록 항목은 onMouseDown에서 preventDefault 하므로 항목 클릭 중에는 blur가 오지 않는다
      onBlur={e => {
        if (!wrapperRef.current?.contains(e.relatedTarget as Node | null)) {
          setIsFocused(false);
          onCommit?.(value);
        }
      }}
      onKeyDown={e => {
        onKeyDown(e);
        // 목록에서 고르지 않은 Enter 는 적은 그대로 정한다
        if (e.key === "Enter" && !e.defaultPrevented && !(e.nativeEvent as KeyboardEvent).isComposing) {
          onCommit?.(value);
        }
      }}
    >
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4 pointer-events-none" />
        <Input
          ref={inputRef}
          aria-label={ariaLabel}
          disabled={disabled}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          // 목록에서 고른 뒤에도 포커스가 인풋에 남아 있어 onFocus가 다시 오지 않는다
          onClick={() => setIsFocused(true)}
          maxLength={100}
          placeholder={placeholder}
          className={`border-line bg-surface text-ink placeholder:text-ink-5 rounded-xl pl-11 pr-10 focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all ${
            compact ? "h-11 text-[14.5px] font-normal" : "h-12 text-[15px]"
          }`}
        />
        {value && (
          <button
            type="button"
            // Tab 한 번에 다음 칸으로 넘어가도록 탭 순서에서 뺀다. 키보드는 방향키·Enter 로 고른다
            tabIndex={-1}
            onClick={() => onChange("")}
            disabled={disabled}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-5 hover:text-ink-2 hover:bg-fill transition-colors"
            aria-label="입력 초기화"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 자동완성 드롭다운 */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            ref={listRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="absolute z-30 mt-2 w-full max-h-60 overflow-y-auto rounded-xl border border-line bg-surface py-1.5 font-normal shadow-[0_12px_32px_rgba(25,31,40,0.12)]"
          >
            {filtered.length > 0 ? (
              filtered.map(category => (
                <div key={category.name}>
                  <p className="px-4 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-5">
                    {category.name}
                  </p>
                  <ul>
                    {category.roles.map(role => {
                      const index = cursor++;
                      return (
                        <li key={role}>
                          <button
                            type="button"
                            tabIndex={-1}
                            data-highlighted={highlight === index}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              onChange(role);
                              onCommit?.(role);
                              setIsFocused(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                              value === role
                                ? "text-brand bg-brand-soft"
                                : highlight === index
                                  ? "text-ink bg-fill"
                                  : "text-ink-2 hover:bg-fill hover:text-ink"
                            }`}
                          >
                            <BriefcaseBusiness className="w-4 h-4 text-ink-5 flex-shrink-0" />
                            {role}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            ) : (
              <button
                type="button"
                tabIndex={-1}
                data-highlighted={highlight === 0}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  onCommit?.(value);
                  setIsFocused(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 text-brand hover:bg-fill ${
                  highlight === 0 ? "bg-fill" : ""
                }`}
              >
                <Plus className="w-4 h-4 text-brand flex-shrink-0" />
                <span className="font-medium">"{value}"</span> 직접 입력하기
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
