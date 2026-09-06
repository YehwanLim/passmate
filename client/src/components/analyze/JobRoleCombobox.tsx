import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BriefcaseBusiness, Plus, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { filterJobRoleCategories } from "@/constants/jobRoles";

/** 직무명 자동완성 입력. 자소서 분석(Analyze)과 기업 분석(CompanyAnalyze)이 함께 쓴다. */
export default function JobRoleCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 입력값으로 필터링된 카테고리별 직무 목록
  const filtered = useMemo(() => filterJobRoleCategories(value), [value]);

  const showDropdown =
    isFocused && (filtered.length > 0 || value.trim() !== "");

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

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          // 목록에서 고른 뒤에도 포커스가 인풋에 남아 있어 onFocus가 다시 오지 않는다
          onClick={() => setIsFocused(true)}
          maxLength={100}
          placeholder="직무를 검색하거나 직접 입력하세요"
          className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-600 rounded-xl h-12 pl-11 pr-10 text-[15px] focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/10 transition-colors"
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
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="absolute z-30 mt-2 w-full max-h-60 overflow-y-auto rounded-xl border border-white/[0.1] bg-[#141414] backdrop-blur-xl shadow-2xl shadow-black/40 py-1.5"
          >
            {filtered.length > 0 ? (
              filtered.map(category => (
                <div key={category.name}>
                  <p className="px-4 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                    {category.name}
                  </p>
                  <ul>
                    {category.roles.map(role => (
                      <li key={role}>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            onChange(role);
                            setIsFocused(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                            value === role
                              ? "text-cyan-400 bg-cyan-400/[0.08]"
                              : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          <BriefcaseBusiness className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                          {role}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setIsFocused(false)}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 text-cyan-400 hover:bg-white/[0.06]"
              >
                <Plus className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span className="font-medium">"{value}"</span> 직접 입력하기
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
