import { ThemeLoader } from "./ThemeLoader";
import { RotatingLoadingMessage, LoadingMessage } from "./LoadingMessage";
import { useLoadingConfig } from "@/hooks/useLoadingConfig";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import type { LoaderTheme, LoaderAnimation } from "./ThemeLoader";

interface InlineLoaderProps {
  context?: string;
  message?: string;
  className?: string;
}

/**
 * Loader inline para substituir conteúdo enquanto carrega.
 * Usa ThemeLoader configurável + mensagem contextual.
 */
export function InlineLoader({ context = "data_load", message, className = "" }: InlineLoaderProps) {
  const { config } = useLoadingConfig();
  const { settings: brandSettings } = useBrandSettings();

  const loaderTheme = (config?.loader_theme as LoaderTheme) ?? "sun";
  const loaderAnim = (config?.sun_loader_style as LoaderAnimation) ?? "pulse";
  const showMessages = config?.show_messages ?? true;
  const logoUrl = brandSettings?.logo_small_url || brandSettings?.logo_url || null;
  const customUrl = config?.custom_loader_url ?? null;

  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-8 ${className}`}>
      <ThemeLoader
        theme={loaderTheme}
        animation={loaderAnim}
        size="md"
        logoUrl={logoUrl}
        customUrl={customUrl}
      />
      {showMessages && (
        message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : (
          <LoadingMessage 
            context={context}
            catalog={config?.messages_catalog as Record<string, string[]> | undefined}
          />
        )
      )}
    </div>
  );
}
