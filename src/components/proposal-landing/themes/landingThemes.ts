/**
 * landingThemes.ts — CSS themes for the proposal landing page (/pl/:token)
 * 
 * 3 visual models:
 *   1. Default (Blue/Orange) — current design
 *   2. Solar Clean (White/Orange) — minimalist corporate
 *   3. Premium Dark (Dark/Gold) — premium corporate
 * 
 * All themes use CSS variables consumed by the same JSX.
 * RB-17: no console.log
 */

const SHARED_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Open+Sans:wght@300;400;500;600&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

.pl-landing * { box-sizing: border-box; }

.pl-landing .section-header {
  padding: 1rem 1.5rem; display: flex; align-items: center; gap: 0.75rem;
  border-radius: 12px 12px 0 0;
}
.pl-landing .section-header .icon-circle {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.pl-landing .section-header h2 {
  font-weight: 800; font-size: 1.1rem; letter-spacing: -0.01em; margin: 0;
}
.pl-landing .card-body {
  border-top: none; border-radius: 0 0 12px 12px; padding: 1.5rem;
}
.pl-landing .info-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;
}
.pl-landing .info-box {
  border-radius: 10px; padding: 0.75rem 1rem;
}
.pl-landing .info-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; }
.pl-landing .info-value { font-weight: 700; font-size: 0.95rem; }
.pl-landing .btn-la {
  border: none; padding: 0.75rem 2rem; border-radius: 8px;
  font-weight: 700; cursor: pointer; font-size: 0.95rem; transition: all 0.2s;
}
.pl-landing .btn-la:hover { transform: translateY(-1px); }
.pl-landing .btn-verde {
  border: none; padding: 0.75rem 2rem; border-radius: 8px;
  font-weight: 700; cursor: pointer; font-size: 0.95rem; transition: all 0.2s;
  display: inline-flex; align-items: center; gap: 0.5rem;
}
`;

/* ━━━ THEME 1 — DEFAULT (Blue/Orange) ━━━ */
const THEME_1_VARS = `
:root {
  --az: #1B3A8C;
  --az2: #2550C0;
  --la: #F07B24;
  --la2: #E06010;
  --verde: #16A34A;
  --cinza: #64748B;
  --fundo: #F0F4FA;
  --br: #ffffff;
  --hero-bg: linear-gradient(135deg, #1B3A8C, #0D2460, #1a1a3e);
  --hero-text: #ffffff;
  --hero-muted: rgba(255,255,255,0.5);
  --hero-overlay: rgba(255,255,255,0.07);
  --hero-overlay-border: rgba(255,255,255,0.12);
  --hero-metrics-text: var(--la);
  --cta-bg: linear-gradient(135deg, #0D2460, #1B3A8C);
  --nav-bg: #1B3A8C;
  --nav-border: var(--la);
  --nav-text: rgba(255,255,255,0.7);
  --nav-active-bg: var(--la);
  --nav-active-text: #fff;
  --table-alt: #f8fafc;
  --negative: #ef4444;
  --card-border: #e2e8f0;
  --card-bg: #ffffff;
  --body-text: #1e293b;
  --section-header-bg: linear-gradient(135deg, var(--az), var(--az2));
  --section-header-text: #fff;
  --icon-circle-bg: var(--la);
  --icon-circle-text: #fff;
  --info-box-bg: rgba(27,58,140,0.04);
  --info-box-border: rgba(27,58,140,0.1);
  --info-label-color: var(--cinza);
  --info-value-color: var(--az);
  --accent-box-bg: var(--az);
  --accent-box-text: #fff;
  --accept-input-bg: rgba(255,255,255,0.1);
  --accept-input-border: rgba(255,255,255,0.2);
  --accept-input-text: #fff;
  --footer-bg: var(--az);
  --footer-text: rgba(255,255,255,0.5);
  --reject-modal-bg: #fff;
  --reject-modal-text: var(--az);
  --reject-modal-desc: var(--cinza);
  --font-heading: 'Montserrat', sans-serif;
  --font-body: 'Open Sans', sans-serif;
  --font-numbers: 'Montserrat', sans-serif;
}
`;

const THEME_1_OVERRIDES = `
.pl-landing { font-family: var(--font-body); color: var(--body-text); background: var(--fundo); }
.pl-landing h1, .pl-landing h2, .pl-landing h3,
.pl-landing .font-heading { font-family: var(--font-heading); }
.pl-landing .section-header {
  background: var(--section-header-bg); color: var(--section-header-text);
}
.pl-landing .section-header .icon-circle { background: var(--icon-circle-bg); }
.pl-landing .card-body {
  background: var(--card-bg); border: 1px solid var(--card-border);
}
.pl-landing .info-box {
  background: var(--info-box-bg); border: 1px solid var(--info-box-border);
}
.pl-landing .info-label { color: var(--info-label-color); }
.pl-landing .info-value { font-family: var(--font-numbers); color: var(--info-value-color); }
.pl-landing .btn-la {
  background: linear-gradient(135deg, var(--la), var(--la2)); color: #fff;
  font-family: var(--font-heading);
}
.pl-landing .btn-la:hover { box-shadow: 0 4px 15px rgba(240,123,36,0.4); }
.pl-landing .btn-verde {
  background: var(--verde); color: #fff; font-family: var(--font-heading);
}
.pl-landing .btn-verde:hover { background: #15803d; }
`;

/* ━━━ THEME 2 — SOLAR CLEAN (White/Orange) ━━━ */
const THEME_2_VARS = `
:root {
  --az: #1e293b;
  --az2: #334155;
  --la: #F07B24;
  --la2: #E06010;
  --verde: #16A34A;
  --cinza: #64748B;
  --fundo: #FFFFFF;
  --br: #ffffff;
  --hero-bg: linear-gradient(135deg, #FFFFFF, #F0F4FA);
  --hero-text: #1e293b;
  --hero-muted: #64748B;
  --hero-overlay: rgba(240,123,36,0.04);
  --hero-overlay-border: rgba(240,123,36,0.15);
  --hero-metrics-text: var(--la);
  --cta-bg: linear-gradient(135deg, #1e293b, #334155);
  --nav-bg: #FFFFFF;
  --nav-border: var(--la);
  --nav-text: #64748B;
  --nav-active-bg: var(--la);
  --nav-active-text: #fff;
  --table-alt: #f8fafc;
  --negative: #ef4444;
  --card-border: #e2e8f0;
  --card-bg: #ffffff;
  --body-text: #1e293b;
  --section-header-bg: #FFFFFF;
  --section-header-text: #1e293b;
  --icon-circle-bg: var(--la);
  --icon-circle-text: #fff;
  --info-box-bg: #F0F4FA;
  --info-box-border: #e2e8f0;
  --info-label-color: var(--cinza);
  --info-value-color: #1e293b;
  --accent-box-bg: linear-gradient(135deg, var(--la), var(--la2));
  --accent-box-text: #fff;
  --accept-input-bg: #f8fafc;
  --accept-input-border: #e2e8f0;
  --accept-input-text: #1e293b;
  --footer-bg: #1e293b;
  --footer-text: rgba(255,255,255,0.5);
  --reject-modal-bg: #fff;
  --reject-modal-text: #1e293b;
  --reject-modal-desc: var(--cinza);
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-numbers: 'Inter', sans-serif;
}
`;

const THEME_2_OVERRIDES = `
.pl-landing { font-family: var(--font-body); color: var(--body-text); background: var(--fundo); }
.pl-landing h1, .pl-landing h2, .pl-landing h3,
.pl-landing .font-heading { font-family: var(--font-heading); }
.pl-landing .section-header {
  background: var(--section-header-bg); color: var(--section-header-text);
  border-left: 4px solid var(--la); border-radius: 0; border-bottom: 1px solid #e2e8f0;
}
.pl-landing .section-header .icon-circle { background: var(--icon-circle-bg); }
.pl-landing .section-header h2 { color: #1e293b; }
.pl-landing .card-body {
  background: var(--card-bg); border: 1px solid var(--card-border);
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.pl-landing .info-box {
  background: var(--info-box-bg); border: 1px solid var(--info-box-border);
}
.pl-landing .info-label { color: var(--info-label-color); }
.pl-landing .info-value { font-family: var(--font-numbers); color: var(--info-value-color); font-weight: 700; }
.pl-landing .btn-la {
  background: var(--la); color: #fff; font-family: var(--font-heading); border-radius: 10px;
}
.pl-landing .btn-la:hover { box-shadow: 0 4px 12px rgba(240,123,36,0.3); background: var(--la2); }
.pl-landing .btn-verde {
  background: var(--verde); color: #fff; font-family: var(--font-heading); border-radius: 10px;
}
.pl-landing .btn-verde:hover { background: #15803d; }

/* Solar Clean: nav shadow instead of border-bottom */
.pl-landing-nav-clean { box-shadow: 0 1px 4px rgba(0,0,0,0.08) !important; }
`;

/* ━━━ THEME 3 — PREMIUM DARK (Dark/Gold) ━━━ */
const THEME_3_VARS = `
:root {
  --az: #6366F1;
  --az2: #818CF8;
  --la: #F59E0B;
  --la2: #D97706;
  --verde: #34D399;
  --cinza: #94A3B8;
  --fundo: #0A0A0F;
  --br: #1A1A2E;
  --hero-bg: linear-gradient(135deg, #0A0A0F, #111127, #0A0A0F);
  --hero-text: #F1F5F9;
  --hero-muted: #94A3B8;
  --hero-overlay: rgba(245,158,11,0.06);
  --hero-overlay-border: rgba(245,158,11,0.15);
  --hero-metrics-text: var(--la);
  --cta-bg: linear-gradient(135deg, #1A1A2E, #111127);
  --nav-bg: #0A0A0F;
  --nav-border: var(--la);
  --nav-text: #94A3B8;
  --nav-active-bg: var(--la);
  --nav-active-text: #0A0A0F;
  --table-alt: #111127;
  --negative: #F87171;
  --card-border: rgba(245,158,11,0.12);
  --card-bg: #1A1A2E;
  --body-text: #E2E8F0;
  --section-header-bg: linear-gradient(135deg, #1A1A2E, #111127);
  --section-header-text: #F1F5F9;
  --icon-circle-bg: var(--la);
  --icon-circle-text: #0A0A0F;
  --info-box-bg: rgba(245,158,11,0.04);
  --info-box-border: rgba(245,158,11,0.1);
  --info-label-color: #94A3B8;
  --info-value-color: var(--la);
  --accent-box-bg: linear-gradient(135deg, #1A1A2E, #111127);
  --accent-box-text: #F1F5F9;
  --accept-input-bg: rgba(255,255,255,0.05);
  --accept-input-border: rgba(245,158,11,0.2);
  --accept-input-text: #F1F5F9;
  --footer-bg: #0A0A0F;
  --footer-text: #64748B;
  --reject-modal-bg: #1A1A2E;
  --reject-modal-text: #F1F5F9;
  --reject-modal-desc: #94A3B8;
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-numbers: 'JetBrains Mono', monospace;
}
`;

const THEME_3_OVERRIDES = `
.pl-landing { font-family: var(--font-body); color: var(--body-text); background: var(--fundo); }
.pl-landing h1, .pl-landing h2, .pl-landing h3,
.pl-landing .font-heading { font-family: var(--font-heading); }
.pl-landing .section-header {
  background: var(--section-header-bg); color: var(--section-header-text);
  border: 1px solid rgba(245,158,11,0.1); border-bottom: none;
}
.pl-landing .section-header .icon-circle { background: var(--icon-circle-bg); }
.pl-landing .card-body {
  background: var(--card-bg); border: 1px solid var(--card-border);
  box-shadow: 0 0 20px rgba(245,158,11,0.03);
}
.pl-landing .info-box {
  background: var(--info-box-bg); border: 1px solid var(--info-box-border);
}
.pl-landing .info-label { color: var(--info-label-color); }
.pl-landing .info-value { font-family: var(--font-numbers); color: var(--info-value-color); }
.pl-landing .btn-la {
  background: linear-gradient(135deg, var(--la), var(--la2)); color: #0A0A0F;
  font-family: var(--font-heading); font-weight: 800;
}
.pl-landing .btn-la:hover { box-shadow: 0 4px 20px rgba(245,158,11,0.4); }
.pl-landing .btn-verde {
  background: var(--verde); color: #0A0A0F; font-family: var(--font-heading); font-weight: 800;
}
.pl-landing .btn-verde:hover { background: #10B981; }

/* Gold glow for value highlights */
.pl-landing .premium-glow { text-shadow: 0 0 12px rgba(245,158,11,0.3); }
`;

export type LandingTheme = 1 | 2 | 3;

const THEMES: Record<LandingTheme, string> = {
  1: SHARED_CSS + THEME_1_VARS + THEME_1_OVERRIDES,
  2: SHARED_CSS + THEME_2_VARS + THEME_2_OVERRIDES,
  3: SHARED_CSS + THEME_3_VARS + THEME_3_OVERRIDES,
};

export const THEME_NAMES: Record<LandingTheme, string> = {
  1: "Padrão",
  2: "Solar Clean",
  3: "Premium Dark",
};

export function getLandingThemeCSS(modelo: LandingTheme): string {
  return THEMES[modelo] || THEMES[1];
}

export function parseModelo(raw: string | null): LandingTheme {
  const n = Number(raw);
  if (n === 2 || n === 3) return n;
  return 1;
}
