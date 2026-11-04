import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { isInternalBrowser } from "@/lib/internalTraffic";
import { sendFunnelEvent } from "@/lib/siteVisits";

const CARD_CLASS = "print:hidden rounded-3xl bg-surface px-6 py-8 md:px-10 md:py-9";

type Step = "intro" | "details" | "applied" | "dismissed";

/**
 * 모의면접 수요 시험(.agents/growth/experiments.md X3). 아직 없는 기능이라 결제는 받지 않고,
 * 가격을 본 뒤 출시 알림을 신청하는지만 잰다. 신청자는 client_events 의 userId 로 찾아 안내 메일을 1회 보낸다.
 */
export default function MockInterviewInterestCard({
  // 개발 서버·운영자 브라우저는 이벤트를 보내지 않아 항상 false 가 돌아온다. 그때는 실패로 치지 않는다.
  trackingActive = import.meta.env.PROD && !isInternalBrowser(),
}: {
  trackingActive?: boolean;
}) {
  const [step, setStep] = useState<Step>("intro");
  const [applying, setApplying] = useState(false);
  const [failed, setFailed] = useState(false);

  const openDetails = () => {
    void sendFunnelEvent("report_mock_interview_click", "report");
    setStep("details");
  };

  const apply = async () => {
    setApplying(true);
    setFailed(false);
    const recorded = await sendFunnelEvent("report_mock_interview_apply", "report");
    setApplying(false);
    // 기록이 곧 수신 동의이자 발송 명단이다. 안 남았는데 "신청했어요"라고 하면 약속을 어기게 된다.
    if (recorded || !trackingActive) setStep("applied");
    else setFailed(true);
  };

  if (step === "dismissed") return null;

  if (step === "applied") {
    return (
      <section className={CARD_CLASS}>
        <h3 className="flex items-center gap-2 text-[20px] font-bold text-ink">
          <Check className="size-5 text-ok" aria-hidden="true" />
          신청했어요
        </h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-ink-3 text-pretty">
          출시되면 가입한 메일로 알려 드릴게요.
        </p>
      </section>
    );
  }

  if (step === "details") {
    return (
      <section className={CARD_CLASS}>
        <h3 className="text-[20px] font-bold text-ink text-balance">아직 만들고 있어요</h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-ink-3 text-pretty">
          1회 4,900원으로 준비 중이에요. 출시되면 가입한 메일로 한 번만 알려 드릴까요? 지금 결제되는 건 없어요.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <button
            type="button"
            disabled={applying}
            onClick={() => void apply()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-soft px-6 py-3.5 font-bold text-brand-ink transition-colors hover:bg-[#dbe9ff] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            {applying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>알려 주세요</span>
          </button>
          <button
            type="button"
            onClick={() => setStep("dismissed")}
            className="w-full rounded-xl px-6 py-3.5 font-semibold text-ink-3 transition-colors hover:bg-fill sm:w-auto"
          >
            괜찮아요
          </button>
        </div>
        {failed && (
          <p role="alert" className="mt-3 text-[14px] leading-relaxed text-danger">
            신청이 저장되지 않았어요. 잠시 뒤 다시 눌러 주세요.
          </p>
        )}
        <p className="mt-4 text-[13px] leading-relaxed text-ink-4 text-pretty">
          알려 주세요를 누르면 모의면접 출시 안내(광고성 정보)를 가입한 메일로 1회 받는 데 동의하는 거예요. 안내를 보낸 뒤에는 이 신청으로 다시 연락하지 않아요. 신청하지 않아도 다른 기능은 그대로 쓸 수 있어요.
        </p>
      </section>
    );
  }

  return (
    <section className={CARD_CLASS}>
      <h3 className="text-[20px] font-bold text-ink text-balance">이 질문들, 직접 답해 보고 싶나요?</h3>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink-3 text-pretty">
        내 자소서를 읽은 면접관처럼 질문하고, 글로 답하면 꼬리 질문과 피드백을 드리는 연습이에요.
      </p>
      <button
        type="button"
        onClick={openDetails}
        className="mt-6 flex w-full items-center justify-center rounded-xl bg-brand-soft px-6 py-3.5 font-bold text-brand-ink transition-colors hover:bg-[#dbe9ff] sm:w-auto"
      >
        어떤 건지 보기
      </button>
    </section>
  );
}
