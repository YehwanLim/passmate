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
  const pendingMouseRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const velocityFrameRef = useRef<number | null>(null);

  const fieldX = useSpring(mouseX, { damping: 34, stiffness: 190, mass: 0.72 });
  const fieldY = useSpring(mouseY, { damping: 34, stiffness: 190, mass: 0.72 });
  const sweepX = useSpring(mouseX, { damping: 28, stiffness: 220, mass: 0.62 });
  const sweepY = useSpring(mouseY, { damping: 28, stiffness: 220, mass: 0.62 });
  const smoothVelocity = useSpring(velocity, {
    damping: 42,
    stiffness: 130,
    mass: 0.58,
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
  const fieldOpacity = useTransform(smoothVelocity, [0, 2500], [0.78, 0.94]);
  const bloomOpacity = useTransform(smoothVelocity, [0, 2500], [0.5, 0.72]);
  const particleOpacity = useTransform(smoothVelocity, [0, 2500], [0.11, 0.18]);
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
    radial-gradient(circle 26vmax at ${fieldXPct} ${fieldYPct}, rgba(145,183,255,0.22) 0%, rgba(34,211,238,0.12) 34%, transparent 66%),
    radial-gradient(circle 18vmax at ${sweepXPct} ${sweepYPct}, rgba(124,58,237,0.16) 0%, rgba(99,102,241,0.07) 44%, transparent 70%),
    radial-gradient(ellipse 50% 42% at 12% 48%, rgba(34,211,238,0.09) 0%, rgba(59,130,246,0.044) 42%, transparent 76%),
    radial-gradient(ellipse 48% 40% at 88% 44%, rgba(124,58,237,0.11) 0%, rgba(96,165,250,0.04) 46%, transparent 78%),
    linear-gradient(180deg, rgba(255,255,255,0.018) 0%, transparent 38%)
  `;

  const bloomBand = useMotionTemplate`
    radial-gradient(ellipse 54% 30% at ${bloomX} ${bloomY}, rgba(34,211,238,0.14) 0%, rgba(96,165,250,0.105) 30%, rgba(124,58,237,0.115) 56%, transparent 76%)
  `;

  const flushMousePosition = useCallback(() => {
    animationFrameRef.current = null;
    const next = pendingMouseRef.current;
    const now = performance.now();
    const prev = lastPos.current;
    const dt = Math.max(now - prev.t, 1);
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const speed = Math.sqrt(dx * dx + dy * dy) / (dt / 16);

    velocity.set(Math.min(speed * 20, 2800));
    lastPos.current = { x: next.x, y: next.y, t: now };
    mouseX.set(next.x);
    mouseY.set(next.y);
  }, [mouseX, mouseY, velocity]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      pendingMouseRef.current = { x: e.clientX, y: e.clientY };
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(flushMousePosition);
      }
    },
    [flushMousePosition]
  );

  const decayVelocity = useCallback(() => {
    const current = velocity.get();
    velocity.set(current > 3 ? current * 0.92 : 0);
    velocityFrameRef.current = requestAnimationFrame(decayVelocity);
  }, [velocity]);

  useEffect(() => {
    velocityFrameRef.current = requestAnimationFrame(decayVelocity);
    return () => {
      if (velocityFrameRef.current !== null) {
        cancelAnimationFrame(velocityFrameRef.current);
      }
    };
  }, [decayVelocity]);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    lastPos.current = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      t: performance.now(),
    };
    pendingMouseRef.current = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="ambient-page-gradient absolute inset-0 opacity-[0.34]"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 8%, rgba(59,130,246,0.085) 0%, transparent 58%), radial-gradient(ellipse 70% 42% at 74% 32%, rgba(124,58,237,0.055) 0%, transparent 62%), radial-gradient(ellipse 58% 38% at 22% 48%, rgba(34,211,238,0.045) 0%, transparent 66%)",
        }}
      />

      <motion.div
        className="responsive-aurora-field absolute inset-0"
        style={{
          opacity: fieldOpacity,
          background: responsiveField,
        }}
      />

      <motion.div
        className="aurora-bloom-band absolute inset-x-[-12%] top-[-18%] h-[58vh] blur-xl"
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
