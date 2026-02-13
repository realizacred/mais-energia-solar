import { useMemo } from "react";

interface SunLoaderProps {
  size?: "sm" | "md" | "lg";
  style?: "pulse" | "spin" | "breathe";
  className?: string;
}

const SIZES = { sm: 24, md: 40, lg: 64 };

export function SunLoader({ size = "md", style = "pulse", className = "" }: SunLoaderProps) {
  const px = SIZES[size];
  const rays = 8;

  const animationClass = useMemo(() => {
    switch (style) {
      case "spin": return "animate-[sun-spin_2s_linear_infinite]";
      case "breathe": return "animate-[sun-breathe_2s_ease-in-out_infinite]";
      default: return "animate-[sun-pulse_1.5s_ease-in-out_infinite]";
    }
  }, [style]);

  return (
    <div className={`inline-flex items-center justify-center ${className}`} role="status" aria-label="Carregando">
      <svg
        width={px}
        height={px}
        viewBox="0 0 48 48"
        fill="none"
        className={`${animationClass} motion-reduce:animate-none`}
      >
        {/* Sun body */}
        <circle
          cx="24"
          cy="24"
          r="10"
          className="fill-primary"
          opacity="0.9"
        />
        {/* Inner glow */}
        <circle
          cx="24"
          cy="24"
          r="13"
          className="fill-primary/20"
        />
        {/* Rays */}
        {Array.from({ length: rays }).map((_, i) => {
          const angle = (i * 360) / rays;
          const rad = (angle * Math.PI) / 180;
          const x1 = 24 + Math.cos(rad) * 16;
          const y1 = 24 + Math.sin(rad) * 16;
          const x2 = 24 + Math.cos(rad) * 21;
          const y2 = 24 + Math.sin(rad) * 21;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className="stroke-primary"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity={0.6 + (i % 2) * 0.3}
            />
          );
        })}
      </svg>
    </div>
  );
}
