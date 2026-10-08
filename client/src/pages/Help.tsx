import { ChevronDown } from "lucide-react";
import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import { GENERAL_INQUIRY_MAILTO, HELP_INQUIRY_EMAIL, HELP_SECTIONS } from "./helpCopy";

/**
 * 고객센터: 자주 묻는 질문 + 문의 메일.
 * 답은 <details> 로 접는다 — 닫혀 있어도 본문이 HTML 에 남아 프리렌더·검색에 그대로 실린다(Radix Accordion 은 닫히면 내용을 지운다).
 */
export default function Help() {
  return (
    <div className="min-h-screen bg-stage text-ink">
      <SiteHeader variant="light" />

      <main className="relative z-10 mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">
        <div className="mb-10">
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-ink sm:text-4xl">고객센터</h1>
          <p className="mt-4 text-[15px] leading-7 text-ink-3">
            자주 받는 질문을 모았어요. 여기서 답을 찾지 못했다면{" "}
            <a href="#contact" className="font-semibold text-brand-ink hover:text-brand">
              메일로 문의 사항을 보내주시면
            </a>{" "}
            최대한 빠르게 답변드릴게요.
          </p>
        </div>

        <div className="space-y-10">
          {HELP_SECTIONS.map(section => (
            <section key={section.title}>
              <h2 className="mb-3 text-lg font-bold tracking-[-0.02em] text-ink">{section.title}</h2>
              <div className="divide-y divide-line-soft overflow-hidden rounded-[20px] bg-surface">
                {section.items.map(item => (
                  <details key={item.q} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold text-ink-2 transition-colors hover:text-ink sm:px-6 [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <ChevronDown
                        aria-hidden="true"
                        className="h-4 w-4 flex-shrink-0 text-ink-4 transition-transform duration-200 group-open:rotate-180"
                      />
                    </summary>
                    <div className="space-y-2 px-5 pb-5 text-[15px] leading-7 text-ink-3 sm:px-6">
                      {item.a.map(paragraph => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      {item.link && (
                        <Link
                          href={item.link.href}
                          className="inline-block pt-1 text-[14px] font-semibold text-brand-ink hover:text-brand"
                        >
                          {item.link.label} →
                        </Link>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}

          <section id="contact" className="scroll-mt-24">
            <h2 className="mb-3 text-lg font-bold tracking-[-0.02em] text-ink">문의하기</h2>
            <div className="divide-y divide-line-soft overflow-hidden rounded-[20px] bg-surface">
              <div className="px-5 py-4 sm:px-6">
                <span className="block text-[15px] font-semibold text-ink-2">결제·환불 문의</span>
                <span className="mt-1 block text-[14px] leading-6 text-ink-4">
                  <span className="font-semibold text-ink-2 select-all">{HELP_INQUIRY_EMAIL}</span> 으로 문의 내용을 적어서
                  보내주시면, 영업일 기준 3일 안에 안내드리겠습니다.
                </span>
              </div>
              <a
                href={GENERAL_INQUIRY_MAILTO}
                className="block px-5 py-4 transition-colors hover:bg-fill-soft sm:px-6"
              >
                <span className="block text-[15px] font-semibold text-ink-2">그 밖의 문의</span>
                <span className="mt-1 block text-[14px] leading-6 text-ink-4">
                  오류 제보, 기능 제안, 제휴 문의 등 궁금한 점은 언제든지 전달주세요. 최대한 빠르게 답변드리겠습니다.
                </span>
              </a>
            </div>
            <p className="mt-3 text-[13px] text-ink-4">메일 주소: {HELP_INQUIRY_EMAIL}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
