import { useMemo } from "react";

export type LoaderTheme = "sun" | "lightning" | "gear" | "solar-panel" | "battery" | "leaf" | "orbit" | "logo" | "custom";

/** Primary motion */
export type LoaderMotion = "spin" | "spin360" | "pulse" | "breathe" | "none";

/** What happens after the primary motion */
export type LoaderFinish = "stop" | "pulse" | "shrink" | "grow" | "continue" | "none";

/**
 * Legacy single-value type kept for DB compatibility.
 * Internally maps to motion + finish.
 */
export type LoaderAnimation =
  | "pulse" | "spin" | "breathe" | "spin-pulse" | "spin-stop"
  | "spin360-stop" | "spin360-pulse" | "spin360-grow" | "spin360-shrink"
  | "none";

/** Build the combined animation key from motion + finish */
export function buildAnimationKey(motion: LoaderMotion, finish: LoaderFinish): LoaderAnimation {
  if (motion === "none") return "none";
  if (motion === "pulse") return "pulse";
  if (motion === "breathe") return "breathe";
  if (motion === "spin" && finish === "continue") return "spin";
  if (motion === "spin" && finish === "pulse") return "spin-pulse";
  if (motion === "spin" && finish === "stop") return "spin-stop";
  if (motion === "spin360" && finish === "stop") return "spin360-stop";
  if (motion === "spin360" && finish === "pulse") return "spin360-pulse";
  if (motion === "spin360" && finish === "grow") return "spin360-grow";
  if (motion === "spin360" && finish === "shrink") return "spin360-shrink";
  // Default fallback
  if (motion === "spin") return "spin";
  if (motion === "spin360") return "spin360-stop";
  return "pulse";
}

/** Parse a stored animation key back to motion + finish */
export function parseAnimationKey(key: LoaderAnimation): { motion: LoaderMotion; finish: LoaderFinish } {
  switch (key) {
    case "none": return { motion: "none", finish: "none" };
    case "pulse": return { motion: "pulse", finish: "continue" };
    case "breathe": return { motion: "breathe", finish: "continue" };
    case "spin": return { motion: "spin", finish: "continue" };
    case "spin-pulse": return { motion: "spin", finish: "pulse" };
    case "spin-stop": return { motion: "spin", finish: "stop" };
    case "spin360-stop": return { motion: "spin360", finish: "stop" };
    case "spin360-pulse": return { motion: "spin360", finish: "pulse" };
    case "spin360-grow": return { motion: "spin360", finish: "grow" };
    case "spin360-shrink": return { motion: "spin360", finish: "shrink" };
    default: return { motion: "pulse", finish: "continue" };
  }
}

interface ThemeLoaderProps {
  theme?: LoaderTheme;
  animation?: LoaderAnimation;
  size?: "sm" | "md" | "lg";
  logoUrl?: string | null;
  customUrl?: string | null;
  className?: string;
}

const SIZES = { sm: 24, md: 40, lg: 64 };

const ANIM_CLASSES: Record<LoaderAnimation, string> = {
  "pulse": "animate-[sun-pulse_1.5s_ease-in-out_infinite]",
  "spin": "animate-[sun-spin_2s_linear_infinite]",
  "breathe": "animate-[sun-breathe_2s_ease-in-out_infinite]",
  "spin-pulse": "animate-[sun-spin-pulse_2.5s_ease-in-out_infinite]",
  "spin-stop": "animate-[sun-spin-stop_2s_ease-in-out_forwards]",
  "spin360-stop": "animate-[sun-spin360-stop_1.5s_ease-in-out_forwards]",
  "spin360-pulse": "animate-[sun-spin360-pulse_2.5s_ease-in-out_infinite]",
  "spin360-grow": "animate-[sun-spin360-grow_2s_ease-in-out_forwards]",
  "spin360-shrink": "animate-[sun-spin360-shrink_2s_ease-in-out_forwards]",
  "none": "",
};

export function ThemeLoader({
  theme = "sun",
  animation = "pulse",
  size = "md",
  logoUrl,
  customUrl,
  className = "",
}: ThemeLoaderProps) {
  const px = SIZES[size];
  const animClass = ANIM_CLASSES[animation] || ANIM_CLASSES.pulse;

  // Image-based loaders (logo / custom upload)
  if (theme === "logo") {
    if (!logoUrl) {
      // Still loading brand settings — show empty placeholder to avoid flash of fallback SVG
      return (
        <div className={`inline-flex items-center justify-center ${className}`} role="status" aria-label="Carregando"
          style={{ width: px, height: px }} />
      );
    }
    return (
      <div className={`inline-flex items-center justify-center ${className}`} role="status" aria-label="Carregando">
        <img src={logoUrl} alt="Loading" width={px} height={px}
          className={`object-contain ${animClass} motion-reduce:animate-none`}
          style={{ width: px, height: px }} />
      </div>
    );
  }

  if (theme === "custom" && customUrl) {
    return (
      <div className={`inline-flex items-center justify-center ${className}`} role="status" aria-label="Carregando">
        <img src={customUrl} alt="Loading" width={px} height={px}
          className={`object-contain ${animClass} motion-reduce:animate-none`}
          style={{ width: px, height: px }} />
      </div>
    );
  }

  // SVG-based loaders
  return (
    <div className={`inline-flex items-center justify-center ${className}`} role="status" aria-label="Carregando">
      <svg width={px} height={px} viewBox="0 0 48 48" fill="none"
        className={`${animClass} motion-reduce:animate-none`}>
        {theme === "sun" && <SunSVG />}
        {theme === "lightning" && <LightningSVG />}
        {theme === "gear" && <GearSVG />}
        {theme === "solar-panel" && <SolarPanelSVG />}
        {theme === "battery" && <BatterySVG />}
        {theme === "leaf" && <LeafSVG />}
        {theme === "orbit" && <OrbitSVG />}
        {theme === "custom" && <SunSVG />}
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
          <line key={i}
            x1={24 + Math.cos(rad) * 16} y1={24 + Math.sin(rad) * 16}
            x2={24 + Math.cos(rad) * 21} y2={24 + Math.sin(rad) * 21}
            className="stroke-primary" strokeWidth="2.5" strokeLinecap="round"
            opacity={0.6 + (i % 2) * 0.3} />
        );
      })}
    </>
  );
}

function LightningSVG() {
  return (
    <>
      <circle cx="24" cy="24" r="20" className="fill-primary/10" />
      <path d="M26 8L14 26h9l-3 14 14-20h-9l1-12z" className="fill-primary" opacity="0.9" />
      <path d="M26 8L14 26h9l-3 14 14-20h-9l1-12z" className="stroke-primary" strokeWidth="1" fill="none" opacity="0.4" />
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
          <path key={i}
            d={`M ${24 + Math.cos(angle - halfTooth) * innerR} ${24 + Math.sin(angle - halfTooth) * innerR}
                L ${24 + Math.cos(angle - halfTooth) * outerR} ${24 + Math.sin(angle - halfTooth) * outerR}
                L ${24 + Math.cos(angle + halfTooth) * outerR} ${24 + Math.sin(angle + halfTooth) * outerR}
                L ${24 + Math.cos(angle + halfTooth) * innerR} ${24 + Math.sin(angle + halfTooth) * innerR} Z`}
            className="fill-primary" opacity="0.75" />
        );
      })}
    </>
  );
}

/** Solar Panel — painel fotovoltaico estilizado */
function SolarPanelSVG() {
  return (
    <>
      {/* Panel body */}
      <rect x="8" y="12" width="32" height="24" rx="2" className="fill-primary/15 stroke-primary" strokeWidth="1.5" />
      {/* Grid lines */}
      <line x1="8" y1="20" x2="40" y2="20" className="stroke-primary" strokeWidth="0.8" opacity="0.5" />
      <line x1="8" y1="28" x2="40" y2="28" className="stroke-primary" strokeWidth="0.8" opacity="0.5" />
      <line x1="18.7" y1="12" x2="18.7" y2="36" className="stroke-primary" strokeWidth="0.8" opacity="0.5" />
      <line x1="29.3" y1="12" x2="29.3" y2="36" className="stroke-primary" strokeWidth="0.8" opacity="0.5" />
      {/* Cells fill */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect key={`${row}-${col}`}
            x={9 + col * 10.7} y={13 + row * 8}
            width="9.7" height="7" rx="0.5"
            className="fill-primary" opacity={0.25 + row * 0.15 + col * 0.05} />
        ))
      )}
      {/* Stand */}
      <line x1="24" y1="36" x2="24" y2="42" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="42" x2="30" y2="42" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
      {/* Sun reflection sparkle */}
      <circle cx="14" cy="17" r="1.5" className="fill-primary" opacity="0.7">
        <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2s" repeatCount="indefinite" />
      </circle>
    </>
  );
}

/** Battery — bateria com nível de carga animado */
function BatterySVG() {
  return (
    <>
      {/* Battery body */}
      <rect x="12" y="10" width="24" height="30" rx="3" className="stroke-primary" strokeWidth="2" fill="none" />
      {/* Battery cap */}
      <rect x="18" y="6" width="12" height="5" rx="1.5" className="fill-primary" opacity="0.6" />
      {/* Charge levels — animated */}
      <rect x="15" y="32" width="18" height="5" rx="1" className="fill-primary" opacity="0.9">
        <animate attributeName="opacity" values="0.9;0.9;0.9" dur="2s" repeatCount="indefinite" />
      </rect>
      <rect x="15" y="25" width="18" height="5" rx="1" className="fill-primary" opacity="0.6">
        <animate attributeName="opacity" values="0;0.6;0.6" dur="2s" repeatCount="indefinite" />
      </rect>
      <rect x="15" y="18" width="18" height="5" rx="1" className="fill-primary" opacity="0.3">
        <animate attributeName="opacity" values="0;0;0.3" dur="2s" repeatCount="indefinite" />
      </rect>
      {/* Lightning bolt inside */}
      <path d="M26 14l-4 8h4l-2 8 6-10h-4l2-6z" className="fill-primary/30" />
    </>
  );
}

/** Leaf — folha de sustentabilidade / energia limpa */
function LeafSVG() {
  return (
    <>
      {/* Leaf shape */}
      <path
        d="M24 6 C12 14, 8 28, 24 42 C40 28, 36 14, 24 6Z"
        className="fill-primary/15 stroke-primary" strokeWidth="1.5"
      />
      {/* Center vein */}
      <path d="M24 12 Q24 24 24 38" className="stroke-primary" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Side veins */}
      <path d="M24 18 Q18 20 14 24" className="stroke-primary" strokeWidth="1" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M24 18 Q30 20 34 24" className="stroke-primary" strokeWidth="1" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M24 26 Q17 28 13 32" className="stroke-primary" strokeWidth="1" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M24 26 Q31 28 35 32" className="stroke-primary" strokeWidth="1" fill="none" opacity="0.5" strokeLinecap="round" />
      {/* Glow */}
      <circle cx="24" cy="24" r="4" className="fill-primary" opacity="0.2">
        <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.2;0.4;0.2" dur="2s" repeatCount="indefinite" />
      </circle>
    </>
  );
}

/** Orbit — elétrons orbitando um núcleo (átomo energético) */
function OrbitSVG() {
  return (
    <>
      {/* Nucleus */}
      <circle cx="24" cy="24" r="5" className="fill-primary" opacity="0.85" />
      <circle cx="24" cy="24" r="7" className="fill-primary/10" />
      {/* Orbit rings */}
      <ellipse cx="24" cy="24" rx="18" ry="8" className="stroke-primary/40" strokeWidth="1" fill="none"
        transform="rotate(0 24 24)" />
      <ellipse cx="24" cy="24" rx="18" ry="8" className="stroke-primary/40" strokeWidth="1" fill="none"
        transform="rotate(60 24 24)" />
      <ellipse cx="24" cy="24" rx="18" ry="8" className="stroke-primary/40" strokeWidth="1" fill="none"
        transform="rotate(120 24 24)" />
      {/* Electron 1 */}
      <circle cx="42" cy="24" r="2.5" className="fill-primary" opacity="0.9">
        <animateTransform attributeName="transform" type="rotate"
          values="0 24 24;360 24 24" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Electron 2 */}
      <circle cx="6" cy="24" r="2" className="fill-primary" opacity="0.7">
        <animateTransform attributeName="transform" type="rotate"
          from="120 24 24" to="480 24 24" dur="3s" repeatCount="indefinite" />
      </circle>
      {/* Electron 3 */}
      <circle cx="33" cy="15" r="1.8" className="fill-primary" opacity="0.6">
        <animateTransform attributeName="transform" type="rotate"
          from="240 24 24" to="600 24 24" dur="2.5s" repeatCount="indefinite" />
      </circle>
    </>
  );
}

/** Compact preview for admin settings */
export function ThemeLoaderPreview({
  theme, animation, logoUrl, customUrl,
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
