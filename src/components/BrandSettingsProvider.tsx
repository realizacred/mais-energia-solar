import { useBrandSettings } from "@/hooks/useBrandSettings";

/**
 * Invisible component that loads brand settings from the database
 * and applies them as CSS variables globally. Mount once at the app root.
 */
export function BrandSettingsProvider({ children }: { children: React.ReactNode }) {
  // This hook fetches settings on mount and applies CSS variables
  useBrandSettings();
  return <>{children}</>;
}
