/**
 * Dynamically sets the correct PWA manifest and theme-color
 * based on the current URL path. Must run BEFORE React mounts
 * so the browser sees the right manifest for install prompts.
 *
 * Route → Manifest mapping:
 *   /v/:slug   → manifest-captacao.json   (lead capture)
 *   /w/:slug   → manifest-whatsapp.json   (WhatsApp portal)
 *   /app       → app-manifest.json        (messaging app)
 *   /sistema   → sistema-manifest.json    (management system)
 *   /instalador→ instalador-manifest.json (installer)
 *   *          → manifest.webmanifest     (default / admin)
 */

interface ManifestRoute {
  prefix: string;
  manifest: string;
  themeColor: string;
}

const ROUTES: ManifestRoute[] = [
  { prefix: "/v/",        manifest: "/manifest-captacao.json",    themeColor: "#FF6600" },
  { prefix: "/app",       manifest: "/app-manifest.json",         themeColor: "#16a34a" },
  { prefix: "/sistema",   manifest: "/sistema-manifest.json",     themeColor: "#e8760d" },
  { prefix: "/instalador",manifest: "/instalador-manifest.json",  themeColor: "#e8760d" },
];

const DEFAULT_MANIFEST = "/manifest.webmanifest";
const DEFAULT_THEME    = "#e8760d";

export function applyRouteManifest() {
  const path = window.location.pathname;
  const match = ROUTES.find((r) => path.startsWith(r.prefix));

  const manifestHref = match?.manifest ?? DEFAULT_MANIFEST;
  const themeColor   = match?.themeColor ?? DEFAULT_THEME;

  // — Manifest link —
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (link) {
    link.setAttribute("href", manifestHref);
  } else {
    link = document.createElement("link");
    link.rel = "manifest";
    link.href = manifestHref;
    document.head.appendChild(link);
  }

  // — Theme-color meta —
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = themeColor;
  } else {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = themeColor;
    document.head.appendChild(meta);
  }

}
