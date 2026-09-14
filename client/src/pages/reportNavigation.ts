export type ReportNavSection = {
    id: string
    indexLabel: string
    label: string
}

const POSTING_FIT_SECTION = { id: 'section-posting-fit', label: '공고 적합도' }

/** 자소서 리포트 목차. 공고 적합도는 채용공고를 붙여 분석한 리포트에만 끼어들고, 번호는 순서대로 다시 매긴다. */
export function buildReportNavSections({ hasPostingFit }: { hasPostingFit: boolean }): ReportNavSection[] {
    const sections: Array<Omit<ReportNavSection, 'indexLabel'>> = [
        { id: 'section-first-impression', label: '첫인상' },
        { id: 'section-company-insight', label: '합격 기준' },
        ...(hasPostingFit ? [POSTING_FIT_SECTION] : []),
        { id: 'section-core-diagnosis', label: '핵심 진단' },
        { id: 'section-line-analysis', label: '문장 분석' },
        { id: 'section-interview-drill', label: '예상 질문' },
        { id: 'section-action-plan', label: '다음 단계' },
        { id: 'section-pm-comment', label: '실무자 코멘트' },
    ]
    return sections.map((section, index) => ({ ...section, indexLabel: String(index + 1).padStart(2, '0') }))
}

export const REPORT_NAV_SECTIONS: ReportNavSection[] = buildReportNavSections({ hasPostingFit: false })
