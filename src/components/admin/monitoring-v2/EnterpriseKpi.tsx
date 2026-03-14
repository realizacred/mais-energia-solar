import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AccentColor = "primary" | "secondary" | "success" | "warning" | "destructive" | "info" | "muted";

const ACCENT_MAP: Record<AccentColor, { iconBg: string; iconText: string; borderL: string }> = {
  primary:     { iconBg: "bg-primary/10",     iconText: "text-primary",         borderL: "border-l-primary" },
  secondary:   { iconBg: "bg-secondary/10",   iconText: "text-secondary",       borderL: "border-l-secondary" },
  success:     { iconBg: "bg-success/10",     iconText: "text-success",         borderL: "border-l-success" },
  warning:     { iconBg: "bg-warning/10",     iconText: "text-warning",         borderL: "border-l-warning" },
  destructive: { iconBg: "bg-destructive/10", iconText: "text-destructive",     borderL: "border-l-destructive" },
  info:        { iconBg: "bg-info/10",        iconText: "text-info",            borderL: "border-l-info" },
  muted:       { iconBg: "bg-muted",          iconText: "text-muted-foreground", borderL: "border-l-border" },
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

export function EnterpriseKpi({ icon: Icon, label, value, subtitle, accentColor = "primary", highlight = false, onClick }: EnterpriseKpiProps) {
  const a = ACCENT_MAP[accentColor];
  return (
    <Card
      onClick={onClick}
      className={cn(
        "border-l-[3px] bg-card shadow-sm hover:shadow-md transition-shadow",
        a.borderL,
        onClick && "cursor-pointer",
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", a.iconBg)}>
            <Icon className={cn("w-4 h-4", a.iconText)} />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
