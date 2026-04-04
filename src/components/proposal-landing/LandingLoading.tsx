import { Sun, Loader2 } from "lucide-react";

export function LandingLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
      <Sun className="h-10 w-10 text-amber-400 animate-pulse" />
      <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      <p className="text-sm text-white/40">Carregando proposta...</p>
    </div>
  );
}
