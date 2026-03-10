import React from "react";
import { cn } from "@/lib/utils";

interface InfoPillProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  className?: string;
}

export function InfoPill({ icon: Icon, label, value, className }: InfoPillProps) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2", className)}>
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
