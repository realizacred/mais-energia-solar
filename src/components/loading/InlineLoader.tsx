import { SunLoader } from "./SunLoader";
import { LoadingMessage } from "./LoadingMessage";
import { useLoadingConfig } from "@/hooks/useLoadingConfig";

interface InlineLoaderProps {
  context?: string;
  message?: string;
  className?: string;
}

/**
 * Loader inline para substituir conteúdo enquanto carrega.
 * Usa SunLoader + mensagem contextual.
 */
export function InlineLoader({ context = "data_load", message, className = "" }: InlineLoaderProps) {
  const { config } = useLoadingConfig();
  const useSun = config?.sun_loader_enabled ?? true;
  const showMessages = config?.show_messages ?? true;
  const sunStyle = (config?.sun_loader_style as "pulse" | "spin" | "breathe") ?? "pulse";

  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-8 ${className}`}>
      {useSun ? (
        <SunLoader size="md" style={sunStyle} />
      ) : (
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      )}
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
