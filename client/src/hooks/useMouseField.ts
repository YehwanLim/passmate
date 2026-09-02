import { useCallback, useEffect, useRef } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";

/**
 * useMouseField
 *
 * rAF 스로틀 mousemove 리스너를 공유 훅으로 만든 것.
 * 배경 컴포넌트가 마우스 좌표를 MotionValue로 얻는다.
 */
export function useMouseField(): {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
} {
  const mouseX = useMotionValue(
    typeof window !== "undefined" ? window.innerWidth / 2 : 960
  );
  const mouseY = useMotionValue(
    typeof window !== "undefined" ? window.innerHeight / 2 : 540
  );
  const pendingMouseRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);

  const flushMousePosition = useCallback(() => {
    animationFrameRef.current = null;
    const next = pendingMouseRef.current;
    mouseX.set(next.x);
    mouseY.set(next.y);
  }, [mouseX, mouseY]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      pendingMouseRef.current = { x: e.clientX, y: e.clientY };
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(flushMousePosition);
      }
    },
    [flushMousePosition]
  );

  useEffect(() => {
    pendingMouseRef.current = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleMouseMove]);

  return { mouseX, mouseY };
}
