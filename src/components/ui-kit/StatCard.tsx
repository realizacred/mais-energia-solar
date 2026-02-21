import { Card, CardContent } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ColorToken = "primary" | "secondary" | "success" | "warning" | "destructive" | "info" | "muted";

const colorMap: Record<ColorToken, { bg: string; text: string; border: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary", border: "border-l-primary" },
  secondary: { bg: "bg-secondary/10", text: "text-secondary", border: "border-l-secondary" },
  success: { bg: "bg-success/10", text: "text-success", border: "border-l-success" },
  warning: { bg: "bg-warning/10", text: "text-warning", border: "border-l-warning" },
  destructive: { bg: "bg-destructive/10", text: "text-destructive", border: "border-l-destructive" },
  info: { bg: "bg-info/10", text: "text-info", border: "border-l-info" },
  muted: { bg: "bg-muted", text: "text-muted-foreground", border: "border-l-muted-foreground" },
};

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: ColorToken;
  subtitle?: string;
  className?: string;
}

export function StatCard({ icon: Icon, label, value, color = "primary", subtitle, className }: StatCardProps) {
  const c = colorMap[color];
  return (
    <Card className={cn("border-l-[3px] border-border/60 card-stat-elevated", c.border, className)}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105", c.bg)}>
          <Icon className={cn("h-5 w-5", c.text)} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground truncate">{value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {subtitle && <p className="text-xs text-muted-foreground/70 truncate">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
