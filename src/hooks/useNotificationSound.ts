import { useCallback, useRef } from "react";

/**
 * Generates a short notification chime using the Web Audio API.
 * No external audio file needed.
 */
export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastPlayedRef = useRef(0);

  const play = useCallback(() => {
    // Throttle: don't play more than once every 2 seconds
    const now = Date.now();
    if (now - lastPlayedRef.current < 2000) return;
    lastPlayedRef.current = now;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      // Resume context if suspended (browser autoplay policy)
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Create a pleasant two-tone chime
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);
      gainNode.gain.setValueAtTime(0.5, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      // First tone
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.connect(gainNode);
      osc1.start(now);
      osc1.stop(now + 0.2);

      // Second tone (higher, slightly delayed)
      const gainNode2 = ctx.createGain();
      gainNode2.connect(ctx.destination);
      gainNode2.gain.setValueAtTime(0.4, now + 0.15);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1320, now + 0.15); // E6
      osc2.connect(gainNode2);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.4);
    } catch (err) {
      // Silently ignore audio errors (e.g., user hasn't interacted yet)
      console.warn("[notification-sound] Could not play:", err);
    }
  }, []);

  return { play };
}
