import { useBrandSettings } from "@/hooks/useBrandSettings";
import logoFallback from "@/assets/logo.png";
import logoBrancaFallback from "@/assets/logo-branca.png";

/**
 * Returns the appropriate logo based on the current theme (light/dark).
 * In dark mode, prefers logo_white_url; in light mode, prefers logo_url.
 */
export function useLogo(variant: "full" | "small" = "full") {
  const { settings } = useBrandSettings();

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  if (isDark) {
    const darkLogo =
      settings?.logo_white_url ||
      (variant === "small" ? settings?.logo_small_url : null) ||
      settings?.logo_url ||
      logoBrancaFallback;
    return darkLogo;
  }

  if (variant === "small") {
    return settings?.logo_small_url || settings?.logo_url || logoFallback;
  }

  return settings?.logo_url || logoFallback;
}
