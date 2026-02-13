import { useMemo } from "react";

export type LoaderTheme = "sun" | "lightning" | "gear" | "logo" | "custom";
export type LoaderAnimation = "pulse" | "spin" | "breathe" | "spin-pulse" | "none";

interface ThemeLoaderProps {
  theme?: LoaderTheme;
  animation?: LoaderAnimation;
  size?: "sm" | "md" | "lg";
  logoUrl?: string | null;
  customUrl?: string | null;
  className?: string;
}

const SIZES = { sm: 24, md: 40, lg: 64 };

export function ThemeLoader({
  theme = "sun",
  animation = "pulse",
  size = "md",
  logoUrl,
  customUrl,
  className = "",
}: ThemeLoaderProps) {
  const px = SIZES[size];

  const animClass = useMemo(() => {
    switch (animation) {
      case "spin": return "animate-[sun-spin_2s_linear_infinite]";
      case "breathe": return "animate-[sun-breathe_2s_ease-in-out_infinite]";
      case "spin-pulse": return "animate-[sun-spin-pulse_2.5s_ease-in-out_infinite]";
      case "none": return "";
      default: return "animate-[sun-pulse_1.5s_ease-in-out_infinite]";
    }
  }, [animation]);

  // Image-based loaders (logo / custom upload)
  if (theme === "logo" && logoUrl) {
    return (
      <div className={`inline-flex items-center justify-center ${className}`} role="status" aria-label="Carregando">
        <img
          src={logoUrl}
          alt="Loading"
          width={px}
          height={px}
          className={`object-contain ${animClass} motion-reduce:animate-none`}
          style={{ width: px, height: px }}
        />
      </div>
    );
  }

  if (theme === "custom" && customUrl) {
    return (
      <div className={`inline-flex items-center justify-center ${className}`} role="status" aria-label="Carregando">
        <img
          src={customUrl}
          alt="Loading"
          width={px}
          height={px}
          className={`object-contain ${animClass} motion-reduce:animate-none`}
          style={{ width: px, height: px }}
        />
      </div>
    );
  }

  // SVG-based loaders
  return (
    <div className={`inline-flex items-center justify-center ${className}`} role="status" aria-label="Carregando">
      <svg
        width={px}
        height={px}
        viewBox="0 0 48 48"
        fill="none"
        className={`${animClass} motion-reduce:animate-none`}
      >
        {theme === "sun" && <SunSVG />}
        {theme === "lightning" && <LightningSVG />}
        {theme === "gear" && <GearSVG />}
        {/* Fallback for logo/custom without URL */}
        {(theme === "logo" || theme === "custom") && <SunSVG />}
      </svg>
    </div>
  );
}

function SunSVG() {
  const rays = 8;
  return (
    <>
      <circle cx="24" cy="24" r="10" className="fill-primary" opacity="0.9" />
      <circle cx="24" cy="24" r="13" className="fill-primary/20" />
      {Array.from({ length: rays }).map((_, i) => {
        const angle = (i * 360) / rays;
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={24 + Math.cos(rad) * 16}
            y1={24 + Math.sin(rad) * 16}
            x2={24 + Math.cos(rad) * 21}
            y2={24 + Math.sin(rad) * 21}
            className="stroke-primary"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity={0.6 + (i % 2) * 0.3}
          />
        );
      })}
    </>
  );
}

function LightningSVG() {
  return (
    <>
      <circle cx="24" cy="24" r="20" className="fill-primary/10" />
      <path
        d="M26 8L14 26h9l-3 14 14-20h-9l1-12z"
        className="fill-primary"
        opacity="0.9"
      />
      <path
        d="M26 8L14 26h9l-3 14 14-20h-9l1-12z"
        className="stroke-primary"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function GearSVG() {
  return (
    <>
      <circle cx="24" cy="24" r="7" className="stroke-primary" strokeWidth="2.5" fill="none" />
      <circle cx="24" cy="24" r="3" className="fill-primary" opacity="0.6" />
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 45) * (Math.PI / 180);
        const innerR = 11;
        const outerR = 16;
        const halfTooth = 10 * (Math.PI / 180);
        return (
          <path
            key={i}
            d={`M ${24 + Math.cos(angle - halfTooth) * innerR} ${24 + Math.sin(angle - halfTooth) * innerR}
                L ${24 + Math.cos(angle - halfTooth) * outerR} ${24 + Math.sin(angle - halfTooth) * outerR}
                L ${24 + Math.cos(angle + halfTooth) * outerR} ${24 + Math.sin(angle + halfTooth) * outerR}
                L ${24 + Math.cos(angle + halfTooth) * innerR} ${24 + Math.sin(angle + halfTooth) * innerR} Z`}
            className="fill-primary"
            opacity="0.75"
          />
        );
      })}
    </>
  );
}

/** Compact preview for admin settings */
export function ThemeLoaderPreview({
  theme,
  animation,
  logoUrl,
  customUrl,
}: {
  theme: LoaderTheme;
  animation: LoaderAnimation;
  logoUrl?: string | null;
  customUrl?: string | null;
}) {
  return (
    <div className="flex items-center gap-6 py-3 px-4 rounded-lg bg-muted/30 border border-border/30">
      <ThemeLoader theme={theme} animation={animation} size="sm" logoUrl={logoUrl} customUrl={customUrl} />
      <ThemeLoader theme={theme} animation={animation} size="md" logoUrl={logoUrl} customUrl={customUrl} />
      <ThemeLoader theme={theme} animation={animation} size="lg" logoUrl={logoUrl} customUrl={customUrl} />
      <span className="text-xs text-muted-foreground ml-auto">Prévia dos tamanhos</span>
    </div>
  );
}
