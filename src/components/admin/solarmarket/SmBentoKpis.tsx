/**
 * SmBentoKpis — Glassmorphism Bento Grid for migration KPIs.
 */
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { type LucideIcon, CheckCircle, Clock, AlertTriangle, TrendingUp } from "lucide-react";

interface KpiItem {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: "primary" | "success" | "warning" | "destructive" | "info" | "muted";
  sub?: string;
  progress?: number;
  /** Makes this card span 2 columns on larger screens */
  wide?: boolean;
}

interface SmBentoKpisProps {
  items: KpiItem[];
  className?: string;
}

const colorTokens: Record<string, { border: string; bg: string; icon: string; glow: string }> = {
  primary:     { border: "border-primary/20", bg: "bg-primary/5", icon: "text-primary", glow: "shadow-primary/5" },
  success:     { border: "border-success/20", bg: "bg-success/5", icon: "text-success", glow: "shadow-success/5" },
  warning:     { border: "border-warning/20", bg: "bg-warning/5", icon: "text-warning", glow: "shadow-warning/5" },
  destructive: { border: "border-destructive/20", bg: "bg-destructive/5", icon: "text-destructive", glow: "shadow-destructive/5" },
  info:        { border: "border-info/20", bg: "bg-info/5", icon: "text-info", glow: "shadow-info/5" },
  muted:       { border: "border-border", bg: "bg-muted/30", icon: "text-muted-foreground", glow: "" },
};

export function SmBentoKpis({ items, className }: SmBentoKpisProps) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-3", className)}>
      {items.map((item, i) => {
        const t = colorTokens[item.color] || colorTokens.muted;
        const Icon = item.icon;
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
            className={cn(
              "relative rounded-xl border p-4 backdrop-blur-sm transition-shadow duration-200",
              "hover:shadow-lg",
              t.border, t.bg, t.glow,
              item.wide && "sm:col-span-2",
            )}
          >
            {/* Glass shine effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />

            <div className="relative flex items-start gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", t.bg)}>
                <Icon className={cn("w-4 h-4", t.icon)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                  {item.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{item.label}</p>
              </div>
            </div>

            {item.progress !== undefined && (
              <div className="relative mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", item.color === "success" ? "bg-success" : "bg-primary")}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.progress}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            )}

            {item.sub && (
              <p className="relative text-[10px] text-muted-foreground mt-2 leading-snug">{item.sub}</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
