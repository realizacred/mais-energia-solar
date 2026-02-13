/**
 * Returns the public-facing base URL for the application.
 * Uses VITE_PUBLIC_URL env var if set, otherwise falls back to window.location.origin.
 * This ensures QR codes and shared links always point to the correct published domain.
 */
export function getPublicUrl(): string {
  const envUrl = import.meta.env.VITE_PUBLIC_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.startsWith("http")) {
    return envUrl.replace(/\/+$/, ""); // strip trailing slash
  }
  return window.location.origin;
}
