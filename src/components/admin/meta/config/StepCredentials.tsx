import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, ShieldCheck, Users, BarChart3, Facebook } from "lucide-react";
import { toast } from "sonner";
import { META_KEYS, type MetaConfigMap } from "./useMetaFbConfigs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface StepCredentialsProps {
  configs: MetaConfigMap;
  onNext: () => void;
}

export function StepCredentials({ configs, onNext }: StepCredentialsProps) {
  const [diagStatus, setDiagStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [diagError, setDiagError] = useState("");
  
  const { data: profile } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("tenant_id").eq("user_id", user.id).single();
      return data;
    }
  });

  const appId = configs[META_KEYS.appId]?.api_key || "1550819325829627";
  const isConnected = !!configs[META_KEYS.accessToken]?.api_key;

  const handleConnect = () => {
    if (!profile?.tenant_id) {
      toast.error("Tenant não encontrado");
      return;
    }

    const SUPABASE_URL = "https://bguhckqkpnziykpbwbeu.supabase.co";
    const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/facebook-oauth-callback`;
    const SCOPES = [
      "ads_read",
      "leads_retrieval",
      "pages_read_engagement",
      "pages_manage_metadata",
      "pages_show_list",
      "ads_management"
    ].join(",");

    const fbUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPES}&state=${profile.tenant_id}`;
    
    window.location.href = fbUrl;
  };

  const handleValidateAndAdvance = async () => {
    setDiagStatus("loading");
    setDiagError("");
    try {
      const resp = await supabase.functions.invoke("meta-facebook-diagnostics", { body: {} });
      const body = resp.data as any;
      if (resp.error || body?.error) {
        setDiagStatus("error");
        setDiagError(body?.error || body?.details || "Erro ao validar token");
        return;
      }
      setDiagStatus("success");
      toast.success("Conexão validada ✅");
      setTimeout(() => onNext(), 800);
    } catch (err: any) {
      setDiagStatus("error");
      setDiagError(err.message || "Erro inesperado");
    }
  };

  return (
    <div className="space-y-6">
      {/* Benefits */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Users, text: "Leads de formulários (Lead Ads)" },
          { icon: BarChart3, text: "Informações de campanhas" },
          { icon: ShieldCheck, text: "Dados do contato automáticos" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 p-3 rounded-lg bg-success/5 border border-success/20">
            <Icon className="h-4 w-4 text-success shrink-0" />
            <span className="text-xs text-foreground">{text}</span>
          </div>
        ))}
      </div>

      {/* OAuth Button Area */}
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-muted/30 space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Facebook className="h-8 w-8 text-primary" />
        </div>
        
        <div className="text-center space-y-2 max-w-sm">
          <h3 className="font-bold text-lg">Facebook Ads</h3>
          <p className="text-sm text-muted-foreground">
            Conecte sua conta do Facebook para receber leads e métricas de anúncios automaticamente.
          </p>
        </div>

        <Button 
          size="lg" 
          onClick={handleConnect} 
          className="bg-[#1877F2] hover:bg-[#166fe5] text-white px-8 h-12 gap-2"
          disabled={!profile}
        >
          <Facebook className="h-5 w-5 fill-current" />
          Conectar com Facebook
        </Button>

        <div className="flex flex-col gap-1.5 items-center text-[11px] text-muted-foreground pt-2">
          <span className="flex items-center gap-1.5">✓ Seguro — usamos OAuth oficial</span>
          <span className="flex items-center gap-1.5">✓ Você controla as permissões</span>
          <span className="flex items-center gap-1.5">✓ Desconecte a qualquer momento</span>
        </div>
      </div>

      {isConnected && (
        <div className="p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-success">Facebook Conectado</p>
            <p className="text-xs text-success/80">Sua conta está sincronizada e ativa.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleValidateAndAdvance}>
            {diagStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Validar conexão"}
          </Button>
        </div>
      )}

      {/* Validation status */}
      {diagStatus === "error" && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          ⚠️ {diagError}
        </div>
      )}
      {diagStatus === "success" && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm text-success">
          ✓ Token válido! Avançando...
        </div>
      )}

      {/* Action */}
      <div className="flex justify-end pt-2">
        <Button onClick={() => onNext()} disabled={!isConnected || diagStatus === "loading"}>
          Avançar para Páginas
        </Button>
      </div>
    </div>
  );
}
