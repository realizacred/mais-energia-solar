/**
 * brandBridge.ts — Bridge between brand_settings (admin) and landing page CSS vars.
 *
 * SSOT: brand_settings defines the company identity.
 * This bridge maps those values to the landing page CSS variable namespace
 * (--la, --az, --verde, etc.) so templates automatically reflect branding.
 *
 * Página pública — exceção RB-02 documentada.
 */

export interface LandingBrandData {
  logo_url: string | null;
  logo_white_url: string | null;
  color_primary?: string | null;
  color_secondary?: string | null;
  color_accent?: string | null;
  color_success?: string | null;
  color_destructive?: string | null;
  color_warning?: string | null;
  color_background?: string | null;
  color_foreground?: string | null;
  color_card?: string | null;
  color_border?: string | null;
  color_muted_foreground?: string | null;
  font_heading?: string | null;
  font_body?: string | null;
}

/**
 * Converts HSL string from brand_settings (e.g. "25 95% 53%") to hex for inline styles.
 * Landing pages use hex/rgb in inline HTML, not Tailwind HSL tokens.
 */
function hslToHex(hslStr: string): string | null {
  if (!hslStr) return null;

  // Already hex
  if (hslStr.startsWith("#")) return hslStr;

  // Parse "H S% L%" format (brand_settings stores HSL without hsl() wrapper)
  const match = hslStr.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%?\s+(\d+(?:\.\d+)?)%?/);
  if (!match) return null;

  const h = parseFloat(match[1]);
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;

  const a2 = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a2 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };

  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Derives a darker variant of a hex color for gradients.
 */
function darkenHex(hex: string, amount = 0.2): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const darken = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  return `#${darken(r).toString(16).padStart(2, "0")}${darken(g).toString(16).padStart(2, "0")}${darken(b).toString(16).padStart(2, "0")}`;
}

/**
 * Generates CSS variable overrides that map brand_settings to landing page vars.
 * Returns a <style> block string to inject into the landing page.
 */
export function generateBrandCSS(brand: LandingBrandData): string {
  const overrides: string[] = [];

  // Map primary color → --la (accent/CTA color in landing)
  const primaryHex = hslToHex(brand.color_primary ?? "");
  if (primaryHex) {
    const primaryDark = darkenHex(primaryHex, 0.15);
    overrides.push(`  --la: ${primaryHex};`);
    overrides.push(`  --la2: ${primaryDark};`);
    overrides.push(`  --icon-circle-bg: ${primaryHex};`);
    overrides.push(`  --nav-border: ${primaryHex};`);
    overrides.push(`  --nav-active-bg: ${primaryHex};`);
    overrides.push(`  --hero-metrics-text: ${primaryHex};`);
  }

  // Map secondary → --az (main brand color in landing)
  const secondaryHex = hslToHex(brand.color_secondary ?? "");
  if (secondaryHex) {
    const secondaryDark = darkenHex(secondaryHex, 0.2);
    overrides.push(`  --az: ${secondaryHex};`);
    overrides.push(`  --az2: ${secondaryDark};`);
    overrides.push(`  --nav-bg: ${secondaryHex};`);
    overrides.push(`  --section-header-bg: linear-gradient(135deg, ${secondaryHex}, ${secondaryDark});`);
    overrides.push(`  --cta-bg: linear-gradient(135deg, ${secondaryDark}, ${secondaryHex});`);
    overrides.push(`  --footer-bg: ${secondaryDark};`);
    overrides.push(`  --info-value-color: ${secondaryHex};`);
  }

  // Map success → --verde
  const successHex = hslToHex(brand.color_success ?? "");
  if (successHex) {
    overrides.push(`  --verde: ${successHex};`);
  }

  // Map destructive → --negative
  const destructiveHex = hslToHex(brand.color_destructive ?? "");
  if (destructiveHex) {
    overrides.push(`  --negative: ${destructiveHex};`);
  }

  // Background / surface
  const bgHex = hslToHex(brand.color_background ?? "");
  if (bgHex) {
    overrides.push(`  --fundo: ${bgHex};`);
  }

  const cardHex = hslToHex(brand.color_card ?? "");
  if (cardHex) {
    overrides.push(`  --card-bg: ${cardHex};`);
  }

  const borderHex = hslToHex(brand.color_border ?? "");
  if (borderHex) {
    overrides.push(`  --card-border: ${borderHex};`);
  }

  const fgHex = hslToHex(brand.color_foreground ?? "");
  if (fgHex) {
    overrides.push(`  --body-text: ${fgHex};`);
  }

  const mutedFgHex = hslToHex(brand.color_muted_foreground ?? "");
  if (mutedFgHex) {
    overrides.push(`  --cinza: ${mutedFgHex};`);
    overrides.push(`  --info-label-color: ${mutedFgHex};`);
  }

  // Fonts
  if (brand.font_heading) {
    overrides.push(`  --font-heading: '${brand.font_heading}', sans-serif;`);
  }
  if (brand.font_body) {
    overrides.push(`  --font-body: '${brand.font_body}', sans-serif;`);
    overrides.push(`  --font-numbers: '${brand.font_heading || brand.font_body}', sans-serif;`);
  }

  if (overrides.length === 0) return "";

  return `
/* Brand Bridge — auto-generated from brand_settings */
:root {
${overrides.join("\n")}
}`;
}

/**
 * Builds a complete variables map for template rendering,
 * enriched with branding data.
 */
export function enrichVariablesWithBrand(
  vars: Record<string, string>,
  brand: LandingBrandData,
  tenantNome?: string | null,
): Record<string, string> {
  const enriched = { ...vars };

  if (brand.logo_url) {
    enriched["empresa_logo_url"] = brand.logo_url;
    enriched["logo_url"] = brand.logo_url;
  }
  if (brand.logo_white_url) {
    enriched["empresa_logo_white_url"] = brand.logo_white_url;
    enriched["logo_white_url"] = brand.logo_white_url;
  }
  if (tenantNome) {
    enriched["empresa_nome"] = tenantNome;
  }

  // Map brand colors as template variables too
  const primaryHex = hslToHex(brand.color_primary ?? "");
  if (primaryHex) enriched["brand_primary"] = primaryHex;

  const secondaryHex = hslToHex(brand.color_secondary ?? "");
  if (secondaryHex) enriched["brand_secondary"] = secondaryHex;

  return enriched;
}
