import { CheckCircle2, XCircle, Sun } from "lucide-react";

interface LandingDecisionDoneProps {
  decision: "aceita" | "recusada";
  brand: { logo_url: string | null; logo_white_url: string | null } | null;
  tenant: { nome: string | null } | null;
}

export function LandingDecisionDone({ decision, brand, tenant }: LandingDecisionDoneProps) {
  const isAccepted = decision === "aceita";
  const logoUrl = brand?.logo_white_url || brand?.logo_url;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {logoUrl && (
          <img src={logoUrl} alt={tenant?.nome || ""} className="h-12 mx-auto object-contain opacity-60" />
        )}

        {isAccepted ? (
          <>
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Proposta Aceita!</h2>
            <p className="text-sm text-white/50">
              Obrigado! Sua aceitação foi registrada. A equipe comercial entrará em contato em breve.
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Proposta Recusada</h2>
            <p className="text-sm text-white/50">
              Sua resposta foi registrada. A equipe comercial será notificada.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
