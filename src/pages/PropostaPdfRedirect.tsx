import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * PropostaPdfRedirect.tsx
 * 
 * Rota: /p/pdf/:token
 * 
 * Atua como proxy para a Edge Function de PDF masking.
 * Redireciona o navegador para o endpoint que serve o stream do PDF.
 */
export default function PropostaPdfRedirect() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    if (token) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/proposal-pdf-serve?token=${token}`;
      
      // Redireciona para o stream do PDF
      window.location.replace(functionUrl);
    }
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse font-medium">
        Carregando PDF da proposta...
      </p>
    </div>
  );
}
