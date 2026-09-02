import { useEffect, useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useMouseField } from "@/hooks/useMouseField";

const WOBBLE_FILTER_ID = "mood-shift-wobble";

// 레이어별 패럴랙스 계수 — 마우스가 중심에서 벗어난 만큼 배경이 이동
const BASE_FACTOR = 0.03;
const WASH_FACTOR = 0.055;
const SHIMMER_FACTOR = -0.08; // 역방향이라 깊이감이 생긴다

const PARALLAX_SPRING = { damping: 42, stiffness: 100, mass: 1 };

function useParallax(
  mouseX: MotionValue<number>,
  mouseY: MotionValue<number>,
  factor: number
) {
  const dx = useTransform(mouseX, value =>
    typeof window === "undefined" ? 0 : (value - window.innerWidth / 2) * factor
  );
  const dy = useTransform(mouseY, value =>
    typeof window === "undefined"
      ? 0
      : (value - window.innerHeight / 2) * factor
  );
  return {
    x: useSpring(dx, PARALLAX_SPRING),
    y: useSpring(dy, PARALLAX_SPRING),
  };
}

/**
 * MoodShiftBackground (무드 시프트)
 *
 * 배경 자체가 마우스에 반응한다:
 * - 베이스 그라데이션이 검정이 아니라 은은하게 색을 띠고,
 * - 반짝임 글로우 5개가 떠다니며 밝아졌다 어두워지고,
 * - 마우스 위치에 따라 좌(청록)/우(보라)로 전체 색조가 물들며,
 * - 레이어들이 마우스 방향으로 패럴랙스 이동하고 약하게 꿀렁인다.
 * - 작지만 그라데이션이 뚜렷한 글로우 하나가 출렁이며 커서를 따라온다.
 */
export default function MoodShiftBackground() {
  const reduceMotion = useReducedMotion();
  const { mouseX, mouseY } = useMouseField();
  const displacementRef = useRef<SVGFEDisplacementMapElement | null>(null);

  // 색조 크로스페이드 — 좌우 이동이 분명히 보이도록 살짝 민첩하게
  const toneX = useSpring(mouseX, { damping: 40, stiffness: 140, mass: 0.8 });
  const cyanOpacity = useTransform(toneX, value =>
    typeof window === "undefined"
      ? 0.55
      : 1.0 - Math.min(Math.max(value / window.innerWidth, 0), 1) * 0.9
  );
  const violetOpacity = useTransform(toneX, value =>
    typeof window === "undefined"
      ? 0.55
      : 0.1 + Math.min(Math.max(value / window.innerWidth, 0), 1) * 0.9
  );

  const baseParallax = useParallax(mouseX, mouseY, BASE_FACTOR);
  const washParallax = useParallax(mouseX, mouseY, WASH_FACTOR);
  const shimmerParallax = useParallax(mouseX, mouseY, SHIMMER_FACTOR);

  // 커서 팔로워 — 민첩하게 따라붙되 멈출 때 아주 살짝만 출렁인다
  const coreX = useSpring(mouseX, { damping: 26, stiffness: 320, mass: 0.7 });
  const coreY = useSpring(mouseY, { damping: 26, stiffness: 320, mass: 0.7 });
  const coreXPct = useTransform(coreX, value =>
    typeof window === "undefined"
      ? "50%"
      : `${((value / window.innerWidth) * 100).toFixed(1)}%`
  );
  const coreYPct = useTransform(coreY, value =>
    typeof window === "undefined"
      ? "50%"
      : `${((value / window.innerHeight) * 100).toFixed(1)}%`
  );
  // 작지만 단계가 뚜렷한 그라데이션: 밝은 코어 → 청록 → 파랑 → 보라
  const followerGlow = useMotionTemplate`radial-gradient(circle 12vmax at ${coreXPct} ${coreYPct}, rgba(196,215,255,0.24) 0%, rgba(34,211,238,0.17) 14%, rgba(59,130,246,0.09) 36%, rgba(124,58,237,0.05) 55%, transparent 72%)`;

  // 마우스 속도 → 꿀렁 강도(displacement scale)
  useEffect(() => {
    if (reduceMotion) {
      displacementRef.current?.setAttribute("scale", "0");
      return;
    }
    let frame: number;
    let prev = { x: mouseX.get(), y: mouseY.get(), t: performance.now() };
    let speed = 0;
    const tick = () => {
      const now = performance.now();
      const dt = Math.max((now - prev.t) / 1000, 0.001);
      const x = mouseX.get();
      const y = mouseY.get();
      const dx = x - prev.x;
      const dy = y - prev.y;
      prev = { x, y, t: now };
      const inst = Math.min(Math.sqrt(dx * dx + dy * dy) / dt / 1400, 1);
      speed += (inst - speed) * (1 - Math.exp(-4 * dt));
      displacementRef.current?.setAttribute(
        "scale",
        (8 + speed * 26).toFixed(1)
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mouseX, mouseY, reduceMotion]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg width="0" height="0" className="absolute">
        <filter
          id={WOBBLE_FILTER_ID}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006 0.010"
            numOctaves="2"
            seed="7"
            result="wobble-noise"
          >
            <animate
              attributeName="baseFrequency"
              dur="16s"
              values="0.006 0.010;0.0085 0.013;0.006 0.010"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            ref={displacementRef}
            in="SourceGraphic"
            in2="wobble-noise"
            scale="8"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      <div
        className="absolute inset-0"
        style={
          reduceMotion
            ? undefined
            : { filter: `url(#${WOBBLE_FILTER_ID})`, willChange: "filter" }
        }
      >
        {/* 베이스: 검정이 아니라 네 방향에서 은은하게 색을 띠는 바탕.
            inset-[-10%] 블리드는 패럴랙스 이동 시 가장자리가 비지 않게 한다 */}
        <motion.div
          className="absolute inset-[-10%]"
          style={{
            x: reduceMotion ? 0 : baseParallax.x,
            y: reduceMotion ? 0 : baseParallax.y,
            background:
              "radial-gradient(ellipse 80% 55% at 50% -5%, rgba(99,102,241,0.09) 0%, transparent 62%), radial-gradient(ellipse 55% 45% at 10% 34%, rgba(34,211,238,0.055) 0%, transparent 66%), radial-gradient(ellipse 55% 45% at 90% 40%, rgba(124,58,237,0.065) 0%, transparent 66%), radial-gradient(ellipse 75% 40% at 50% 104%, rgba(59,130,246,0.05) 0%, transparent 68%)",
          }}
        />

        {/* 색조 크로스페이드: 마우스가 왼쪽이면 청록, 오른쪽이면 보라 */}
        <motion.div
          className="absolute inset-[-10%]"
          style={{
            x: reduceMotion ? 0 : washParallax.x,
            y: reduceMotion ? 0 : washParallax.y,
            opacity: reduceMotion ? 0.55 : cyanOpacity,
            background:
              "radial-gradient(ellipse 95% 75% at 28% 38%, rgba(34,211,238,0.135) 0%, rgba(59,130,246,0.065) 48%, transparent 78%)",
          }}
        />
        <motion.div
          className="absolute inset-[-10%]"
          style={{
            x: reduceMotion ? 0 : washParallax.x,
            y: reduceMotion ? 0 : washParallax.y,
            opacity: reduceMotion ? 0.55 : violetOpacity,
            background:
              "radial-gradient(ellipse 95% 75% at 72% 44%, rgba(124,58,237,0.16) 0%, rgba(99,102,241,0.065) 48%, transparent 78%)",
          }}
        />

        {/* 반짝임: 떠다니며 밝아졌다 어두워지는 글로우 5개.
            역방향 패럴랙스로 마우스 반대편으로 살짝 밀린다 */}
        <motion.div
          className="absolute inset-[-10%]"
          style={{
            x: reduceMotion ? 0 : shimmerParallax.x,
            y: reduceMotion ? 0 : shimmerParallax.y,
          }}
        >
          <motion.div
            className="absolute left-[2%] top-[-4%] h-[36vmax] w-[52vmax] rounded-full blur-[50px]"
            style={{
              background:
                "radial-gradient(ellipse, rgba(34,211,238,0.09) 0%, rgba(59,130,246,0.045) 45%, transparent 70%)",
            }}
            animate={
              reduceMotion
                ? undefined
                : {
                    x: ["-3%", "4%", "-3%"],
                    y: ["-2%", "3%", "-2%"],
                    scale: [1, 1.16, 1],
                    opacity: [0.5, 0.95, 0.5],
                  }
            }
            transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-0 top-[24%] h-[34vmax] w-[46vmax] rounded-full blur-[50px]"
            style={{
              background:
                "radial-gradient(ellipse, rgba(124,58,237,0.10) 0%, rgba(99,102,241,0.045) 45%, transparent 70%)",
            }}
            animate={
              reduceMotion
                ? undefined
                : {
                    x: ["3%", "-3%", "3%"],
                    y: ["3%", "-2%", "3%"],
                    scale: [1.1, 0.94, 1.1],
                    opacity: [0.8, 0.4, 0.8],
                  }
            }
            transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute left-[34%] top-[36%] h-[22vmax] w-[30vmax] rounded-full blur-[40px]"
            style={{
              background:
                "radial-gradient(ellipse, rgba(196,215,255,0.08) 0%, transparent 65%)",
            }}
            animate={
              reduceMotion
                ? undefined
                : { scale: [1, 1.1, 1], opacity: [0.3, 0.7, 0.3] }
            }
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute left-[6%] top-[58%] h-[26vmax] w-[40vmax] rounded-full blur-[46px]"
            style={{
              background:
                "radial-gradient(ellipse, rgba(59,130,246,0.09) 0%, rgba(34,211,238,0.045) 48%, transparent 70%)",
            }}
            animate={
              reduceMotion
                ? undefined
                : {
                    x: ["-2%", "3%", "-2%"],
                    scale: [0.96, 1.12, 0.96],
                    opacity: [0.4, 0.85, 0.4],
                  }
            }
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute left-[56%] top-[62%] h-[18vmax] w-[26vmax] rounded-full blur-[36px]"
            style={{
              background:
                "radial-gradient(ellipse, rgba(167,139,250,0.09) 0%, transparent 65%)",
            }}
            animate={
              reduceMotion
                ? undefined
                : { scale: [1, 1.14, 1], opacity: [0.25, 0.65, 0.25] }
            }
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* 커서 팔로워: 작지만 그라데이션 단계가 뚜렷한 글로우 */}
        {!reduceMotion && (
          <motion.div
            className="absolute inset-0"
            style={{ background: followerGlow }}
          />
        )}
      </div>

      <div
        className="absolute inset-0 opacity-[0.022]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
}
