import { Sun } from "lucide-react";

interface LandingFooterProps {
  empresaNome: string | null | undefined;
  logoUrl: string | null | undefined;
}

export function LandingFooter({ empresaNome, logoUrl }: LandingFooterProps) {
  return (
    <footer className="py-8 px-4 bg-[#060608] border-t border-white/5">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
        {logoUrl ? (
          <img src={logoUrl} alt={empresaNome || ""} className="h-8 opacity-40" />
        ) : empresaNome ? (
          <div className="flex items-center gap-2 opacity-40">
            <Sun className="h-5 w-5" />
            <span className="text-sm font-semibold">{empresaNome}</span>
          </div>
        ) : null}
        <p className="text-xs text-white/20">
          © {new Date().getFullYear()} {empresaNome || "Energia Solar"}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
