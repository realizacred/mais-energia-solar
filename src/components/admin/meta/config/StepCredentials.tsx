import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Eye, EyeOff, Loader2, Save, Copy, ShieldCheck, Users, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { META_KEYS, type MetaConfigMap, useSaveMetaKey } from "./useMetaFbConfigs";
import { supabase } from "@/integrations/supabase/client";

interface StepCredentialsProps {
  configs: MetaConfigMap;
  onNext: () => void;
}

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  description: string;
  isSecret: boolean;
}

const FIELDS: FieldDef[] = [
  { key: META_KEYS.appId, label: "ID do Aplicativo", placeholder: "Ex: 744200091640333", description: "Encontrado em Configurações → Básico", isSecret: false },
  { key: META_KEYS.appSecret, label: "Chave Secreta do Aplicativo", placeholder: "Cole a chave secreta...", description: "Usado para validar webhooks", isSecret: true },
  { key: META_KEYS.accessToken, label: "Token de Acesso", placeholder: "Cole o token (começa com EAA...)", description: "Gere no Graph API Explorer", isSecret: true },
  { key: META_KEYS.verifyToken, label: "Token de Verificação", placeholder: "Ex: minha-chave-2026", description: "Use a mesma frase no webhook do Meta", isSecret: false },
];

export function StepCredentials({ configs, onNext }: StepCredentialsProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [diagStatus, setDiagStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [diagError, setDiagError] = useState("");
  const saveMutation = useSaveMetaKey();

  const allConfigured = FIELDS.every(f => configs[f.key]?.api_key);

  const handleSave = async (key: string) => {
    const val = values[key]?.trim();
    if (!val) return;
    await saveMutation.mutateAsync({ serviceKey: key, apiKey: val });
    setValues(prev => ({ ...prev, [key]: "" }));
    toast.success("Chave salva ✅");
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
      toast.success("Token válido ✅");
      setTimeout(() => onNext(), 800);
    } catch (err: any) {
      setDiagStatus("error");
      setDiagError(err.message || "Erro inesperado");
    }
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-lead-webhook`;

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
            Validar conexão
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
