import { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useGoogleContactsIntegration } from "@/hooks/useGoogleContactsIntegration";

export default function GoogleContactsCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { callbackProxy } = useGoogleContactsIntegration();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error || !code || !state) {
      navigate("/admin/integracoes?gc_error=" + (error || "missing_code"), { replace: true });
      return;
    }

    callbackProxy({ code, state }, {
      onSuccess: () => navigate("/admin/integracoes?gc_connected=true", { replace: true }),
      onError: () => navigate("/admin/integracoes?gc_error=callback_failed", { replace: true }),
    } as any);
  }, [searchParams, navigate, callbackProxy]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Conectando Google Contatos...</p>
      </div>
    </div>
  );
}
