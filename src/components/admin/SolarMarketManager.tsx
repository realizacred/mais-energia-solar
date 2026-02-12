import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw, Settings, Plug, Zap, CheckCircle2,
  AlertTriangle, Loader2, Play, Copy,
  FolderOpen, Link2, Shield, ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SolarMarketDataView, SolarMarketLinksView, SolarMarketAuditView, SyncProgressTracker } from "@/components/admin/solarmarket";

interface SmConfig {
  id: string;
  enabled: boolean;
  base_url: string;
  auth_mode: string;
  api_token: string | null;
  auth_email: string | null;
  auth_password_encrypted: string | null;
  webhook_secret: string | null;
  site_url: string | null;
  last_token_expires_at: string | null;
}

export function SolarMarketManager() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SmConfig | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);

  // Form state
  const [formAuthMode, setFormAuthMode] = useState("token");
  const [formApiToken, setFormApiToken] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("https://business.solarmarket.com.br/api/v2");
  const [formSiteUrl, setFormSiteUrl] = useState("");
  const [formWebhookSecret, setFormWebhookSecret] = useState("");
  const [formEnabled, setFormEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delta sync
  const [deltaType, setDeltaType] = useState("client");
  const [deltaId, setDeltaId] = useState("");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("solar_market_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data as SmConfig);
        setFormAuthMode(data.auth_mode || "token");
        setFormApiToken("");
        setFormEmail(data.auth_email || "");
        setFormPassword("");
        setFormBaseUrl(data.base_url || "https://business.solarmarket.com.br/api/v2");
        setFormSiteUrl(data.site_url || "");
        setFormWebhookSecret(data.webhook_secret || "");
        setFormEnabled(data.enabled);
      }
    } catch (err: any) {
      console.error("Error fetching SM config:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        enabled: formEnabled,
        base_url: formBaseUrl,
        auth_mode: formAuthMode,
        site_url: formSiteUrl || null,
        webhook_secret: formWebhookSecret || null,
      };

      if (formAuthMode === "token" && formApiToken) {
        payload.api_token = formApiToken;
      }

      if (formAuthMode === "credentials") {
        payload.auth_email = formEmail;
        if (formPassword) {
          payload.auth_password_encrypted = formPassword;
        }
      }

      if (config?.id) {
        const { error } = await supabase
          .from("solar_market_config")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("solar_market_config")
          .insert(payload);
        if (error) throw error;
      }

      toast.success("Configuração salva com sucesso");
      fetchConfig();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("solar-market-auth");

      if (error) {
        const { parseInvokeError } = await import("@/lib/supabaseFunctionError");
        const parsed = await parseInvokeError(error);
        toast.error(`Falha na conexão: ${parsed.message}`);
        return;
      }

      if (data?.error) {
        toast.error(`Falha na conexão: ${data.error}`);
      } else if (data?.access_token) {
        toast.success("Conexão com SolarMarket bem-sucedida! ✅ Token obtido com sucesso.");
      } else {
        toast.success(data?.message || "Conexão com SolarMarket bem-sucedida! ✅");
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const runFullSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("solar-market-sync", {
        body: { mode: "full", source: "manual" },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(`Erro na sincronização: ${data.error}`);
      } else {
        const c = data?.counts || {};
        toast.success(
          `Sincronização iniciada! ${c.clients_synced || 0} clientes processados na fase inicial.`
        );
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const runDeltaSync = async () => {
    if (!deltaId) {
      toast.error("Informe o ID do SolarMarket");
      return;
    }

    setSyncing(true);
    try {
      const delta: Record<string, unknown> = { type: deltaType };
      if (deltaType === "client") delta.sm_client_id = Number(deltaId);
      if (deltaType === "project") delta.sm_project_id = Number(deltaId);
      if (deltaType === "proposal") delta.sm_proposal_id = Number(deltaId);

      const { data, error } = await supabase.functions.invoke("solar-market-sync", {
        body: { mode: "delta", source: "manual", delta },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(`Erro: ${data.error}`);
      } else {
        toast.success("Delta sync concluído!");
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const webhookUrl = `https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/solar-market-webhook`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dados" className="gap-1.5">
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Dados</span>
          </TabsTrigger>
          <TabsTrigger value="vinculos" className="gap-1.5">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Vínculos</span>
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Auditoria</span>
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Sync</span>
          </TabsTrigger>
          <TabsTrigger value="delta" className="gap-1.5">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Delta</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Dados Tab ──────────────────────────── */}
        <TabsContent value="dados" className="mt-4">
          <SolarMarketDataView />
        </TabsContent>

        {/* ── Vínculos Tab ───────────────────────── */}
        <TabsContent value="vinculos" className="mt-4">
          <SolarMarketLinksView />
        </TabsContent>

        {/* ── Auditoria Tab ──────────────────────── */}
        <TabsContent value="auditoria" className="mt-4">
          <SolarMarketAuditView />
        </TabsContent>

        {/* ── Full Sync Tab ──────────────────────── */}
        <TabsContent value="sync" className="space-y-4 mt-4">
          {/* Live Progress Tracker */}
          <SyncProgressTracker />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                Sincronização Completa
              </CardTitle>
              <CardDescription>
                Busca todos os clientes, projetos e propostas do SolarMarket e sincroniza com o sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border bg-warning/10 border-warning/30">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Atenção</p>
                    <p className="text-muted-foreground">
                      A sincronização completa pode levar vários minutos dependendo do volume de dados.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                size="lg"
                onClick={runFullSync}
                disabled={syncing || !config?.enabled}
                className="w-full sm:w-auto"
              >
                {syncing ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Play className="mr-2 h-5 w-5" />
                )}
                {syncing ? "Sincronizando..." : "Iniciar Sincronização Completa"}
              </Button>

              {!config?.enabled && (
                <p className="text-sm text-destructive">Ative a integração na aba Configuração para sincronizar.</p>
              )}

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">URL para Full Sync (POST)</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/solar-market-sync`}
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={() => {
                    navigator.clipboard.writeText(`https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/solar-market-sync`);
                    toast.success("URL copiada!");
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto">
{`POST /functions/v1/solar-market-sync
Content-Type: application/json

{
  "mode": "full",
  "source": "cron"
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Delta Sync Tab ─────────────────────── */}
        <TabsContent value="delta" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Sincronização Incremental (Delta)
              </CardTitle>
              <CardDescription>
                Sincronize um item específico por ID do SolarMarket.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={deltaType} onValueChange={setDeltaType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Cliente</SelectItem>
                      <SelectItem value="project">Projeto</SelectItem>
                      <SelectItem value="proposal">Proposta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ID do SolarMarket</Label>
                  <Input
                    placeholder="Ex: 12345"
                    value={deltaId}
                    onChange={(e) => setDeltaId(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={runDeltaSync}
                    disabled={syncing || !config?.enabled || !deltaId}
                    className="w-full"
                  >
                    {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                    Sincronizar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Config Tab ─────────────────────────── */}
        <TabsContent value="config" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5 text-primary" />
                Credenciais SolarMarket
              </CardTitle>
              <CardDescription>
                Configure as credenciais de acesso à API do SolarMarket.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Integração Ativa</Label>
                  <p className="text-sm text-muted-foreground">Habilite para permitir sincronização</p>
                </div>
                <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Modo de Autenticação</Label>
                <Select value={formAuthMode} onValueChange={setFormAuthMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="token">Token direto (Bearer)</SelectItem>
                    <SelectItem value="credentials">E-mail e Senha</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formAuthMode === "token" ? (
                <div className="space-y-2">
                  <Label htmlFor="sm-token">Token da API SolarMarket</Label>
                  <Input
                    id="sm-token"
                    type="password"
                    placeholder={config?.api_token ? "Token configurado ✓ (deixe vazio para manter)" : "Cole o token aqui"}
                    value={formApiToken}
                    onChange={(e) => setFormApiToken(e.target.value)}
                  />
                  {config?.api_token && (
                    <p className="text-xs text-success flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Token salvo. Deixe em branco para manter o atual.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sm-email">E-mail SolarMarket</Label>
                    <Input
                      id="sm-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sm-password">Senha SolarMarket</Label>
                    <Input
                      id="sm-password"
                      type="password"
                      placeholder={config?.auth_password_encrypted ? "••••••••" : "Digite a senha"}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="sm-url">URL Base da API</Label>
                <Input
                  id="sm-url"
                  placeholder="https://business.solarmarket.com.br/api/v2"
                  value={formBaseUrl}
                  onChange={(e) => setFormBaseUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sm-site-url">URL do Site (para n8n / integrações)</Label>
                <Input
                  id="sm-site-url"
                  placeholder="https://meusite.com.br"
                  value={formSiteUrl}
                  onChange={(e) => setFormSiteUrl(e.target.value)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Webhook (opcional)
                </Label>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="sm-webhook-url" className="text-xs text-muted-foreground">URL do Webhook</Label>
                    <div className="flex gap-2">
                      <Input
                        id="sm-webhook-url"
                        readOnly
                        value={webhookUrl}
                        className="font-mono text-xs"
                      />
                      <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sm-webhook-secret" className="text-xs text-muted-foreground">Secret do Webhook</Label>
                    <Input
                      id="sm-webhook-secret"
                      placeholder="Opcional: secret para validar webhooks"
                      value={formWebhookSecret}
                      onChange={(e) => setFormWebhookSecret(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {config?.last_token_expires_at && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <span className="text-muted-foreground">Token cacheado expira em: </span>
                  <span className="font-medium">
                    {format(new Date(config.last_token_expires_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button onClick={saveConfig} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Configuração
                </Button>
                <Button variant="outline" onClick={testConnection} disabled={testing || !config?.enabled}>
                  {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
                  Testar Conexão
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
