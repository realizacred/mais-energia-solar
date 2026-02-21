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
  /** Additional classes on the root card */
  className?: string;
}

/**
 * Premium card wrapper for each wizard step.
 * Provides consistent structure: title + description header, then content.
 * Uses card-premium CSS class for subtle 3D depth on hover.
 */
export function WizardStepCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: WizardStepCardProps) {
  return (
    <Card className={cn("card-premium border-border/60", className)}>
      <CardHeader className="pb-3 pt-5 px-5 lg:px-6">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 shrink-0">
              <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground leading-tight truncate">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 lg:px-6 pb-5">
        {children}
      </CardContent>
    </Card>
  );
}
