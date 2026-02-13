import { useState, useEffect } from "react";
import { ThemeLoader } from "./ThemeLoader";
import type { LoaderTheme, LoaderAnimation } from "./ThemeLoader";
import { RotatingLoadingMessage } from "./LoadingMessage";
import { useLoadingConfig } from "@/hooks/useLoadingConfig";
import { useBrandSettings } from "@/hooks/useBrandSettings";

interface LoadingOverlayProps {
  visible: boolean;
  context?: string;
  message?: string;
  fullscreen?: boolean;
}

/**
 * Overlay de loading com delay inteligente.
 * Só aparece após overlay_delay_ms para evitar flash em operações rápidas.
 */
export function LoadingOverlay({ visible, context = "general", message, fullscreen = false }: LoadingOverlayProps) {
  const { config } = useLoadingConfig();
  const [show, setShow] = useState(false);
  const [minTimeReached, setMinTimeReached] = useState(false);

  const delayMs = config?.overlay_delay_ms ?? 400;
  const minDurationMs = config?.overlay_min_duration_ms ?? 300;
  const loaderTheme = (config?.loader_theme as LoaderTheme) ?? "sun";
  const loaderAnim = (config?.sun_loader_style as LoaderAnimation) ?? "pulse";
  const customUrl = config?.custom_loader_url ?? null;
  const showMessages = config?.show_messages ?? true;

  // Get brand logo for "logo" theme
  const { settings: brandSettings } = useBrandSettings();
  const logoUrl = brandSettings?.logo_small_url || brandSettings?.logo_url || null;

  // Delay before showing
  useEffect(() => {
    if (!visible) {
      if (!minTimeReached) return;
      setShow(false);
      return;
    }

    setMinTimeReached(false);
    const delayTimer = setTimeout(() => setShow(true), delayMs);
    const minTimer = setTimeout(() => setMinTimeReached(true), delayMs + minDurationMs);

    return () => {
      clearTimeout(delayTimer);
      clearTimeout(minTimer);
    };
  }, [visible, delayMs, minDurationMs]);

  // Reset when hidden
  useEffect(() => {
    if (!visible && !show) {
      setMinTimeReached(false);
    }
  }, [visible, show]);

  if (!show && !visible) return null;
  if (!show) return null;

  const content = (
    <div className="flex flex-col items-center gap-3">
      <ThemeLoader
        theme={loaderTheme}
        animation={loaderAnim}
        size="lg"
        logoUrl={logoUrl}
        customUrl={customUrl}
      />
      {showMessages && (
        message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : (
          <RotatingLoadingMessage 
            context={context} 
            catalog={config?.messages_catalog as Record<string, string[]> | undefined}
          />
        )
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in motion-reduce:animate-none">
        {content}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[2px] rounded-inherit animate-fade-in motion-reduce:animate-none">
      {content}
    </div>
  );
}
