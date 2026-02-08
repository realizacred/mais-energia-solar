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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw, Settings, Plug, Zap, Clock, CheckCircle2, XCircle,
  AlertTriangle, Loader2, Play, ExternalLink, Copy, Shield,
  FolderOpen, Link2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SolarMarketDataView, SolarMarketLinksView } from "@/components/admin/solarmarket";

interface SmConfig {
  id: string;
  enabled: boolean;
  base_url: string;
  auth_mode: string;
  api_token: string | null;
  auth_email: string | null;
  auth_password_encrypted: string | null;
  webhook_secret: string | null;
  last_token_expires_at: string | null;
}

interface SyncLog {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  error: string | null;
  counts: any;
  source: string;
  mode: string;
  triggered_by: string | null;
}

export function SolarMarketManager() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SmConfig | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [logsFilter, setLogsFilter] = useState("all");

  // Form state
  const [formAuthMode, setFormAuthMode] = useState("token");
  const [formApiToken, setFormApiToken] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("https://business.solarmarket.com.br/api/v2");
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
        setFormApiToken(""); // never show token
        setFormEmail(data.auth_email || "");
        setFormPassword(""); // never show password
        setFormBaseUrl(data.base_url || "https://business.solarmarket.com.br/api/v2");
        setFormWebhookSecret(data.webhook_secret || "");
        setFormEnabled(data.enabled);
      }
    } catch (err: any) {
      console.error("Error fetching SM config:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      let query = supabase
        .from("solar_market_sync_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);

      if (logsFilter !== "all") {
        query = query.eq("status", logsFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSyncLogs((data as SyncLog[]) || []);
    } catch (err: any) {
      console.error("Error fetching SM logs:", err);
    }
  }, [logsFilter]);

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, [fetchConfig, fetchLogs]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        enabled: formEnabled,
        base_url: formBaseUrl,
        auth_mode: formAuthMode,
        webhook_secret: formWebhookSecret || null,
      };

      // Token mode
      if (formAuthMode === "token" && formApiToken) {
        payload.api_token = formApiToken;
      }

      // Credentials mode
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
      const { data, error } = await supabase.functions.invoke("solar-market-sync", {
        body: { mode: "test", source: "manual" },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(`Falha na conexão: ${data.error}`);
      } else {
        toast.success("Conexão com SolarMarket bem-sucedida! ✅");
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
          `Sincronização concluída! ${c.clients_synced || 0} clientes, ${c.projects_synced || 0} projetos, ${c.proposals_synced || 0} propostas, ${c.leads_linked || 0} leads vinculados`
        );
        fetchLogs();
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
        fetchLogs();
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

  const statusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "fail": return <XCircle className="h-4 w-4 text-destructive" />;
      case "partial": return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "running": return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
      success: "default",
      fail: "destructive",
      partial: "secondary",
      running: "outline",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="gap-1">
        {statusIcon(status)}
        {status}
      </Badge>
    );
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
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="config" className="gap-1.5">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
          <TabsTrigger value="dados" className="gap-1.5">
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Dados</span>
          </TabsTrigger>
          <TabsTrigger value="vinculos" className="gap-1.5">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Vínculos</span>
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Sync</span>
          </TabsTrigger>
          <TabsTrigger value="delta" className="gap-1.5">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Delta</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Config Tab ─────────────────────────── */}
        <TabsContent value="config" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5 text-primary" />
                Credenciais SolarMarket
              </CardTitle>
              <CardDescription>
                Configure as credenciais de acesso à API do SolarMarket. Os dados são armazenados de forma segura e nunca expostos ao navegador.
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
                    placeholder={config?.api_token ? "••••••••••••••••" : "Cole o token aqui (ex: 12648:NSf5SJ...)"}
                    value={formApiToken}
                    onChange={(e) => setFormApiToken(e.target.value)}
                  />
                  {config?.api_token && (
                    <p className="text-xs text-muted-foreground">Deixe em branco para manter o token atual</p>
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
                    {config?.auth_password_encrypted && (
                      <p className="text-xs text-muted-foreground">Deixe em branco para manter a senha atual</p>
                    )}
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

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Webhook (opcional)
                </Label>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="sm-webhook-url" className="text-xs text-muted-foreground">URL do Webhook (para colar no SolarMarket)</Label>
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
                    <Label htmlFor="sm-webhook-secret" className="text-xs text-muted-foreground">Secret do Webhook (validação)</Label>
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

        {/* ── Dados Tab ──────────────────────────── */}
        <TabsContent value="dados" className="mt-4">
          <SolarMarketDataView />
        </TabsContent>

        {/* ── Vínculos Tab ───────────────────────── */}
        <TabsContent value="vinculos" className="mt-4">
          <SolarMarketLinksView />
        </TabsContent>

        {/* ── Full Sync Tab ──────────────────────── */}
        <TabsContent value="sync" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                Sincronização Completa
              </CardTitle>
              <CardDescription>
                Busca todos os clientes, projetos, propostas e funis do SolarMarket e sincroniza com o sistema. Vincula automaticamente leads por telefone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border bg-warning/10 border-warning/30">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Atenção</p>
                    <p className="text-muted-foreground">
                      A sincronização completa pode levar vários minutos dependendo do volume de dados. Não feche esta página durante o processo.
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
                Sincronize um item específico por ID do SolarMarket. Ideal para testes e atualizações pontuais via n8n.
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

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Exemplo de payload n8n / webhook:</Label>
                <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto">
{`POST /functions/v1/solar-market-sync
{
  "mode": "delta",
  "source": "n8n",
  "delta": {
    "type": "client",
    "sm_client_id": 12345
  }
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Logs Tab ───────────────────────────── */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Histórico de Sincronização
                  </CardTitle>
                  <CardDescription>Últimos 50 registros</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={logsFilter} onValueChange={setLogsFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="success">Sucesso</SelectItem>
                      <SelectItem value="fail">Falha</SelectItem>
                      <SelectItem value="partial">Parcial</SelectItem>
                      <SelectItem value="running">Rodando</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={fetchLogs}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {syncLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum log de sincronização encontrado
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Modo</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Contagens</TableHead>
                        <TableHead>Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncLogs.map((log) => {
                        const duration = log.finished_at && log.started_at
                          ? Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                          : null;
                        const counts = log.counts || {};

                        return (
                          <TableRow key={log.id}>
                            <TableCell>{statusBadge(log.status)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.mode}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{log.source}</TableCell>
                            <TableCell className="text-xs">
                              {format(new Date(log.started_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-xs">
                              {duration !== null ? `${duration}s` : "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {counts.clients_synced !== undefined ? (
                                <span className="space-x-1">
                                  <span title="Clientes">👤{counts.clients_synced}</span>
                                  <span title="Projetos">📁{counts.projects_synced}</span>
                                  <span title="Propostas">📄{counts.proposals_synced}</span>
                                  <span title="Links">🔗{counts.leads_linked}</span>
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate text-destructive">
                              {log.error || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
