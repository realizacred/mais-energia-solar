import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline: "text-foreground border-border hover:bg-accent",
        success:
          "border-transparent bg-success text-success-foreground shadow-xs hover:bg-success/90",
        warning:
          "border-transparent bg-warning text-warning-foreground shadow-xs hover:bg-warning/90",
        info:
          "border-transparent bg-info text-info-foreground shadow-xs hover:bg-info/90",
        soft: "border-transparent bg-primary/10 text-primary hover:bg-primary/20",
        "soft-secondary":
          "border-transparent bg-secondary/10 text-secondary hover:bg-secondary/20",
        "soft-success":
          "border-transparent bg-success/10 text-success hover:bg-success/20",
        "soft-warning":
          "border-transparent bg-warning/10 text-warning hover:bg-warning/20",
        "soft-destructive":
          "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20",
        muted:
          "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-2xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };