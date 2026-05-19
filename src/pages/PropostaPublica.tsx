/**
 * @deprecated Rota legada. Agora atua como redirect inteligente para /pl/:token.
 * Mantida apenas para compatibilidade de tokens históricos.
 */
import { useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      // Redirecionamento permanente (301-like no frontend) para a nova landing
      // Preserva query params (ex: ?view=simulacao)
      const queryString = searchParams.toString();
      const target = `/pl/${token}${queryString ? `?${queryString}` : ""}`;
      navigate(target, { replace: true });
    }
  }, [token, navigate, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse font-medium">
        Redirecionando para sua proposta...
      </p>
    </div>
  );
}
