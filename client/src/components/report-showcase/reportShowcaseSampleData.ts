// 랜딩 리포트 미리보기의 장면 목록. 장면마다 실제 예시 리포트의 섹션 하나를 그대로 띄운다(LiveReportPreview).
// 번호는 예시 리포트 목차(reportNavigation, 공고 적합도 포함)와 같다. 다음 단계·실무자 코멘트는 "전체 보기"에서 본다.

export type PreviewSceneId = "impression" | "criteria" | "posting-fit" | "diagnosis" | "line" | "interview";

export type PreviewScene = {
  id: PreviewSceneId;
  indexLabel: string;
  tab: string;
};

export const REPORT_PREVIEW_SCENES: PreviewScene[] = [
  { id: "impression", indexLabel: "01", tab: "첫인상" },
  { id: "criteria", indexLabel: "02", tab: "합격 기준" },
  { id: "posting-fit", indexLabel: "03", tab: "공고 적합도" },
  { id: "diagnosis", indexLabel: "04", tab: "핵심 진단" },
  { id: "line", indexLabel: "05", tab: "문장별 코멘트" },
  { id: "interview", indexLabel: "06", tab: "예상 질문" },
];
