export type ReportNavSection = {
    id: string
    indexLabel: string
    label: string
}

export const REPORT_NAV_SECTIONS: ReportNavSection[] = [
    { id: 'section-first-impression', indexLabel: '01', label: '첫인상' },
    { id: 'section-company-insight', indexLabel: '02', label: '합격 기준' },
    { id: 'section-core-diagnosis', indexLabel: '03', label: '핵심 진단' },
    { id: 'section-line-analysis', indexLabel: '04', label: '문장 분석' },
    { id: 'section-interview-drill', indexLabel: '05', label: '예상 질문' },
    { id: 'section-action-plan', indexLabel: '06', label: '다음 단계' },
    { id: 'section-pm-comment', indexLabel: '07', label: '실무자 코멘트' },
]
