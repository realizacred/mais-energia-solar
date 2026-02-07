import { useCallback, useRef, useState } from "react";

interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
  cooldownMs: number;
}

interface RateLimitState {
  isBlocked: boolean;
  remainingAttempts: number;
  cooldownEndTime: number | null;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  maxAttempts: 3,
  windowMs: 60 * 1000, // 1 minute
  cooldownMs: 5 * 60 * 1000, // 5 minutes cooldown
};

export function useFormRateLimit(options: Partial<RateLimitOptions> = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const attemptsRef = useRef<number[]>([]);
  const [state, setState] = useState<RateLimitState>({
    isBlocked: false,
    remainingAttempts: config.maxAttempts,
    cooldownEndTime: null,
  });

  const cleanOldAttempts = useCallback(() => {
    const now = Date.now();
    attemptsRef.current = attemptsRef.current.filter(
      (timestamp) => now - timestamp < config.windowMs
    );
  }, [config.windowMs]);

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();

    // Check if still in cooldown
    if (state.cooldownEndTime && now < state.cooldownEndTime) {
      return false;
    }

    // Reset if cooldown has passed
    if (state.cooldownEndTime && now >= state.cooldownEndTime) {
      attemptsRef.current = [];
      setState({
        isBlocked: false,
        remainingAttempts: config.maxAttempts,
        cooldownEndTime: null,
      });
    }

    cleanOldAttempts();

    if (attemptsRef.current.length >= config.maxAttempts) {
      const cooldownEnd = now + config.cooldownMs;
      setState({
        isBlocked: true,
        remainingAttempts: 0,
        cooldownEndTime: cooldownEnd,
      });
      console.warn("[RateLimit] Too many attempts. Blocking for cooldown.");
      return false;
    }

    return true;
  }, [state.cooldownEndTime, config.maxAttempts, config.cooldownMs, cleanOldAttempts]);

  const recordAttempt = useCallback(() => {
    const now = Date.now();
    attemptsRef.current.push(now);
    cleanOldAttempts();

    const remaining = config.maxAttempts - attemptsRef.current.length;
    setState((prev) => ({
      ...prev,
      remainingAttempts: Math.max(0, remaining),
    }));

    console.log(`[RateLimit] Attempt recorded. ${remaining} attempts remaining.`);
  }, [config.maxAttempts, cleanOldAttempts]);

  const getRemainingCooldownSeconds = useCallback((): number => {
    if (!state.cooldownEndTime) return 0;
    const remaining = state.cooldownEndTime - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000));
  }, [state.cooldownEndTime]);

  const reset = useCallback(() => {
    attemptsRef.current = [];
    setState({
      isBlocked: false,
      remainingAttempts: config.maxAttempts,
      cooldownEndTime: null,
    });
  }, [config.maxAttempts]);

  return {
    checkRateLimit,
    recordAttempt,
    isBlocked: state.isBlocked,
    remainingAttempts: state.remainingAttempts,
    getRemainingCooldownSeconds,
    reset,
  };
}
