import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ActiveBeacon } from "@/hooks/useFeatureDiscovery";

interface SmartBeaconProps {
  beacon: ActiveBeacon;
  onDismiss: (id: string) => void;
}

/**
 * Pulsing dot that attaches to a target element via portal.
 * On click, shows a small tooltip with the feature description,
 * then auto-dismisses.
 */
export function SmartBeacon({ beacon, onDismiss }: SmartBeaconProps) {
  const { hint, element } = beacon;
  const [showTooltip, setShowTooltip] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Track element position
  useEffect(() => {
    const update = () => {
      const rect = element.getBoundingClientRect();
      setPos({
        top: rect.top + window.scrollY - 4,
        left: rect.right + window.scrollX - 4,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [element]);

  // Auto-dismiss tooltip after 6s
  useEffect(() => {
    if (!showTooltip) return;
    const t = setTimeout(() => {
      onDismiss(hint.id);
    }, 6000);
    return () => clearTimeout(t);
  }, [showTooltip, hint.id, onDismiss]);

  // Close on click outside
  useEffect(() => {
    if (!showTooltip) return;
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onDismiss(hint.id);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTooltip, hint.id, onDismiss]);

  return createPortal(
    <>
      {/* Pulsing dot */}
      <button
        onClick={() => setShowTooltip(true)}
        className="fixed z-[9999] group"
        style={{ top: pos.top, left: pos.left }}
        aria-label={`Novidade: ${hint.title}`}
      >
        <span className="relative flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-primary border-2 border-background shadow-sm" />
        </span>
      </button>

      {/* Tooltip card */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="fixed z-[10000] w-64 rounded-xl bg-card border border-border/50 shadow-xl p-3.5 animate-in fade-in-0 zoom-in-95 duration-200"
          style={{
            top: pos.top + 20,
            left: Math.min(pos.left - 100, window.innerWidth - 280),
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{hint.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{hint.description}</p>
            </div>
            <button
              onClick={() => onDismiss(hint.id)}
              className="text-muted-foreground hover:text-foreground text-xs shrink-0 mt-0.5"
            >
              ✕
            </button>
          </div>
          <button
            onClick={() => onDismiss(hint.id)}
            className="mt-2.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Entendi ✓
          </button>
        </div>
      )}
    </>,
    document.body
  );
}
