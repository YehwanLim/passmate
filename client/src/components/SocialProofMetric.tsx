import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { SocialProofMetric } from "@/constants/socialProof";

type SocialProofMetricCardProps = {
  metric: SocialProofMetric;
  isActive: boolean;
};

const COUNT_UP_DURATION_MS = 1200;

export function formatSocialProofMetric(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function SocialProofMetricCard({
  metric,
  isActive,
}: SocialProofMetricCardProps) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    if (shouldReduceMotion) {
      setDisplayValue(metric.value);
      return;
    }

    let frameId = 0;
    let startedAt: number | undefined;

    const tick = (now: number) => {
      startedAt ??= now;
      const progress = Math.min(
        (now - startedAt) / COUNT_UP_DURATION_MS,
        1
      );
      const easedProgress = 1 - Math.pow(1 - progress, 4);

      setDisplayValue(Math.round(metric.value * easedProgress));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [isActive, metric.value, shouldReduceMotion]);

  return (
    <div className="social-proof-metric">
      <p className="social-proof-metric-value tabular-nums">
        <span className="social-proof-metric-number">
          {formatSocialProofMetric(displayValue)}{metric.suffix}
        </span>
      </p>
      <p className="social-proof-metric-label">{metric.label}</p>
    </div>
  );
}
