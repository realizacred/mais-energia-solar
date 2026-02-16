import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

/**
 * Frontend proxy for Google OAuth callback.
 * Google redirects here with ?code=xxx&state=yyy.
 * This page forwards everything to the Edge Function for token exchange,
 * then closes the popup or redirects to the integrations page.
 */
export default function OAuthGoogleCallback() {
  const [searchParams] = useSearchParams();
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error || !code) {
      // Close popup or redirect on error
      if (window.opener) {
        window.close();
      } else {
        window.location.href = "/admin/integracoes?error=" + (error || "missing_code");
      }
      return;
    }

    // Call edge function with the code via POST (server-side token exchange)
    const exchangeToken = async () => {
      try {
        const fnUrl = `${(supabase as any).supabaseUrl}/functions/v1/google-calendar-integration?action=callback-proxy`;
        const res = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: (supabase as any).supabaseKey,
          },
          body: JSON.stringify({
            code,
            state,
            redirect_uri: `${window.location.origin}/oauth/google/callback`,
          }),
        });

        const data = await res.json();

        if (window.opener) {
          window.close();
        } else {
          window.location.href = data.success
            ? "/admin/integracoes?connected=true"
            : "/admin/integracoes?error=" + (data.error || "unknown");
        }
      } catch {
        if (window.opener) {
          window.close();
        } else {
          window.location.href = "/admin/integracoes?error=exchange_failed";
        }
      }
    };

    exchangeToken();
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <LoadingSpinner />
        <p className="text-muted-foreground">Processando autenticação Google...</p>
      </div>
    </div>
  );
}
