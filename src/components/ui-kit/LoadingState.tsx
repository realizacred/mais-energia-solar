import { cn } from "@/lib/utils";
import { ThemeLoader } from "@/components/loading/ThemeLoader";
import type { LoaderTheme, LoaderAnimation } from "@/components/loading/ThemeLoader";
import { LoadingMessage } from "@/components/loading/LoadingMessage";
import { useLoadingConfig } from "@/hooks/useLoadingConfig";
import { useBrandSettings } from "@/hooks/useBrandSettings";

interface LoadingStateProps {
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  context?: string;
}

export function LoadingState({ message, className, size = "md", context = "general" }: LoadingStateProps) {
  const { config } = useLoadingConfig();
  const { settings: brandSettings } = useBrandSettings();

  const loaderTheme = (config?.loader_theme as LoaderTheme) ?? "sun";
  const loaderAnim = (config?.sun_loader_style as LoaderAnimation) ?? "pulse";
  const logoUrl = brandSettings?.logo_small_url || brandSettings?.logo_url || null;
  const customUrl = config?.custom_loader_url ?? null;
  const showMessages = config?.show_messages ?? true;

  return (
    <div className={cn("flex flex-col items-center justify-center py-16", className)}>
      <ThemeLoader
        theme={loaderTheme}
        animation={loaderAnim}
        size={size}
        logoUrl={logoUrl}
        customUrl={customUrl}
      />
      {showMessages && (
        message ? (
          <p className="text-sm text-muted-foreground mt-3">{message}</p>
        ) : (
          <div className="mt-3">
            <LoadingMessage
              context={context}
              catalog={config?.messages_catalog as Record<string, string[]> | undefined}
            />
          </div>
        )
      )}
    </div>
  );
}
