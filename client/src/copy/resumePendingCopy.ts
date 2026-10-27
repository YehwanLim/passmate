import { Clock, Eye, FileText, ListChecks, MessageSquareText, Target } from "lucide-react";

import type { CompanyPendingStep } from "./companyPendingCopy";

/**
 * 자소서 분석 대기 화면의 안내 문구. 기업 분석과 같이 서버는 진행 단계를 알려주지 않아 경과 시간으로만 고른다
 * (실제 처리 순서를 보장하는 문구가 아니라 기다림을 돕는 안내). 10-08 실측 1건 약 70~110초, 상한 180초.
 * 단계 이름은 리포트 섹션(첫인상 → 합격 기준 → 문장별 코멘트 → 면접 질문·총평)을 따른다.
 */
export const RESUME_PENDING_STEPS: CompanyPendingStep[] = [
  {
    afterMs: 0,
    icon: FileText,
    title: "자소서를 처음부터 읽고 있어요",
    lines: ["채용 담당자가 읽는 순서대로 살펴보고 있어요.", "끝나면 리포트를 바로 열어 드릴게요."],
  },
  {
    afterMs: 15_000,
    icon: Eye,
    title: "첫인상을 정리하는 중이에요",
    lines: ["10초, 1분, 3분 동안 읽었을 때 무엇이 기억에 남는지 적고 있어요."],
  },
  {
    afterMs: 35_000,
    icon: Target,
    title: "합격 기준과 맞춰 보는 중이에요",
    lines: ["회사·직무가 찾는 사람과 지금 자소서가 어디까지 맞는지 보고 있어요."],
  },
  {
    afterMs: 55_000,
    icon: MessageSquareText,
    title: "문장마다 코멘트를 달고 있어요",
    lines: ["좋은 문장과 고치면 좋아질 문장을 골라 이유를 적고 있어요."],
  },
  {
    afterMs: 80_000,
    icon: ListChecks,
    title: "리포트를 마무리하고 있어요",
    lines: ["면접에서 나올 만한 질문과 총평을 쓰고 있어요.", "조금만 기다려 주세요."],
  },
  {
    afterMs: 115_000,
    icon: Clock,
    title: "평소보다 조금 더 걸리고 있어요",
    lines: ["문항이 많거나 글이 길면 2분 넘게 걸리기도 해요.", "화면을 닫아도 분석은 계속됩니다."],
  },
];
