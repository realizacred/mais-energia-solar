import { useState, useEffect } from "react";
import { SunLoader } from "./SunLoader";
import { RotatingLoadingMessage } from "./LoadingMessage";
import { useLoadingConfig } from "@/hooks/useLoadingConfig";

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
  const useSun = config?.sun_loader_enabled ?? true;
  const sunStyle = (config?.sun_loader_style as "pulse" | "spin" | "breathe") ?? "pulse";
  const showMessages = config?.show_messages ?? true;

  // Delay before showing
  useEffect(() => {
    if (!visible) {
      // Only hide after min duration
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
      {useSun ? (
        <SunLoader size="lg" style={sunStyle} />
      ) : (
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      )}
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
