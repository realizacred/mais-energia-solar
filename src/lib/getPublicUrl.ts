/**
 * URL Resolution for the application.
 *
 * TWO distinct URL paths exist for security:
 *
 * 1. PUBLIC URL (getPublicUrl) — used for links, QR codes, canonical, OG tags, emails.
 *    Resolved from VITE_PUBLIC_URL env var → window.location.origin fallback.
 *    At runtime, the `usePublicAppUrl` hook can override this with a DB-stored value.
 *
 * 2. LOCKED URL — used for OAuth callbacks, CORS, redirect allowlists.
 *    NEVER editable via UI. Stored ONLY as Supabase secret `APP_URL_LOCKED`.
 *    Only used in Edge Functions (Deno.env.get("APP_URL_LOCKED")).
 *
 * SECURITY: The public URL MUST NEVER be used for OAuth or callback redirects.
 */

/**
 * Returns the public-facing base URL for the application (sync, build-time).
 * Uses VITE_PUBLIC_URL env var if set, otherwise falls back to window.location.origin.
 * For DB-driven resolution, use the `usePublicAppUrl` hook instead.
 */
export function getPublicUrl(): string {
  const envUrl = import.meta.env.VITE_PUBLIC_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.startsWith("http")) {
    return envUrl.replace(/\/+$/, ""); // strip trailing slash
  }
  return window.location.origin;
}
