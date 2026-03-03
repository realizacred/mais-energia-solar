/**
 * StringAlertBell — Bell icon with badge showing critical string count.
 * Also fires an automatic toast when critical strings are detected on mount.
 */
import React, { useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DeviceStringCard } from "@/services/monitoring/mpptStringTypes";

interface StringAlertBellProps {
  cards: DeviceStringCard[];
  className?: string;
}

export function StringAlertBell({ cards, className }: StringAlertBellProps) {
  const toastFired = useRef(false);

  const criticalStrings = cards.flatMap((c) =>
    c.strings.filter((s) => s.alert_status === "critical")
  );
  const criticalCount = criticalStrings.length;

  // Auto-toast on first detection
  useEffect(() => {
    if (criticalCount > 0 && !toastFired.current) {
      toastFired.current = true;

      const deviceMap = new Map<string, string[]>();
      for (const card of cards) {
        const stopped = card.strings.filter((s) => s.alert_status === "critical");
        if (stopped.length > 0) {
          const label = card.device_model || card.device_serial || "Inversor";
          deviceMap.set(label, stopped.map((s) =>
            s.string_number ? `S${s.string_number}` : "String"
          ));
        }
      }

      const lines = Array.from(deviceMap.entries())
        .map(([dev, strings]) => `${dev}: ${strings.join(", ")}`)
        .join(" | ");

      toast.error(
        `⚠️ ${criticalCount} string${criticalCount > 1 ? "s" : ""} parada${criticalCount > 1 ? "s" : ""} detectada${criticalCount > 1 ? "s" : ""}`,
        {
          description: lines,
          duration: 8000,
        }
      );
    }
  }, [criticalCount, cards]);

  if (criticalCount === 0) return null;

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <Bell className="h-4.5 w-4.5 text-destructive animate-pulse" />
      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
        {criticalCount}
      </span>
    </div>
  );
}
