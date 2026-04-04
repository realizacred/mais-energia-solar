import { AlertTriangle } from "lucide-react";

interface LandingErrorProps {
  message: string;
}

export function LandingError({ message }: LandingErrorProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Proposta Indisponível</h2>
        <p className="text-sm text-white/50">{message}</p>
      </div>
    </div>
  );
}
