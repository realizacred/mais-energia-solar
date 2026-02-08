/**
 * Extracts dominant colors from an image URL using Canvas API (client-side).
 * Returns a COMPLETE palette (HSL strings) covering:
 *   - Cores Principais (primary, secondary)
 *   - Interface (background, foreground, card, border, muted, accent)
 *   - Status (success, warning, destructive, info)
 *   - Modo Escuro (dark variants)
 */

export interface ExtractedPalette {
  // Cores Principais
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  // Interface
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  border: string;
  muted: string;
  mutedForeground: string;
  // Status
  success: string;
  warning: string;
  destructive: string;
  info: string;
  // Modo Escuro
  darkPrimary: string;
  darkBackground: string;
  darkForeground: string;
  darkCard: string;
  darkBorder: string;
  darkMuted: string;
  darkMutedForeground: string;
}

interface RGB { r: number; g: number; b: number }

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hsl(h: number, s: number, l: number): string {
  return `${h} ${s}% ${l}%`;
}

function contrastForeground(l: number): string {
  return l > 55 ? "222 47% 11%" : "0 0% 100%";
}

/** K-means-inspired dominant color extraction */
function extractDominantColors(imageData: ImageData, k = 5): RGB[] {
  const pixels: RGB[] = [];
  const data = imageData.data;

  // Sample every 4th pixel for performance
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const brightness = (r + g + b) / 3;
    if (brightness > 245 || brightness < 10) continue;
    pixels.push({ r, g, b });
  }

  if (pixels.length === 0) return [{ r: 255, g: 107, b: 0 }];

  let centers: RGB[] = pixels.slice(0, k).map(p => ({ ...p }));

  for (let iter = 0; iter < 10; iter++) {
    const clusters: RGB[][] = centers.map(() => []);

    for (const p of pixels) {
      let minDist = Infinity, minIdx = 0;
      centers.forEach((c, i) => {
        const d = (p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2;
        if (d < minDist) { minDist = d; minIdx = i; }
      });
      clusters[minIdx].push(p);
    }

    centers = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centers[i];
      const avg = { r: 0, g: 0, b: 0 };
      cluster.forEach(p => { avg.r += p.r; avg.g += p.g; avg.b += p.b; });
      return {
        r: Math.round(avg.r / cluster.length),
        g: Math.round(avg.g / cluster.length),
        b: Math.round(avg.b / cluster.length),
      };
    });
  }

  // Sort by saturation (most saturated first)
  return centers.sort((a, b) => {
    const [, sA] = rgbToHsl(a.r, a.g, a.b);
    const [, sB] = rgbToHsl(b.r, b.g, b.b);
    return sB - sA;
  });
}

/**
 * Build a complete palette from the dominant colors extracted from the logo.
 * The logic derives Interface, Status, and Dark Mode from the primary/secondary hues.
 */
function buildFullPalette(colors: RGB[]): ExtractedPalette {
  const [h1, s1, l1] = rgbToHsl(colors[0].r, colors[0].g, colors[0].b);

  // ─── Cores Principais ──────────────────────────────────────
  const primaryH = h1;
  const primaryS = Math.min(Math.max(s1, 55), 95);
  const primaryL = Math.min(Math.max(l1, 42), 52);

  let secondaryH: number, secondaryS: number, secondaryL: number;
  if (colors.length > 1) {
    const [h2, s2, l2] = rgbToHsl(colors[1].r, colors[1].g, colors[1].b);
    secondaryH = h2;
    secondaryS = Math.min(Math.max(s2, 35), 65);
    secondaryL = Math.min(Math.max(l2, 20), 35);
  } else {
    // Complementary deep tone if no second color
    secondaryH = (h1 + 190) % 360;
    secondaryS = 45;
    secondaryL = 25;
  }

  // ─── Interface ─────────────────────────────────────────────
  // Derive neutral hues from the primary hue for a cohesive feel
  const neutralH = primaryH;
  const neutralS = Math.min(Math.round(primaryS * 0.14), 16); // very desaturated

  const background = hsl(neutralH, neutralS, 96);
  const foreground = hsl(neutralH, Math.max(neutralS + 6, 18), 12);
  const card = hsl(0, 0, 100);
  const cardForeground = foreground;
  const border = hsl(neutralH, Math.max(neutralS - 2, 8), 90);
  const muted = hsl(neutralH, Math.max(neutralS - 2, 8), 94);
  const mutedForeground = hsl(neutralH, Math.max(neutralS - 4, 6), 46);

  // Accent: very light tint of primary
  let accentH: number, accentS: number;
  if (colors.length > 2) {
    const [h3, s3] = rgbToHsl(colors[2].r, colors[2].g, colors[2].b);
    accentH = h3;
    accentS = Math.min(s3, 18);
  } else {
    accentH = primaryH;
    accentS = 14;
  }

  // ─── Status Colors ────────────────────────────────────────
  // Status colors keep fixed, universally-recognizable hues
  // but tune saturation/lightness to harmonize with the brand
  const statusS = Math.min(Math.max(primaryS * 0.5, 32), 50);
  const success     = hsl(158, statusS,      38);
  const warning     = hsl(38,  statusS + 12, 48);
  const destructive = hsl(4,   statusS + 8,  44);
  const info        = hsl(210, statusS + 6,  48);

  // ─── Modo Escuro ──────────────────────────────────────────
  const darkPrimary          = hsl(primaryH, Math.min(primaryS, 80), Math.min(primaryL + 8, 58));
  const darkBackground       = hsl(neutralH, Math.max(neutralS + 8, 20), 7);
  const darkForeground       = hsl(neutralH, Math.max(neutralS - 2, 8), 92);
  const darkCard             = hsl(neutralH, Math.max(neutralS + 4, 16), 9);
  const darkBorder           = hsl(neutralH, Math.max(neutralS, 12), 15);
  const darkMuted            = hsl(neutralH, Math.max(neutralS, 10), 14);
  const darkMutedForeground  = hsl(neutralH, Math.max(neutralS - 4, 6), 58);

  return {
    primary: hsl(primaryH, primaryS, primaryL),
    primaryForeground: contrastForeground(primaryL),
    secondary: hsl(secondaryH, secondaryS, secondaryL),
    secondaryForeground: "0 0% 100%",
    accent: hsl(accentH, accentS, 93),
    accentForeground: foreground,
    background,
    foreground,
    card,
    cardForeground,
    border,
    muted,
    mutedForeground,
    success,
    warning,
    destructive,
    info,
    darkPrimary,
    darkBackground,
    darkForeground,
    darkCard,
    darkBorder,
    darkMuted,
    darkMutedForeground,
  };
}

export async function extractColorsFromImage(imageUrl: string): Promise<ExtractedPalette> {
  // Use fetch+blob to avoid CORS issues with canvas taint
  const blob = await fetch(imageUrl, { mode: "cors" })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.blob();
    })
    .catch(async () => {
      const r = await fetch(imageUrl);
      if (!r.ok) throw new Error("Failed to fetch image");
      return r.blob();
    });

  const blobUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 100;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const colors = extractDominantColors(imageData, 5);

        resolve(buildFullPalette(colors));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("Failed to load image from blob"));
    };
    img.src = blobUrl;
  });
}
