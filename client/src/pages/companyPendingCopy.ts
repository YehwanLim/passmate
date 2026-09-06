/**
 * 기업 분석 대기 화면의 안내 문구. 서버는 진행 단계를 알려주지 않으므로
 * 경과 시간만으로 고른다(실제 처리 순서를 보장하는 문구가 아니라 기다림을 돕는 안내).
 * 프로브 기준 1건에 약 50초, 상한 180초.
 */
export type CompanyPendingStep = {
  /** 이 시각(ms) 이후부터 보여 준다. 오름차순. */
  afterMs: number;
  title: string;
  /** 문장 단위. PC에서는 한 문장이 한 줄, 모바일에서는 자연스럽게 이어진다. */
  lines: string[];
};

export const COMPANY_PENDING_STEPS: CompanyPendingStep[] = [
  {
    afterMs: 0,
    title: "공개 자료를 찾고 있어요",
    lines: ["회사 소개, 사업보고서, 최근 기사를 검색하고 있어요.", "화면을 닫아도 분석은 계속됩니다."],
  },
  {
    afterMs: 15_000,
    title: "사업 구조와 실적을 읽는 중이에요",
    lines: ["무엇을 팔아 돈을 버는지, 최근 매출과 이익은 어떤 흐름인지 정리하고 있어요."],
  },
  {
    afterMs: 30_000,
    title: "직무와 이어지는 소식을 고르는 중이에요",
    lines: ["지원 직무와 관련 있는 최근 움직임만 추려 내고 있어요."],
  },
  {
    afterMs: 45_000,
    title: "리포트 문장을 다듬고 있어요",
    lines: ["지원자의 시선으로 기회와 걱정거리, 자소서 소재를 정리하고 있어요."],
  },
  {
    afterMs: 60_000,
    title: "거의 다 됐어요",
    lines: ["출처를 정리하고 마지막 확인을 하고 있어요.", "조금만 기다려 주세요."],
  },
  {
    afterMs: 90_000,
    title: "평소보다 조금 더 걸리고 있어요",
    lines: ["자료가 많은 회사는 2분 가까이 걸리기도 해요.", "화면을 닫아도 분석은 계속됩니다."],
  },
];

export function pickCompanyPendingStep(elapsedMs: number, steps: CompanyPendingStep[] = COMPANY_PENDING_STEPS): CompanyPendingStep {
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  let picked = steps[0];
  for (const step of steps) {
    if (step.afterMs <= elapsed) picked = step;
    else break;
  }
  return picked;
}
