import { cn } from "@/lib/utils";
import { ThemeLoader } from "@/components/loading/ThemeLoader";
import type { LoaderTheme, LoaderAnimation } from "@/components/loading/ThemeLoader";
import { useLoadingConfig } from "@/hooks/useLoadingConfig";
import { useBrandSettings } from "@/hooks/useBrandSettings";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Drop-in replacement for inline Loader2 spinners.
 * Uses the tenant's configured theme loader.
 */
export function Spinner({ size = "sm", className }: SpinnerProps) {
  const { config } = useLoadingConfig();
  const { settings: brandSettings } = useBrandSettings();

  const loaderTheme = (config?.loader_theme as LoaderTheme) ?? "sun";
  const loaderAnim = (config?.sun_loader_style as LoaderAnimation) ?? "pulse";
  const logoUrl = brandSettings?.logo_small_url || brandSettings?.logo_url || null;
  const customUrl = config?.custom_loader_url ?? null;

  return (
    <ThemeLoader
      theme={loaderTheme}
      animation={loaderAnim}
      size={size}
      logoUrl={logoUrl}
      customUrl={customUrl}
      className={cn(className)}
    />
  );
}
