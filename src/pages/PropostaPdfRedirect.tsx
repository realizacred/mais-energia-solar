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
 * Registra `pdf_open` em proposal_events ANTES do redirect, porque
 * `window.location.replace` aborta requests em voo. Tracking é
 * best-effort (já tem try/catch interno) e tem timeout máximo de 1500ms
 * para nunca travar a entrega do PDF.
 */
export default function PropostaPdfRedirect() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!token) return;
    const src = searchParams.get("src") || "copy_pdf";
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/proposal-pdf-serve?token=${token}`;

    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      window.location.replace(functionUrl);
    };

    // Aguarda a RPC concluir (ou timeout de 1500ms) antes de redirecionar.
    const trackingPromise = registerProposalEvent(token, "pdf_open", src, {
      referrer: document.referrer || null,
    });
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(resolve, 1500),
    );

    Promise.race([trackingPromise, timeoutPromise]).finally(go);

    return () => {
      cancelled = true;
    };
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
