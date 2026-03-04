/**
 * Plays a short notification sound + vibrates on incoming WhatsApp message.
 * Uses Web Audio API (no external files). Throttled to avoid spam.
 * Separated from UI for SRP compliance.
 */

let audioCtx: AudioContext | null = null;
let lastAlertAt = 0;
const THROTTLE_MS = 1500;

export function playIncomingMessageAlert() {
  const now = Date.now();
  if (now - lastAlertAt < THROTTLE_MS) return;
  lastAlertAt = now;

  // Vibrate on mobile
  if ("vibrate" in navigator) {
    navigator.vibrate([150, 80, 150]);
  }

  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    if (ctx.state === "suspended") ctx.resume();

    const t = ctx.currentTime;

    // Quick two-tone "ding" (shorter than notification chime)
    const g1 = ctx.createGain();
    g1.connect(ctx.destination);
    g1.gain.setValueAtTime(0.4, t);
    g1.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.setValueAtTime(660, t); // E5
    o1.connect(g1);
    o1.start(t);
    o1.stop(t + 0.15);

    const g2 = ctx.createGain();
    g2.connect(ctx.destination);
    g2.gain.setValueAtTime(0.35, t + 0.12);
    g2.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.setValueAtTime(880, t + 0.12); // A5
    o2.connect(g2);
    o2.start(t + 0.12);
    o2.stop(t + 0.3);
  } catch {
    // Audio not available (no user gesture yet, etc.)
  }
}
