import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "destructive" | "info" | "primary" | "secondary" | "muted";

const variantMap: Record<StatusVariant, string> = {
  success: "bg-success/15 text-success border-success/20 hover:bg-success/20",
  warning: "bg-warning/15 text-warning border-warning/20 hover:bg-warning/20",
  destructive: "bg-destructive/15 text-destructive border-destructive/20 hover:bg-destructive/20",
  info: "bg-info/15 text-info border-info/20 hover:bg-info/20",
  primary: "bg-primary/15 text-primary border-primary/20 hover:bg-primary/20",
  secondary: "bg-secondary/15 text-secondary border-secondary/20 hover:bg-secondary/20",
  muted: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
};

interface StatusBadgeProps {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function StatusBadge({ variant, children, className, dot }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium text-xs gap-1.5",
        variantMap[variant],
        className
      )}
    >
      {dot && (
        <span className={cn(
          "h-1.5 w-1.5 rounded-full",
          variant === "success" && "bg-success",
          variant === "warning" && "bg-warning",
          variant === "destructive" && "bg-destructive",
          variant === "info" && "bg-info",
          variant === "primary" && "bg-primary",
          variant === "secondary" && "bg-secondary",
          variant === "muted" && "bg-muted-foreground",
        )} />
      )}
      {children}
    </Badge>
  );
}
