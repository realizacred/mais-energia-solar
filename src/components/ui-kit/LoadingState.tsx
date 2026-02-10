import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message, className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
