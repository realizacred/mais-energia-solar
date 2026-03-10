import React from "react";
import { cn } from "@/lib/utils";

type AccentColor = "primary" | "secondary" | "success" | "warning" | "destructive" | "info" | "muted";

const ACCENT_MAP: Record<AccentColor, { iconBg: string; iconText: string; borderHighlight: string }> = {
  primary:     { iconBg: "bg-primary/15",     iconText: "text-primary",         borderHighlight: "border-primary/30" },
  secondary:   { iconBg: "bg-secondary/15",   iconText: "text-secondary",       borderHighlight: "border-secondary/30" },
  success:     { iconBg: "bg-success/15",     iconText: "text-success",         borderHighlight: "border-success/30" },
  warning:     { iconBg: "bg-warning/15",     iconText: "text-warning",         borderHighlight: "border-warning/30" },
  destructive: { iconBg: "bg-destructive/15", iconText: "text-destructive",     borderHighlight: "border-destructive/40" },
  info:        { iconBg: "bg-info/15",        iconText: "text-info",            borderHighlight: "border-info/30" },
  muted:       { iconBg: "bg-muted",          iconText: "text-muted-foreground", borderHighlight: "border-border" },
};

export interface EnterpriseKpiProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  accentColor?: AccentColor;
  highlight?: boolean;
  onClick?: () => void;
}

export function EnterpriseKpi({ icon: Icon, label, value, subtitle, accentColor = "muted", highlight = false, onClick }: EnterpriseKpiProps) {
  const a = ACCENT_MAP[accentColor];
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border bg-card p-6 transition-all duration-200 shadow-sm",
        highlight ? a.borderHighlight : "border-border",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium min-h-[28px] leading-[14px] flex items-end">{label}</p>
          <p className="text-2xl font-bold text-foreground leading-none mt-1">{value}</p>
          {subtitle ? (
            <p className="text-[11px] text-muted-foreground mt-1.5">{subtitle}</p>
          ) : (
            <div className="h-[17px]" />
          )}
        </div>
        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", a.iconBg)}>
          <Icon className={cn("h-[18px] w-[18px]", a.iconText)} />
        </div>
      </div>
    </div>
  );
}
