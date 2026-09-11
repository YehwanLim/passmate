import { useEffect, useState } from "react";

import type { ReportNavSection } from "@/pages/reportNavigation";

/** 화면 상단 20%~40% 띠에 들어온 섹션을 활성 목차로 잡는다. */
export function useScrollSpy(sections: ReportNavSection[]): string {
  const [activeSection, setActiveSection] = useState(sections[0].id);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (!element) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(section.id);
        },
        { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
      );
      observer.observe(element);
      observers.push(observer);
    });
    return () => observers.forEach((observer) => observer.disconnect());
  }, [sections]);

  return activeSection;
}
