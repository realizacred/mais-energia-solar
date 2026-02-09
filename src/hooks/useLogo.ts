import { useBrandSettings } from "@/hooks/useBrandSettings";
import logoFallback from "@/assets/logo.png";
import logoBrancaFallback from "@/assets/logo-branca.png";

/**
 * Returns the appropriate logo based on context.
 * @param options.onDarkBg - true when the logo sits on a dark background (footer, dark hero, etc.)
 * @param options.variant - "full" | "small"
 */
export function useLogo(options?: { onDarkBg?: boolean; variant?: "full" | "small" }) {
  const { settings } = useBrandSettings();
  const { onDarkBg = false, variant = "full" } = options || {};

  if (onDarkBg) {
    return (
      settings?.logo_white_url ||
      settings?.logo_url ||
      logoBrancaFallback
    );
  }

  if (variant === "small") {
    return settings?.logo_small_url || settings?.logo_url || logoFallback;
  }

  return settings?.logo_url || logoFallback;
}
