const SunIcon = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Rays */}
    {[...Array(12)].map((_, i) => (
      <line
        key={i}
        x1="60"
        y1="8"
        x2="60"
        y2="22"
        stroke="hsl(38 92% 50%)"
        strokeWidth="3"
        strokeLinecap="round"
        transform={`rotate(${i * 30} 60 60)`}
        opacity={0.6 + (i % 3) * 0.15}
      />
    ))}
    {/* Sun circle */}
    <circle cx="60" cy="60" r="28" fill="url(#sunGradient)" />
    <defs>
      <radialGradient id="sunGradient" cx="0.4" cy="0.35">
        <stop offset="0%" stopColor="hsl(45 100% 70%)" />
        <stop offset="100%" stopColor="hsl(38 92% 50%)" />
      </radialGradient>
    </defs>
  </svg>
);

export default SunIcon;
