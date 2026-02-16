import { useState, useEffect } from "react";
import {
  CreditCard, Eye, EyeOff, CheckCircle2, XCircle,
  Loader2, Shield, Zap, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui-kit";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function PaymentGatewayConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; balance?: number; error?: string } | null>(null);

  const [config, setConfig] = useState({
    id: null as string | null,
    provider: "asaas",
    api_key: "",
    environment: "sandbox" as "sandbox" | "production",
    is_active: false,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("payment_gateway_config")
        .select("*")
        .eq("provider", "asaas")
        .maybeSingle();

      if (data) {
        setConfig({
          id: data.id,
          provider: data.provider,
          api_key: data.api_key,
          environment: data.environment as "sandbox" | "production",
          is_active: data.is_active,
        });
      }
    } catch (e) {
      console.error("Error loading payment config:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.api_key.trim()) {
      toast({ title: "API Key obrigatória", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Get current user's tenant_id for insert
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      if (config.id) {
        const { error } = await supabase
          .from("payment_gateway_config")
          .update({
            api_key: config.api_key,
            environment: config.environment,
            is_active: config.is_active,
          })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("payment_gateway_config")
          .insert({
            tenant_id: profile.tenant_id,
            provider: "asaas",
            api_key: config.api_key,
            environment: config.environment,
            is_active: config.is_active,
          })
          .select("id")
          .single();

        if (error) throw error;
        setConfig((prev) => ({ ...prev, id: data.id }));
      }

      toast({ title: "Configuração salva com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.api_key.trim()) {
      toast({ title: "Insira a API Key primeiro", variant: "destructive" });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sessão expirada", variant: "destructive" });
        return;
      }

      const response = await supabase.functions.invoke("asaas-test-connection", {
        body: {
          api_key: config.api_key,
          environment: config.environment,
        },
      });

      if (response.error) throw response.error;
      setTestResult(response.data);

      if (response.data.success) {
        toast({ title: "Conexão estabelecida com sucesso! ✅" });
      } else {
        toast({
          title: "Falha na conexão",
          description: response.data.error,
          variant: "destructive",
        });
      }
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
      toast({ title: "Erro ao testar", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Smart Beacon */}
      {!config.api_key && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-4 py-4">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Conecte sua API do Asaas
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Libere a emissão de boletos e Pix direto nas propostas e recebimentos.
                Acesse{" "}
                <a
                  href="https://www.asaas.com/customerApiKeys/index"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  asaas.com → Integrações → API Keys
                </a>{" "}
                para obter sua chave.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gateway Provider Card */}
      <SectionCard
        icon={CreditCard}
        title="Gateway de Pagamento"
        description="Configure a integração com o Asaas para boletos e Pix"
      >
        <div className="space-y-5">
          {/* Provider selector (locked to Asaas for now) */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/30">
            <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center">
              <CreditCard className="h-4.5 w-4.5 text-success" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Asaas</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Recomendado • Boleto + Pix + Cartão
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Shield className="h-3 w-3" /> Seguro
            </Badge>
          </div>

          {/* Environment Switch */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/60">
            <div>
              <Label className="text-sm font-medium">Ambiente</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {config.environment === "sandbox"
                  ? "Modo de testes — sem cobranças reais"
                  : "Modo produção — cobranças reais"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-medium", config.environment === "sandbox" ? "text-warning" : "text-muted-foreground")}>
                Sandbox
              </span>
              <Switch
                checked={config.environment === "production"}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({
                    ...prev,
                    environment: checked ? "production" : "sandbox",
                  }))
                }
              />
              <span className={cn("text-xs font-medium", config.environment === "production" ? "text-success" : "text-muted-foreground")}>
                Produção
              </span>
            </div>
          </div>

          {config.environment === "production" && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-xs text-warning">
                Atenção: Cobranças reais serão geradas neste modo.
              </p>
            </div>
          )}

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="asaas-key" className="text-sm font-medium">
              API Key
            </Label>
            <div className="relative">
              <Input
                id="asaas-key"
                type={showKey ? "text" : "password"}
                placeholder="$aact_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                value={config.api_key}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, api_key: e.target.value }))
                }
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showKey ? "Ocultar" : "Mostrar"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Encontre em: Asaas → Minha Conta → Integrações → API Keys
            </p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Ativar integração</Label>
              <p className="text-xs text-muted-foreground">
                Habilita a emissão de cobranças via Asaas
              </p>
            </div>
            <Switch
              checked={config.is_active}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({ ...prev, is_active: checked }))
              }
            />
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                testResult.success
                  ? "bg-success/5 border-success/30"
                  : "bg-destructive/5 border-destructive/30"
              )}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {testResult.success ? "Conexão OK" : "Falha na conexão"}
                </p>
                {testResult.success && testResult.balance !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Saldo disponível: R$ {testResult.balance?.toFixed(2)}
                  </p>
                )}
                {testResult.error && (
                  <p className="text-xs text-destructive">{testResult.error}</p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar Configuração
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !config.api_key}
              className="gap-1.5"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Testar Conexão
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
