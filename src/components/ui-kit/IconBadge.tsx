import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ColorToken = "primary" | "secondary" | "success" | "warning" | "destructive" | "info";

const colorMap: Record<ColorToken, { bg: string; text: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary" },
  secondary: { bg: "bg-secondary/10", text: "text-secondary" },
  success: { bg: "bg-success/10", text: "text-success" },
  warning: { bg: "bg-warning/10", text: "text-warning" },
  destructive: { bg: "bg-destructive/10", text: "text-destructive" },
  info: { bg: "bg-info/10", text: "text-info" },
};

type IconBadgeSize = "sm" | "md" | "lg";
const sizeMap: Record<IconBadgeSize, { container: string; icon: string }> = {
  sm: { container: "h-7 w-7", icon: "h-3.5 w-3.5" },
  md: { container: "h-9 w-9", icon: "h-4 w-4" },
  lg: { container: "h-11 w-11", icon: "h-5 w-5" },
};

interface IconBadgeProps {
  icon: LucideIcon;
  color?: ColorToken;
  size?: IconBadgeSize;
  className?: string;
}

export function IconBadge({ icon: Icon, color = "primary", size = "md", className }: IconBadgeProps) {
  const c = colorMap[color];
  const s = sizeMap[size];
  return (
    <div className={cn("rounded-xl flex items-center justify-center shrink-0", c.bg, s.container, className)}>
      <Icon className={cn(c.text, s.icon)} />
    </div>
  );
}
