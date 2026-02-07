import { useState, useCallback } from "react";

/**
 * Honeypot anti-bot protection
 * 
 * This hook provides invisible fields that bots typically fill in
 * but real users never see or interact with.
 */
export function useHoneypot() {
  const [honeypotValue, setHoneypotValue] = useState("");
  const [formLoadTime] = useState(Date.now());

  // NOTE: We intentionally do NOT block submissions solely based on "filled too fast".
  // With auto-save drafts and fast users, this causes false positives (submit appears to work,
  // but nothing is sent). We keep the timing signal only for logging/monitoring.
  const MIN_FILL_TIME_MS = 3000;

  const validateHoneypot = useCallback((): { isBot: boolean; reason?: string } => {
    // Check honeypot field - should be empty
    if (honeypotValue.trim() !== "") {
      console.warn("[Honeypot] Bot detected: honeypot field was filled");
      return { isBot: true, reason: "honeypot_filled" };
    }

    // Check fill time - should be at least 3 seconds
    const fillTime = Date.now() - formLoadTime;
    if (fillTime < MIN_FILL_TIME_MS) {
      console.warn("[Honeypot] Form filled too quickly (not blocking)", {
        fillTime,
        minRequired: MIN_FILL_TIME_MS,
      });
      return { isBot: false, reason: "too_fast" };
    }

    return { isBot: false };
  }, [honeypotValue, formLoadTime]);

  const handleHoneypotChange = useCallback((value: string) => {
    setHoneypotValue(value);
  }, []);

  const resetHoneypot = useCallback(() => {
    setHoneypotValue("");
  }, []);

  return {
    honeypotValue,
    handleHoneypotChange,
    validateHoneypot,
    resetHoneypot,
  };
}
