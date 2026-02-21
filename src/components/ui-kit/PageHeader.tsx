import { type LucideIcon, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  /** Tooltip de ajuda contextual */
  helpText?: string;
}

export function PageHeader({ icon: Icon, title, description, actions, className, helpText }: PageHeaderProps) {
  return (
    <div data-tour="page-header" className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2", className)}>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2.5 text-foreground">
          {Icon && (
            <div className="h-9 w-9 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-secondary" />
            </div>
          )}
          {title}
          {helpText && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-muted transition-colors duration-200" aria-label="Ajuda">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                {helpText}
              </TooltipContent>
            </Tooltip>
          )}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
