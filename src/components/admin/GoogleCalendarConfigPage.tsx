import { useState, useEffect, useId } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Eraser,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui-kit/Spinner";

/**
 * Admin page: configure Google Calendar OAuth credentials (Client ID + Secret)
 * and view which consultants have connected their calendars.
 *
 * REBUILT from scratch to eliminate browser autofill interference.
 */
export function GoogleCalendarConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // State is ALWAYS initialized empty — DB values shown only as labels
  const [gcalAppIdentity, setGcalAppIdentity] = useState("");
  const [gcalAppSecurity, setGcalAppSecurity] = useState("");
  const [identityError, setIdentityError] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Unique React-generated IDs to avoid any autofill pattern matching
  const formId = useId();

  const validateNotEmail = (value: string, field: "id" | "secret") => {
    if (value.includes("@")) {
      return field === "id"
        ? "Erro: Insira o Client ID do projeto, não seu e-mail. O Client ID termina com .apps.googleusercontent.com"
        : "Erro: Insira o Client Secret do projeto, não seu e-mail.";
    }
    return "";
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

  // Fetch stored credentials — display as labels only, never populate inputs
  const { data: configStatus, isLoading: loadingConfig } = useQuery({
    queryKey: ["google_calendar_config"],
    queryFn: async () => {
      // SECURITY: Only fetch metadata, never return raw api_key for secrets
      const { data, error } = await supabase
        .from("integration_configs")
        .select("service_key, is_active, last_validated_at, updated_at")
        .in("service_key", ["google_calendar_client_id", "google_calendar_client_secret"]);
      if (error) throw error;
      const idRow = data?.find(d => d.service_key === "google_calendar_client_id");
      const secretRow = data?.find(d => d.service_key === "google_calendar_client_secret");

      // Fetch masked client_id separately (only the ID, never the secret)
      let maskedClientId: string | null = null;
      if (idRow?.is_active) {
        const { data: idData } = await supabase
          .from("integration_configs")
          .select("api_key")
          .eq("service_key", "google_calendar_client_id")
          .maybeSingle();
        if (idData?.api_key) {
          maskedClientId = `${idData.api_key.slice(0, 8)}•••${idData.api_key.slice(-20)}`;
        }
      }

      return {
        hasClientId: !!(idRow?.is_active),
        hasClientSecret: !!(secretRow?.is_active),
        maskedClientId,
        lastValidated: idRow?.last_validated_at,
        lastUpdated: secretRow?.updated_at || idRow?.updated_at,
      };
    },
  });

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
    const trimmedId = gcalAppIdentity.trim();
    const trimmedSecret = gcalAppSecurity.trim();

    if (!trimmedId || !trimmedSecret) {
      toast({ title: "Campos obrigatórios", description: "Preencha Client ID e Client Secret.", variant: "destructive" });
      return;
    }

    // Hard block: prevent saving emails as credentials
    if (trimmedId.includes("@") || trimmedSecret.includes("@")) {
      toast({
        title: "Erro: Credencial inválida",
        description: "Você está tentando salvar um e-mail. O Client ID é um código que termina em .apps.googleusercontent.com",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const results = await Promise.all([
        supabase.functions.invoke("save-integration-key", {
          body: { service_key: "google_calendar_client_id", api_key: trimmedId },
        }),
        supabase.functions.invoke("save-integration-key", {
          body: { service_key: "google_calendar_client_secret", api_key: trimmedSecret },
        }),
      ]);

      const errors = results.filter(r => r.error || r.data?.error);
      if (errors.length > 0) throw new Error("Erro ao salvar credenciais.");

      toast({ title: "Credenciais salvas ✅", description: "Google Calendar configurado com sucesso." });

      // Reset form completely and hide editor
      setGcalAppIdentity("");
      setGcalAppSecurity("");
      setIdentityError("");
      setEditing(false);
      setSecurityError("");
      await queryClient.invalidateQueries({ queryKey: ["google_calendar_config"] });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const clearFields = () => {
    setGcalAppIdentity("");
    setGcalAppSecurity("");
    setIdentityError("");
    setSecurityError("");
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

      {/* Credentials Card */}
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
          {/* Instructions */}
          <div className="p-4 rounded-lg bg-info/5 border border-info/20 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2 text-info">
              <Info className="h-4 w-4" />
              Como configurar
            </p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Acesse o <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80 inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="h-3 w-3" /></a></li>
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

          {/* When configured and NOT editing: show success state + change button */}
          {isConfigured && !editing && (
            <div className="p-4 rounded-lg bg-success/5 border border-success/20 space-y-3">
              <p className="text-sm text-success flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Credenciais configuradas com sucesso
              </p>
              {configStatus?.maskedClientId && (
                <p className="text-xs text-muted-foreground font-mono truncate">
                  Client ID: {configStatus.maskedClientId}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Alterar Credenciais
              </Button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              FORM with full autofill blocking:
              - autocomplete="off" on form
              - Hidden decoy inputs to absorb autofill
              - textarea instead of input to bypass password managers
              - Random names/ids via useId()
              ═══════════════════════════════════════════════════ */}
          {/* Only render the form when NOT configured or when user clicks "Alterar" */}
          {(!isConfigured || editing) && (
          <form autoComplete="off" onSubmit={(e) => e.preventDefault()} className="space-y-3 relative">
            {/* Hidden decoy inputs — absorb browser autofill */}
            <input type="text" name="fakeusernameremembered" style={{ display: "none" }} value="" readOnly tabIndex={-1} />
            <input type="password" name="fakepasswordremembered" style={{ display: "none" }} value="" readOnly tabIndex={-1} />

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
                id={`${formId}-gcal-app-identity`}
                name={`${formId}-gcal-app-identity`}
                rows={1}
                placeholder="123456789.apps.googleusercontent.com"
                value={gcalAppIdentity}
                onChange={(e) => {
                  const val = e.target.value.replace(/\n/g, "");
                  setGcalAppIdentity(val);
                  setIdentityError(validateNotEmail(val, "id"));
                }}
                className={`flex w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono shadow-xs transition-all duration-200 resize-none overflow-hidden ring-offset-background placeholder:text-muted-foreground/60 hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 ${identityError ? "border-destructive focus-visible:ring-destructive/40" : "border-input"}`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
              />
              {identityError && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {identityError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Client Secret
              </Label>
              <textarea
                id={`${formId}-gcal-app-security`}
                name={`${formId}-gcal-app-security`}
                rows={1}
                placeholder="GOCSPX-..."
                value={gcalAppSecurity}
                onChange={(e) => {
                  const val = e.target.value.replace(/\n/g, "");
                  setGcalAppSecurity(val);
                  setSecurityError(validateNotEmail(val, "secret"));
                }}
                className={`flex w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono shadow-xs transition-all duration-200 resize-none overflow-hidden ring-offset-background placeholder:text-muted-foreground/60 hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 ${securityError ? "border-destructive focus-visible:ring-destructive/40" : "border-input"}`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
              />
              {securityError && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {securityError}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !gcalAppIdentity.trim() || !gcalAppSecurity.trim() || !!identityError || !!securityError}
                className="gap-2"
              >
                {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                {saving ? "Salvando..." : isConfigured ? "Atualizar Credenciais" : "Salvar Credenciais"}
              </Button>
              {(gcalAppIdentity || gcalAppSecurity) && (
                <Button type="button" variant="ghost" size="sm" onClick={clearFields} className="gap-1.5 text-muted-foreground">
                  <Eraser className="h-3.5 w-3.5" />
                  Limpar Campos
                </Button>
              )}
            </div>
          </form>
          )}
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
                <div key={user.user_id} className="flex items-center justify-between p-3 rounded-lg border">
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
                      <><AlertTriangle className="h-3 w-3" /> Inativo</>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default GoogleCalendarConfigPage;
