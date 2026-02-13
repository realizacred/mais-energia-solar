import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui-kit/Spinner";
import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Settings,
  KeyRound,
  Save,
  Eye,
  EyeOff,
  Users,
  Info,
  ExternalLink,
  Unplug,
} from "lucide-react";
import { GoogleCalendarConnectButton } from "./GoogleCalendarConnectButton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_LABELS: Record<string, string> = {
  call: "Ligação",
  meeting: "Reunião",
  followup: "Follow-up",
  visit: "Visita",
  other: "Outro",
};

export function AgendaConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // OAuth fields
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [savingOAuth, setSavingOAuth] = useState(false);

  // Handle OAuth callback result
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({ title: "Google Calendar conectado com sucesso ✅" });
      queryClient.invalidateQueries({ queryKey: ["google_calendar_connected_users"] });
      setSearchParams({}, { replace: true });
    } else if (searchParams.get("error")) {
      toast({ title: "Erro na conexão", description: `Erro: ${searchParams.get("error")}`, variant: "destructive" });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  // Load config
  const { data: config, isLoading } = useQuery({
    queryKey: ["agenda_config_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_config" as any)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        id: string;
        agenda_enabled: boolean;
        google_sync_enabled: boolean;
        google_sync_mode: string;
        google_sync_types: string[];
        google_default_calendar_id: string;
        updated_at: string;
      } | null;
    },
  });

  // Load sync logs
  const { data: syncLogs = [] } = useQuery({
    queryKey: ["agenda_sync_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_sync_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Check OAuth credentials
  const { data: oauthStatus } = useQuery({
    queryKey: ["google_calendar_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_configs")
        .select("service_key, is_active")
        .in("service_key", ["google_calendar_client_id", "google_calendar_client_secret"]);
      if (error) throw error;
      return {
        hasClientId: data?.some(d => d.service_key === "google_calendar_client_id" && d.is_active),
        hasClientSecret: data?.some(d => d.service_key === "google_calendar_client_secret" && d.is_active),
      };
    },
  });

  // Connected users
  const { data: connectedUsers = [] } = useQuery({
    queryKey: ["google_calendar_connected_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_calendar_tokens")
        .select("user_id, google_email, is_active, created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const isOAuthConfigured = oauthStatus?.hasClientId && oauthStatus?.hasClientSecret;

  const upsertConfig = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (config?.id) {
        const { error } = await supabase.from("agenda_config" as any).update(updates).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agenda_config" as any).insert(updates);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda_config"] });
      queryClient.invalidateQueries({ queryKey: ["agenda_config_admin"] });
      toast({ title: "Configuração salva ✅" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    upsertConfig.mutate({ [key]: value });
  };

  const handleSyncMode = (mode: string) => {
    upsertConfig.mutate({ google_sync_mode: mode });
  };

  const handleSyncTypes = (type: string, enabled: boolean) => {
    const current = config?.google_sync_types || ["call", "meeting"];
    const updated = enabled ? [...new Set([...current, type])] : current.filter((t: string) => t !== type);
    upsertConfig.mutate({ google_sync_types: updated });
  };

  const handleSaveOAuth = async () => {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setSavingOAuth(true);
    try {
      const results = await Promise.all([
        supabase.functions.invoke("save-integration-key", { body: { service_key: "google_calendar_client_id", api_key: clientId.trim() } }),
        supabase.functions.invoke("save-integration-key", { body: { service_key: "google_calendar_client_secret", api_key: clientSecret.trim() } }),
      ]);
      const errors = results.filter(r => r.error || r.data?.error);
      if (errors.length > 0) throw new Error("Erro ao salvar credenciais");
      toast({ title: "Credenciais salvas ✅" });
      setClientId("");
      setClientSecret("");
      queryClient.invalidateQueries({ queryKey: ["google_calendar_config"] });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSavingOAuth(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="md" />
      </div>
    );
  }

  const agendaEnabled = config?.agenda_enabled ?? true;
  const googleSyncEnabled = config?.google_sync_enabled ?? false;
  const syncTypes = config?.google_sync_types || ["call", "meeting"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Agenda & Compromissos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a agenda interna e a sincronização com Google Calendar
        </p>
      </div>

      {/* Toggle: Agenda interna */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Agenda Interna
          </CardTitle>
          <CardDescription>
            Permite agendar compromissos diretamente nas conversas do WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="agenda-toggle" className="text-sm">Ativar agenda interna</Label>
            <Switch id="agenda-toggle" checked={agendaEnabled} onCheckedChange={(v) => handleToggle("agenda_enabled", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Google Calendar Sync */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Sincronização Google Calendar
            {googleSyncEnabled ? (
              <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/20 gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3" /> Ativo
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-2 text-muted-foreground gap-1 text-xs">
                <XCircle className="h-3 w-3" /> Desativado
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Sincronize compromissos com Google Calendar dos consultores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label htmlFor="google-toggle" className="text-sm">Ativar sincronização</Label>
            <Switch id="google-toggle" checked={googleSyncEnabled} onCheckedChange={(v) => handleToggle("google_sync_enabled", v)} />
          </div>

          {googleSyncEnabled && (
            <>
              <Separator />

              {/* Sync mode */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Modo de sincronização</Label>
                <Select value={config?.google_sync_mode || "create_only"} onValueChange={handleSyncMode}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create_only">Apenas criar no Google</SelectItem>
                    <SelectItem value="bidirectional">Bidirecional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sync types */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Sincronizar tipos</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TYPE_LABELS).map(([type, label]) => (
                    <div key={type} className="flex items-center gap-2">
                      <Switch
                        id={`sync-type-${type}`}
                        checked={syncTypes.includes(type)}
                        onCheckedChange={(v) => handleSyncTypes(type, v)}
                        className="scale-90"
                      />
                      <Label htmlFor={`sync-type-${type}`} className="text-xs">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />
              <GoogleCalendarConnectButton />
            </>
          )}
        </CardContent>
      </Card>

      {/* OAuth Credentials */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Credenciais OAuth 2.0
            {isOAuthConfigured && (
              <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/20 gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3" /> Configurado
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Credenciais do Google Cloud Console para autenticação OAuth</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-info/5 border border-info/20 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2 text-info">
              <Info className="h-4 w-4" /> Como configurar
            </p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Acesse o <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80 inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="h-3 w-3" /></a></li>
              <li>Crie ou selecione um projeto</li>
              <li>Ative a <strong>Google Calendar API</strong></li>
              <li>Em <strong>Credenciais</strong>, crie um <strong>OAuth 2.0 Client ID</strong> (tipo: Web Application)</li>
              <li>Adicione como <strong>Authorized Redirect URI</strong>:
                <code className="block mt-1 px-2 py-1 bg-muted rounded text-xs font-mono break-all">
                  {`https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/google-calendar-callback`}
                </code>
              </li>
              <li>Copie o <strong>Client ID</strong> e <strong>Client Secret</strong> gerados</li>
            </ol>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="gc-client-id" className="text-sm flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Client ID
              </Label>
              <Input id="gc-client-id" placeholder="123456789.apps.googleusercontent.com" value={clientId} onChange={(e) => setClientId(e.target.value)} className="font-mono text-sm" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-client-secret" className="text-sm flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Client Secret
              </Label>
              <div className="relative">
                <Input id="gc-client-secret" type={showSecret ? "text" : "password"} placeholder="GOCSPX-..." value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="font-mono text-sm pr-10" autoComplete="off" />
                <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleSaveOAuth} disabled={savingOAuth || !clientId.trim() || !clientSecret.trim()} className="gap-2">
              {savingOAuth ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
              {savingOAuth ? "Salvando..." : isOAuthConfigured ? "Atualizar Credenciais" : "Salvar Credenciais"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connected Users */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Consultores Conectados
            <Badge variant="secondary" className="ml-1 text-xs">{connectedUsers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connectedUsers.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhum consultor conectou o Google Calendar ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {connectedUsers.map((u: any) => (
                <div key={u.user_id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.google_email || "Conta conectada"}</p>
                      <p className="text-xs text-muted-foreground">
                        Conectado em {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs gap-1 ${u.is_active ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                    {u.is_active ? <><CheckCircle2 className="h-3 w-3" /> Ativo</> : <><Unplug className="h-3 w-3" /> Desconectado</>}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Logs */}
      {googleSyncEnabled && syncLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Últimos Eventos de Sync
              <Badge variant="secondary" className="text-xs ml-1">{syncLogs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {syncLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-xs p-2 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-2">
                    {log.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    <span className="font-medium capitalize">{log.action}</span>
                    {log.error_message && <span className="text-destructive truncate max-w-[200px]">{log.error_message}</span>}
                  </div>
                  <span className="text-muted-foreground shrink-0">
                    {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AgendaConfigPage;
