import { useEffect, useCallback, useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  animate,
} from "framer-motion";

/**
 * SubtleBackground — Premium Light Orb v3
 *
 * 확실하게 눈에 띄는 빛 + 마우스 근처 유기적 애니메이션
 */
export default function SubtleBackground() {
  const mouseX = useMotionValue(
    typeof window !== "undefined" ? window.innerWidth / 2 : 960
  );
  const mouseY = useMotionValue(
    typeof window !== "undefined" ? window.innerHeight / 2 : 540
  );

  // Velocity tracking
  const velocity = useMotionValue(0);
  const lastPos = useRef({ x: 0, y: 0, t: 0 });

  // Primary orb — 거의 즉시 따라옴
  const springConfig = { damping: 25, stiffness: 500, mass: 0.3 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  // Secondary orb — 약간의 지연
  const lagX = useSpring(mouseX, { damping: 30, stiffness: 300, mass: 0.5 });
  const lagY = useSpring(mouseY, { damping: 30, stiffness: 300, mass: 0.5 });

  // Tertiary — 부드러운 잔상
  const trailX = useSpring(mouseX, { damping: 40, stiffness: 150, mass: 0.8 });
  const trailY = useSpring(mouseY, { damping: 40, stiffness: 150, mass: 0.8 });

  const smoothVelocity = useSpring(velocity, {
    damping: 50,
    stiffness: 120,
    mass: 0.5,
  });

  // Dynamic intensity
  const dynamicScale = useTransform(smoothVelocity, [0, 2000], [1.0, 1.25]);
  const dynamicOpacity = useTransform(smoothVelocity, [0, 2000], [0.55, 0.85]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const now = performance.now();
      const prev = lastPos.current;
      const dt = now - prev.t;

      if (dt > 0) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        const speed = Math.sqrt(dx * dx + dy * dy) / (dt / 16);
        velocity.set(Math.min(speed * 40, 3000));
      }

      lastPos.current = { x: e.clientX, y: e.clientY, t: now };
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    },
    [mouseX, mouseY, velocity]
  );

  useEffect(() => {
    lastPos.current = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      t: performance.now(),
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  // Velocity decay
  useEffect(() => {
    const decay = setInterval(() => {
      const current = velocity.get();
      if (current > 5) velocity.set(current * 0.9);
      else if (current > 0) velocity.set(0);
    }, 40);
    return () => clearInterval(decay);
  }, [velocity]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      aria-hidden="true"
    >
      {/* ═══════════════════════════════════════════════
          1. PRIMARY LIGHT ORB — 가장 밝고 선명한 핵심 빛
          ═══════════════════════════════════════════════ */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 320,
          height: 320,
          x: springX,
          y: springY,
          translateX: "-50%",
          translateY: "-50%",
          scale: dynamicScale,
          opacity: dynamicOpacity,
          background: [
            "radial-gradient(",
            "circle,",
            "rgba(255,255,255,0.50) 0%,",
            "rgba(200,195,255,0.45) 8%,",
            "rgba(165,160,255,0.35) 18%,",
            "rgba(120,119,198,0.25) 32%,",
            "rgba(96,165,250,0.14) 50%,",
            "rgba(59,130,246,0.05) 70%,",
            "transparent 90%",
            ")",
          ].join(" "),
          mixBlendMode: "screen",
          willChange: "transform, opacity",
        }}
      />

      {/* ═══════════════════════════════════════════════
          2. SECONDARY GLOW — 느리게 따라오는 큰 후광
          ═══════════════════════════════════════════════ */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 550,
          height: 550,
          x: lagX,
          y: lagY,
          translateX: "-50%",
          translateY: "-50%",
          background:
            "radial-gradient(circle, rgba(120,119,198,0.20) 0%, rgba(96,165,250,0.10) 30%, rgba(59,130,246,0.04) 55%, transparent 75%)",
          filter: "blur(15px)",
          mixBlendMode: "screen",
          willChange: "transform",
        }}
      />

      {/* ═══════════════════════════════════════════════
          3. TERTIARY TRAIL — 가장 느린 잔상 (빛의 꼬리)
          ═══════════════════════════════════════════════ */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 800,
          height: 800,
          x: trailX,
          y: trailY,
          translateX: "-50%",
          translateY: "-50%",
          background:
            "radial-gradient(circle, rgba(99,102,241,0.10) 0%, rgba(96,165,250,0.05) 40%, transparent 70%)",
          filter: "blur(60px)",
          mixBlendMode: "screen",
          willChange: "transform",
        }}
      />

      {/* ═══════════════════════════════════════════════
          4. AMBIENT BREATHING ORBS — 마우스 근처 유기적 애니메이션
          ═══════════════════════════════════════════════ */}

      {/* Breathing orb A — 시계방향 공전 */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 250,
          height: 250,
          x: springX,
          y: springY,
          translateX: "-50%",
          translateY: "-50%",
          background:
            "radial-gradient(circle, rgba(165,160,255,0.20) 0%, rgba(120,119,198,0.08) 50%, transparent 75%)",
          filter: "blur(25px)",
          mixBlendMode: "screen",
        }}
        animate={{
          offsetDistance: "100%",
          x: [80, -60, -80, 60, 80],
          y: [-60, -80, 60, 80, -60],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Breathing orb B — 반시계방향 공전 */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 200,
          height: 200,
          x: springX,
          y: springY,
          translateX: "-50%",
          translateY: "-50%",
          background:
            "radial-gradient(circle, rgba(96,165,250,0.18) 0%, rgba(59,130,246,0.06) 50%, transparent 75%)",
          filter: "blur(20px)",
          mixBlendMode: "screen",
        }}
        animate={{
          x: [-70, 80, 70, -80, -70],
          y: [50, 70, -50, -70, 50],
          scale: [0.8, 1.1, 0.9, 1.05, 0.8],
          opacity: [0.6, 1, 0.7, 0.9, 0.6],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Breathing orb C — 작은 액센트 */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 150,
          height: 150,
          x: springX,
          y: springY,
          translateX: "-50%",
          translateY: "-50%",
          background:
            "radial-gradient(circle, rgba(192,180,255,0.22) 0%, transparent 70%)",
          filter: "blur(15px)",
          mixBlendMode: "screen",
        }}
        animate={{
          x: [40, -50, 30, -40, 40],
          y: [30, 50, -40, -30, 30],
          scale: [1, 0.7, 1.15, 0.85, 1],
          opacity: [0.8, 0.5, 1, 0.6, 0.8],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* ═══════════════════════════════════════════════
          5. AMBIENT AURORA — 고정 레이어
          ═══════════════════════════════════════════════ */}

      {/* 우상단 Aurora */}
      <div
        className="absolute"
        style={{
          top: "-12%",
          right: "-10%",
          width: 900,
          height: 900,
          background:
            "radial-gradient(circle, rgba(99,102,241,0.14) 0%, rgba(120,119,198,0.05) 40%, transparent 65%)",
        }}
      />

      {/* 좌하단 Aurora */}
      <div
        className="absolute"
        style={{
          bottom: "0%",
          left: "-12%",
          width: 700,
          height: 700,
          background:
            "radial-gradient(circle, rgba(59,130,246,0.08) 0%, rgba(96,165,250,0.03) 45%, transparent 65%)",
        }}
      />

      {/* ═══════════════════════════════════════════════
          6. FILM GRAIN
          ═══════════════════════════════════════════════ */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
}
