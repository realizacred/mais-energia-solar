import { SunLoader } from "./SunLoader";
import { useLoadingConfig } from "@/hooks/useLoadingConfig";

interface ButtonLoaderProps {
  className?: string;
}

/**
 * Micro-loader para dentro de botões.
 * Substitui o Loader2 padrão.
 */
export function ButtonLoader({ className = "" }: ButtonLoaderProps) {
  const { config } = useLoadingConfig();
  const useSun = config?.sun_loader_enabled ?? true;

  if (useSun) {
    return <SunLoader size="sm" style="spin" className={className} />;
  }

  return (
    <div className={`h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin ${className}`} />
  );
}
