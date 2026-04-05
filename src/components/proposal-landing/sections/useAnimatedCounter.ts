/**
 * useAnimatedCounter — Animated number counter for landing page metrics.
 * Animates from 0 to target value when element becomes visible.
 */

import { useState, useEffect, useRef } from "react";

interface UseAnimatedCounterOptions {
  end: number;
  duration?: number;
  decimals?: number;
  enabled?: boolean;
}

export function useAnimatedCounter({
  end,
  duration = 1500,
  decimals = 0,
  enabled = true,
}: UseAnimatedCounterOptions) {
  const [value, setValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || hasAnimated || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          animateValue(0, end, duration, decimals, setValue);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration, decimals, enabled, hasAnimated]);

  return { value, ref };
}

function animateValue(
  start: number,
  end: number,
  duration: number,
  decimals: number,
  setter: (v: number) => void
) {
  const startTime = performance.now();
  const diff = end - start;

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + diff * eased;
    setter(Number(current.toFixed(decimals)));

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}
