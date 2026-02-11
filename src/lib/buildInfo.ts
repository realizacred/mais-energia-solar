/**
 * Build information for cache/version debugging.
 * The timestamp is set at BUILD TIME by Vite's define plugin.
 */
export const BUILD_TIMESTAMP = __BUILD_TIMESTAMP__ ?? "dev";

// Make TypeScript aware of the global injected by Vite
declare global {
  const __BUILD_TIMESTAMP__: string | undefined;
}
