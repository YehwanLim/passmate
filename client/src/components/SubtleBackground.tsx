import { useCallback, useEffect, useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

/**
 * SubtleBackground
 *
 * A quiet field that responds to the cursor without drawing a cursor object.
 */
export default function SubtleBackground() {
  const mouseX = useMotionValue(
    typeof window !== "undefined" ? window.innerWidth / 2 : 960
  );
  const mouseY = useMotionValue(
    typeof window !== "undefined" ? window.innerHeight / 2 : 540
  );
  const velocity = useMotionValue(0);
  const lastPos = useRef({ x: 0, y: 0, t: 0 });

  const fieldX = useSpring(mouseX, { damping: 55, stiffness: 80, mass: 1.4 });
  const fieldY = useSpring(mouseY, { damping: 55, stiffness: 80, mass: 1.4 });
  const sweepX = useSpring(mouseX, { damping: 42, stiffness: 95, mass: 1 });
  const sweepY = useSpring(mouseY, { damping: 42, stiffness: 95, mass: 1 });
  const smoothVelocity = useSpring(velocity, {
    damping: 60,
    stiffness: 90,
    mass: 0.7,
  });

  const fieldXPct = useTransform(fieldX, (value) =>
    typeof window === "undefined"
      ? "50%"
      : `${Math.round((value / window.innerWidth) * 100)}%`
  );
  const fieldYPct = useTransform(fieldY, (value) =>
    typeof window === "undefined"
      ? "32%"
      : `${Math.round((value / window.innerHeight) * 72)}%`
  );
  const sweepXPct = useTransform(sweepX, (value) =>
    typeof window === "undefined"
      ? "50%"
      : `${Math.round((value / window.innerWidth) * 100)}%`
  );
  const sweepYPct = useTransform(sweepY, (value) =>
    typeof window === "undefined"
      ? "48%"
      : `${Math.round((value / window.innerHeight) * 100)}%`
  );
  const fieldOpacity = useTransform(smoothVelocity, [0, 2500], [0.74, 0.94]);
  const bloomOpacity = useTransform(smoothVelocity, [0, 2500], [0.62, 0.84]);
  const particleOpacity = useTransform(smoothVelocity, [0, 2500], [0.12, 0.2]);
  const driftX = useTransform(fieldX, (value) =>
    typeof window === "undefined"
      ? "50%"
      : `${48 + ((value / window.innerWidth) - 0.5) * 10}%`
  );
  const bloomX = useTransform(fieldX, (value) =>
    typeof window === "undefined"
      ? "50%"
      : `${50 + ((value / window.innerWidth) - 0.5) * 14}%`
  );
  const bloomY = useTransform(fieldY, (value) =>
    typeof window === "undefined"
      ? "22%"
      : `${22 + ((value / window.innerHeight) - 0.5) * 10}%`
  );

  const responsiveField = useMotionTemplate`
    radial-gradient(ellipse 62% 40% at ${fieldXPct} ${fieldYPct}, rgba(145,183,255,0.18) 0%, rgba(34,211,238,0.085) 34%, transparent 70%),
    radial-gradient(ellipse 48% 32% at ${sweepXPct} ${sweepYPct}, rgba(124,58,237,0.14) 0%, rgba(99,102,241,0.055) 44%, transparent 74%),
    radial-gradient(ellipse 46% 40% at 12% 48%, rgba(34,211,238,0.075) 0%, rgba(59,130,246,0.034) 42%, transparent 76%),
    radial-gradient(ellipse 44% 38% at 88% 44%, rgba(124,58,237,0.09) 0%, rgba(96,165,250,0.03) 46%, transparent 78%),
    linear-gradient(180deg, rgba(255,255,255,0.018) 0%, transparent 38%)
  `;

  const bloomBand = useMotionTemplate`
    radial-gradient(ellipse 72% 34% at ${bloomX} ${bloomY}, rgba(34,211,238,0.16) 0%, rgba(96,165,250,0.105) 28%, rgba(124,58,237,0.14) 54%, transparent 78%)
  `;

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const now = performance.now();
      const prev = lastPos.current;
      const dt = Math.max(now - prev.t, 1);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      const speed = Math.sqrt(dx * dx + dy * dy) / (dt / 16);

      velocity.set(Math.min(speed * 18, 2600));
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

  useEffect(() => {
    const decay = window.setInterval(() => {
      const current = velocity.get();
      velocity.set(current > 4 ? current * 0.88 : 0);
    }, 50);

    return () => window.clearInterval(decay);
  }, [velocity]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <motion.div
        className="responsive-aurora-field absolute inset-0"
        style={{
          opacity: fieldOpacity,
          background: responsiveField,
        }}
      />

      <motion.div
        className="aurora-bloom-band absolute inset-x-[-12%] top-[-18%] h-[58vh] blur-2xl"
        style={{
          opacity: bloomOpacity,
          background: bloomBand,
          transform: "translateZ(0)",
        }}
        animate={{ scaleY: [0.92, 1.05, 0.92], opacity: [0.58, 0.78, 0.58] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="interactive-light-sweep absolute inset-0 opacity-[0.13]"
        style={{
          background:
            "linear-gradient(112deg, transparent 0%, transparent 36%, rgba(255,255,255,0.035) 47%, rgba(34,211,238,0.042) 52%, rgba(124,58,237,0.026) 57%, transparent 67%, transparent 100%)",
          backgroundSize: "240% 240%",
          backgroundPositionX: driftX,
          backgroundPositionY: "50%",
        }}
        animate={{ opacity: [0.13, 0.22, 0.13] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="quiet-gradient-mesh absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.78), rgba(0,0,0,0.18) 72%, transparent)",
        }}
      />

      <motion.div
        className="particle-field absolute inset-0"
        style={{
          opacity: particleOpacity,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.42) 1px, transparent 1px), radial-gradient(rgba(125,148,255,0.28) 1px, transparent 1px)",
          backgroundPosition: "0 0, 34px 28px",
          backgroundSize: "86px 86px, 132px 132px",
          maskImage:
            "radial-gradient(ellipse 70% 46% at 50% 34%, black 0%, rgba(0,0,0,0.42) 50%, transparent 78%)",
        }}
        animate={{ backgroundPosition: ["0 0, 34px 28px", "24px 18px, 12px 46px"] }}
        transition={{ duration: 22, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
      />

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
