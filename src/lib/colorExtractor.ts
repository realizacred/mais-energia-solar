/**
 * Extracts dominant colors from an image URL using Canvas API (client-side).
 * Returns HSL strings ready for CSS variables.
 */

interface ExtractedPalette {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
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

function hslString(h: number, s: number, l: number): string {
  return `${h} ${s}% ${l}%`;
}

function getContrastForeground(l: number): string {
  return l > 55 ? "222 47% 11%" : "0 0% 100%";
}

/** K-means-inspired dominant color extraction */
function extractDominantColors(imageData: ImageData, k = 5): RGB[] {
  const pixels: RGB[] = [];
  const data = imageData.data;

  // Sample every 4th pixel for performance
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    // Skip transparent / near-white / near-black pixels
    if (a < 128) continue;
    const brightness = (r + g + b) / 3;
    if (brightness > 245 || brightness < 10) continue;
    pixels.push({ r, g, b });
  }

  if (pixels.length === 0) return [{ r: 255, g: 107, b: 0 }];

  // Simple k-means
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

export async function extractColorsFromImage(imageUrl: string): Promise<ExtractedPalette> {
  // Use fetch+blob to avoid CORS issues with canvas taint
  const blob = await fetch(imageUrl, { mode: "cors" })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.blob();
    })
    .catch(async () => {
      // Fallback: try without cors mode (same-origin or opaque)
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

        const [h1, s1, l1] = rgbToHsl(colors[0].r, colors[0].g, colors[0].b);
        const primary = hslString(h1, Math.max(s1, 60), Math.min(Math.max(l1, 40), 60));

        let secondary: string;
        if (colors.length > 1) {
          const [h2, s2, l2] = rgbToHsl(colors[1].r, colors[1].g, colors[1].b);
          secondary = hslString(h2, Math.max(s2, 50), Math.min(Math.max(l2, 35), 55));
        } else {
          secondary = hslString((h1 + 180) % 360, Math.max(s1, 50), 40);
        }

        let accent: string;
        if (colors.length > 2) {
          const [h3, s3, l3] = rgbToHsl(colors[2].r, colors[2].g, colors[2].b);
          accent = hslString(h3, Math.min(s3, 20), Math.max(l3, 93));
        } else {
          accent = hslString(h1, 14, 93);
        }

        resolve({
          primary,
          primaryForeground: getContrastForeground(Math.min(Math.max(l1, 40), 60)),
          secondary,
          secondaryForeground: getContrastForeground(Math.min(Math.max(l1, 35), 55)),
          accent,
        });
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
