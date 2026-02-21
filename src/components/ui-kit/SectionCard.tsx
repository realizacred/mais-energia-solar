import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Semantic color variants for admin section cards.
 * 
 * - blue: Structure, informational sections
 * - orange: Primary actions, highlights
 * - green: Success, confirmed states
 * - red: Error, warning, destructive
 * - purple: AI / intelligent features
 * - warning: Caution, attention needed
 * - neutral: Default card style (no tint)
 */
export type SectionCardVariant = "blue" | "orange" | "green" | "red" | "purple" | "warning" | "neutral";

const VARIANT_STYLES: Record<SectionCardVariant, { border: string; bg: string; iconColor: string }> = {
  blue:    { border: "border-info/20",        bg: "",                       iconColor: "text-info" },
  orange:  { border: "border-primary/20",     bg: "",                       iconColor: "text-primary" },
  green:   { border: "border-success/20",     bg: "",                       iconColor: "text-success" },
  red:     { border: "border-destructive/20", bg: "",                       iconColor: "text-destructive" },
  purple:  { border: "border-accent/20",      bg: "",                       iconColor: "text-accent" },
  warning: { border: "border-warning/20",     bg: "",                       iconColor: "text-warning" },
  neutral: { border: "border-border",         bg: "",                       iconColor: "text-secondary" },
};

interface SectionCardProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
  /** Semantic color variant */
  variant?: SectionCardVariant;
}

export function SectionCard({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  noPadding,
  variant = "neutral",
}: SectionCardProps) {
  const v = VARIANT_STYLES[variant];

  return (
    <Card className={cn("transition-all duration-200", v.border, v.bg, className)}>
      {title && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold flex items-center gap-2.5 text-foreground tracking-wide">
              {Icon && <Icon className={cn("h-4 w-4", v.iconColor)} />}
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="text-xs">{description}</CardDescription>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(noPadding && "p-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
