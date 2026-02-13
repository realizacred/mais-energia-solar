import { ThemeLoader } from "./ThemeLoader";
import type { LoaderTheme, LoaderAnimation } from "./ThemeLoader";
import { useLoadingConfig } from "@/hooks/useLoadingConfig";

interface ButtonLoaderProps {
  className?: string;
}

/**
 * Micro-loader para dentro de botões.
 * Usa o tema configurado pelo admin.
 */
export function ButtonLoader({ className = "" }: ButtonLoaderProps) {
  const { config } = useLoadingConfig();
  const theme = (config?.loader_theme as LoaderTheme) ?? "sun";

  return (
    <ThemeLoader
      theme={theme}
      animation="spin"
      size="sm"
      className={className}
    />
  );
}
