import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  KeyRound,
  Save,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Users,
  Settings,
  Info,
  Unplug,
  Eraser,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui-kit/Spinner";

/**
 * Admin page: configure Google Calendar OAuth credentials (Client ID + Secret)
 * and view which consultants have connected their calendars.
 */
export function GoogleCalendarConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [clientIdError, setClientIdError] = useState("");
  const [clientSecretError, setClientSecretError] = useState("");
  
  const [saving, setSaving] = useState(false);

  const validateNotEmail = (value: string, field: "id" | "secret") => {
    if (value.includes("@")) {
      const msg = field === "id"
        ? "Erro: Insira o Client ID do projeto, não seu e-mail. O Client ID termina com .apps.googleusercontent.com"
        : "Erro: Insira o Client Secret do projeto, não seu e-mail.";
      return msg;
    }
    return "";
  };

  const handleClientIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setClientId(val);
    setClientIdError(validateNotEmail(val, "id"));
  };

  const handleClientSecretChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setClientSecret(val);
    setClientSecretError(validateNotEmail(val, "secret"));
  };

  // Handle OAuth callback result
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({ title: "Google Calendar conectado com sucesso ✅" });
      queryClient.invalidateQueries({ queryKey: ["google_calendar_connected_users"] });
      setSearchParams({}, { replace: true });
    } else if (searchParams.get("error")) {
      toast({
        title: "Erro na conexão",
        description: `Erro: ${searchParams.get("error")}`,
        variant: "destructive",
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  // Fetch stored credentials to display masked preview & override autofill
  const { data: configStatus, isLoading: loadingConfig } = useQuery({
    queryKey: ["google_calendar_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_configs")
        .select("service_key, api_key, is_active, last_validated_at")
        .in("service_key", ["google_calendar_client_id", "google_calendar_client_secret"]);
      if (error) throw error;
      const idRow = data?.find(d => d.service_key === "google_calendar_client_id");
      const secretRow = data?.find(d => d.service_key === "google_calendar_client_secret");
      return {
        hasClientId: !!(idRow?.is_active),
        hasClientSecret: !!(secretRow?.is_active),
        storedClientId: idRow?.api_key ?? null,
        storedClientSecret: secretRow?.api_key ?? null,
        lastValidated: idRow?.last_validated_at,
      };
    },
  });

  // Anti-autofill: after DB loads, force-set inputs to DB values (overrides browser autofill)
  useEffect(() => {
    if (configStatus?.storedClientId && !clientId) {
      // Only set a masked version so the real key isn't exposed in the DOM
      // User must re-enter to change
    }
    // Clear any autofill that snuck in with "@"
    const timer = setTimeout(() => {
      const cidEl = document.getElementById("gc-client-id") as HTMLInputElement | null;
      const csecEl = document.getElementById("gc-client-secret") as HTMLInputElement | null;
      if (cidEl && cidEl.value.includes("@")) {
        setClientId("");
        cidEl.value = "";
      }
      if (csecEl && csecEl.value.includes("@")) {
        setClientSecret("");
        csecEl.value = "";
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [configStatus]);

  // List connected consultants
  const { data: connectedUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["google_calendar_connected_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_calendar_tokens")
        .select("user_id, google_email, is_active, created_at, updated_at");
      if (error) throw error;
      return data || [];
    },
  });

  const isConfigured = configStatus?.hasClientId && configStatus?.hasClientSecret;

  const handleSave = async () => {
    const trimmedId = clientId.trim();
    const trimmedSecret = clientSecret.trim();

    if (!trimmedId || !trimmedSecret) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha Client ID e Client Secret.",
        variant: "destructive",
      });
      return;
    }

    // Hard block: prevent saving emails as credentials
    if (trimmedId.includes("@") || trimmedSecret.includes("@")) {
      toast({
        title: "Erro: Credencial inválida",
        description: "Você está tentando salvar um e-mail no lugar do Client ID técnico. O Client ID é um código numérico que termina em .apps.googleusercontent.com",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const promises = [
        supabase.functions.invoke("save-integration-key", {
          body: { service_key: "google_calendar_client_id", api_key: trimmedId },
        }),
        supabase.functions.invoke("save-integration-key", {
          body: { service_key: "google_calendar_client_secret", api_key: trimmedSecret },
        }),
      ];

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error || r.data?.error);

      if (errors.length > 0) {
        throw new Error("Erro ao salvar credenciais. Verifique os dados.");
      }

      toast({
        title: "Credenciais salvas ✅",
        description: "Google Calendar configurado com sucesso.",
      });

      // Reset form and force re-fetch from DB
      setClientId("");
      setClientSecret("");
      setClientIdError("");
      setClientSecretError("");
      await queryClient.invalidateQueries({ queryKey: ["google_calendar_config"] });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Google Calendar
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a integração com Google Calendar para sincronizar agenda dos consultores
        </p>
      </div>

      {/* Setup instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Credenciais OAuth 2.0
            {isConfigured && (
              <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/20 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Configurado
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Credenciais do Google Cloud Console para autenticação OAuth
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instructions box */}
          <div className="p-4 rounded-lg bg-info/5 border border-info/20 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2 text-info">
              <Info className="h-4 w-4" />
              Como configurar
            </p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Acesse o <a id="gc-cloud-console-link" href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80 inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="h-3 w-3" /></a></li>
              <li>Crie ou selecione um projeto</li>
              <li>Ative a <strong>Google Calendar API</strong></li>
              <li>Em <strong>Credenciais</strong>, crie um <strong>OAuth 2.0 Client ID</strong> (tipo: Web Application)</li>
              <li>Adicione como <strong>Authorized Redirect URI</strong>:
                <code className="block mt-1 px-2 py-1 bg-muted rounded text-xs font-mono break-all">
                  {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-callback`}
                </code>
              </li>
              <li>Copie o <strong>Client ID</strong> e <strong>Client Secret</strong> gerados</li>
            </ol>
          </div>

          <Separator />

          {/* Stored credential indicator */}
          {isConfigured && !clientId && !clientSecret && (
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <p className="text-xs text-success flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Credenciais salvas no banco. Preencha abaixo apenas para atualizar.
              </p>
              {configStatus?.storedClientId && (
                <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
                  Client ID: {configStatus.storedClientId.slice(0, 12)}...{configStatus.storedClientId.slice(-30)}
                </p>
              )}
            </div>
          )}

          {/* Input fields — wrapped in relative for saving overlay */}
          <div className="space-y-3 relative">
            {saving && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                <div className="flex items-center gap-2">
                  <Spinner size="sm" />
                  <span className="text-sm font-medium">Salvando credenciais…</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Client ID
              </Label>
              <textarea
                rows={1}
                placeholder="123456789.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => {
                  const val = e.target.value.replace(/\n/g, "");
                  setClientId(val);
                  setClientIdError(validateNotEmail(val, "id"));
                }}
                className={`flex w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono shadow-xs transition-all duration-200 resize-none overflow-hidden ring-offset-background placeholder:text-muted-foreground/60 hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 ${clientIdError ? "border-destructive focus-visible:ring-destructive/40" : "border-input"}`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
              />
              {clientIdError && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {clientIdError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Client Secret
              </Label>
              <textarea
                rows={1}
                placeholder="GOCSPX-..."
                value={clientSecret}
                onChange={(e) => {
                  const val = e.target.value.replace(/\n/g, "");
                  setClientSecret(val);
                  setClientSecretError(validateNotEmail(val, "secret"));
                }}
                className={`flex w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono shadow-xs transition-all duration-200 resize-none overflow-hidden ring-offset-background placeholder:text-muted-foreground/60 hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 ${clientSecretError ? "border-destructive focus-visible:ring-destructive/40" : "border-input"}`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
              />
              {clientSecretError && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {clientSecretError}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || !clientId.trim() || !clientSecret.trim() || !!clientIdError || !!clientSecretError}
                className="gap-2"
              >
                {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                {saving ? "Salvando..." : isConfigured ? "Atualizar Credenciais" : "Salvar Credenciais"}
              </Button>
              {(clientId || clientSecret) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setClientId("");
                    setClientSecret("");
                    setClientIdError("");
                    setClientSecretError("");
                  }}
                  className="gap-1.5 text-muted-foreground"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Limpar Campos
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected consultants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Consultores Conectados
            <Badge variant="secondary" className="ml-1 text-xs">
              {connectedUsers.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Consultores que autorizaram o acesso ao Google Calendar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Spinner size="sm" />
              <span className="text-sm text-muted-foreground">Carregando...</span>
            </div>
          ) : connectedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhum consultor conectou o Google Calendar ainda</p>
              {!isConfigured && (
                <p className="text-xs mt-1">Configure as credenciais OAuth acima primeiro</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {connectedUsers.map((user) => (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user.google_email || "Conta conectada"}</p>
                      <p className="text-xs text-muted-foreground">
                        Conectado em {new Date(user.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs gap-1 ${
                      user.is_active
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    }`}
                  >
                    {user.is_active ? (
                      <><CheckCircle2 className="h-3 w-3" /> Ativo</>
                    ) : (
                      <><Unplug className="h-3 w-3" /> Desconectado</>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next steps */}
      {isConfigured && (
        <Card className="border-dashed">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Próximos passos</p>
                <ul className="text-sm text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                  <li>A Edge Function de OAuth callback será implementada na Fase 2</li>
                  <li>Cada consultor poderá conectar sua conta Google pelo portal</li>
                  <li>Follow-ups e visitas serão sincronizados automaticamente</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default GoogleCalendarConfigPage;
