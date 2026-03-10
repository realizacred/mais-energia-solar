import React from "react";
import { cn } from "@/lib/utils";

interface ActionLinkProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  iconColor?: string;
}

export function ActionLink({ icon: Icon, label, onClick, disabled, iconColor }: ActionLinkProps) {
  return (
    <button
      className="flex items-center gap-2 text-xs text-foreground/80 hover:text-primary transition-colors py-1.5 disabled:opacity-40 disabled:pointer-events-none group w-full text-left"
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor || "text-primary")} />
      <span className="group-hover:underline underline-offset-2">{label}</span>
    </button>
  );
}
