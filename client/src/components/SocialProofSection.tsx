import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  ACCEPTANCE_TESTIMONIALS,
  SUCCESSFUL_COMPANIES,
  SUCCESSFUL_COMPANY_COUNT,
} from "@/constants/socialProof";

export {
  ACCEPTANCE_TESTIMONIALS,
  SUCCESSFUL_COMPANIES,
  SUCCESSFUL_COMPANY_COUNT,
} from "@/constants/socialProof";

const marqueeCompanyGroups = [SUCCESSFUL_COMPANIES, SUCCESSFUL_COMPANIES];

export function getSocialProofRevealProps(shouldReduceMotion: boolean) {
  if (shouldReduceMotion) {
    return { initial: false };
  }

  return {
    initial: { opacity: 0, y: 32 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
  };
}

function TestimonialStars({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-1 text-zinc-200"
      aria-label={`평점 ${rating}점`}
    >
      {Array.from({ length: rating }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className="h-3.5 w-3.5 fill-current"
        />
      ))}
    </div>
  );
}

export default function SocialProofSection() {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const revealProps = getSocialProofRevealProps(shouldReduceMotion);
  const revealTransition = shouldReduceMotion
    ? undefined
    : { duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] as const };

  return (
    <section
      className="overflow-hidden border-t border-white/[0.04] py-28 md:py-36"
      aria-labelledby="social-proof-title"
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <motion.div
          className="text-center"
          {...revealProps}
          transition={revealTransition}
        >
          <span className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-gray-600">
            <span className="h-px w-4 bg-gray-700" />
            합격 기업
          </span>
          <h2
            id="social-proof-title"
            className="text-3xl font-bold tracking-tight md:text-5xl"
          >
            이미 많은 합격자들이
            <span className="block">PreView로 자소서를 완성했습니다.</span>
          </h2>
          <div className="mt-10">
            <p className="text-7xl font-semibold tracking-[-0.07em] tabular-nums md:text-9xl">
              {SUCCESSFUL_COMPANY_COUNT.toLocaleString()}+
            </p>
            <p className="mt-3 text-[15px] font-light text-gray-500">
              합격 기업
            </p>
          </div>
        </motion.div>
      </div>

      <div
        className="social-proof-marquee mt-14 border-y border-white/[0.06] py-6"
        aria-label="합격 기업 목록"
      >
        <div className="social-proof-marquee-track" aria-hidden="true">
          {marqueeCompanyGroups.map((companies, groupIndex) => (
            <div className="social-proof-marquee-group" key={groupIndex}>
              {companies.map(company => (
                <span
                  key={company.id}
                  className="social-proof-wordmark text-[15px] font-semibold tracking-[-0.035em] text-zinc-500 sm:text-[17px]"
                >
                  {company.wordmark}
                </span>
              ))}
            </div>
          ))}
        </div>
        <ul className="sr-only">
          {SUCCESSFUL_COMPANIES.map(company => (
            <li key={company.id}>{company.name}</li>
          ))}
        </ul>
      </div>

      <div className="mx-auto mt-20 max-w-6xl px-6 lg:px-10">
        <motion.div {...revealProps} transition={revealTransition}>
          <Carousel opts={{ align: "start", loop: false }} className="w-full">
            <div className="mb-6 flex items-end justify-between gap-6">
              <div>
                <span className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-gray-600">
                  <span className="h-px w-4 bg-gray-700" />
                  합격 후기
                </span>
                <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  실제 합격 후기
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <CarouselPrevious
                  aria-label="이전 후기"
                  className="static h-9 w-9 translate-x-0 translate-y-0 border-white/[0.1] bg-white/[0.025] text-zinc-400 hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-white"
                />
                <CarouselNext
                  aria-label="다음 후기"
                  className="static h-9 w-9 translate-x-0 translate-y-0 border-white/[0.1] bg-white/[0.025] text-zinc-400 hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-white"
                />
              </div>
            </div>

            <CarouselContent>
              {ACCEPTANCE_TESTIMONIALS.map(testimonial => (
                <CarouselItem
                  key={testimonial.id}
                  className="basis-full sm:basis-1/2 lg:basis-1/3"
                >
                  <article className="flex h-full min-h-[248px] flex-col rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 backdrop-blur-sm transition-colors duration-300 hover:border-white/[0.13]">
                    <TestimonialStars rating={testimonial.rating} />
                    <blockquote className="mt-6 text-[16px] font-light leading-[1.8] tracking-[-0.01em] text-zinc-200">
                      &ldquo;{testimonial.quote}&rdquo;
                    </blockquote>
                    <footer className="mt-auto border-t border-white/[0.06] pt-5">
                      <p className="text-[14px] font-semibold text-white">
                        {testimonial.company}
                      </p>
                      <p className="mt-1 text-[13px] font-light text-zinc-500">
                        {testimonial.role} <span aria-hidden="true">·</span>{" "}
                        {testimonial.period}
                      </p>
                    </footer>
                  </article>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </motion.div>
      </div>
    </section>
  );
}
