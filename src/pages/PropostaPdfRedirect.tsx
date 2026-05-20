import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { registerProposalEvent } from "@/services/proposal/registerProposalEvent";

/**
 * PropostaPdfRedirect.tsx
 *
 * Rota: /p/pdf/:token
 *
 * Atua como proxy para a Edge Function de PDF masking.
 * Antes de redirecionar, registra o evento `pdf_open` em proposal_events
 * (best-effort, não bloqueia o redirect).
 */
export default function PropostaPdfRedirect() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!token) return;
    const src = searchParams.get("src") || "direct";

    // Fire-and-forget: tracking não pode atrasar a entrega do PDF.
    void registerProposalEvent(token, "pdf_open", src, {
      referrer: document.referrer || null,
    });

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/proposal-pdf-serve?token=${token}`;
    // Pequeno delay para o INSERT ter chance de sair antes do unload.
    const t = setTimeout(() => window.location.replace(functionUrl), 120);
    return () => clearTimeout(t);
  }, [token, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse font-medium">
        Carregando PDF da proposta...
      </p>
    </div>
  );
}
