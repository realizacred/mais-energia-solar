import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
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
}: SectionCardProps) {
  return (
    <Card className={cn(className)}>
      {title && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
              {title}
            </CardTitle>
            {description && (
              <CardDescription>{description}</CardDescription>
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
