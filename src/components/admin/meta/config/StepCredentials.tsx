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

      {/* Credential fields */}
      <div className="space-y-4">
        {FIELDS.map((field) => {
          const config = configs[field.key];
          const maskedKey = config?.api_key
            ? config.api_key.slice(0, 6) + "••••••" + config.api_key.slice(-4)
            : null;

          return (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-sm font-medium">{field.label}</Label>
              <p className="text-[11px] text-muted-foreground">{field.description}</p>

              {maskedKey && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  <span className="text-xs font-mono flex-1 truncate">
                    {showKeys[field.key] ? config?.api_key : maskedKey}
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowKeys(p => ({ ...p, [field.key]: !p[field.key] }))}>
                    {showKeys[field.key] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  type={field.isSecret ? "password" : "text"}
                  placeholder={maskedKey ? "Cole para substituir..." : field.placeholder}
                  value={values[field.key] || ""}
                  onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="text-sm"
                />
                <Button
                  onClick={() => handleSave(field.key)}
                  disabled={!values[field.key]?.trim() || saveMutation.isPending}
                  size="sm"
                  variant="outline"
                >
                  {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Webhook URL */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">URL do Webhook</Label>
        <p className="text-[11px] text-muted-foreground">Cole esta URL no painel do Meta → Webhooks → Página → leadgen</p>
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border">
          <code className="text-[11px] break-all flex-1 select-all">{webhookUrl}</code>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL copiada!"); }}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

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
        <Button onClick={handleValidateAndAdvance} disabled={!allConfigured || diagStatus === "loading"}>
          {diagStatus === "loading" && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Conectar e validar
        </Button>
      </div>
    </div>
  );
}
