import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface WizardStepCardProps {
  /** Step title */
  title: string;
  /** Short helper text shown below the title */
  description?: string;
  /** Optional icon displayed next to the title */
  icon?: LucideIcon;
  /** Step content */
  children: ReactNode;
  /** Optional content rendered on the right side of the header */
  headerRight?: ReactNode;
  /** Additional classes on the root card */
  className?: string;
}

/**
 * Premium card wrapper for each wizard step.
 * Provides consistent structure: title + description header, then content.
 */
export function WizardStepCard({
  title,
  description,
  icon: Icon,
  children,
  headerRight,
  className,
}: WizardStepCardProps) {
  return (
    <Card className={cn("border-border/40 w-full shadow-sm", className)}>
      <CardHeader className="pb-2 pt-3 px-3 sm:px-4 lg:px-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && (
              <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10 shrink-0">
                <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground leading-tight truncate">
                {title}
              </h2>
              {description && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          {headerRight && (
            <div className="shrink-0">{headerRight}</div>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 lg:px-5 pb-3 sm:pb-4">
        {children}
      </CardContent>
    </Card>
  );
}
