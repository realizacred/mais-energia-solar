import { useState, useEffect, useRef } from "react";

/**
 * Animated counter hook — smoothly counts from 0 to target value.
 */
export function useAnimatedCounter(target: number, duration = 1500, enabled = true) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const prevTarget = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    const from = prevTarget.current;
    prevTarget.current = target;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // easeOutExpo for dramatic feel
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(from + (target - from) * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    startTimeRef.current = undefined;
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration, enabled]);

  return value;
}
