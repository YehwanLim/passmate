import type { ReportNavSection } from "@/pages/reportNavigation";

/** xl 이상에서 왼쪽에 고정되는 리포트 목차. 자소서·기업 리포트가 섹션 목록만 바꿔 쓴다. */
export function MiniNavigator({
  sections,
  activeSection,
}: {
  sections: ReportNavSection[];
  activeSection: string;
}) {
  return (
    <nav className="report-nav hidden xl:block" aria-label="리포트 목차">
      <div className="report-nav-list">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`report-nav-item ${activeSection === section.id ? "active" : ""}`}
            aria-current={activeSection === section.id ? "location" : undefined}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span className="report-nav-index">{section.indexLabel}.</span>
            <span>{section.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
