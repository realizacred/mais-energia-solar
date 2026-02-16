import { useState, useEffect, useId, useRef, useCallback } from "react";
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
  XCircle,
  ShieldAlert,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui-kit/Spinner";

// ── Validation ──────────────────────────────────────────────
const CLIENT_ID_REGEX = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

function validateClientId(value: string): string {
  if (!value.trim()) return "";
  if (value.includes("@"))
    return "Erro: Insira o Client ID do projeto, não seu e-mail. O Client ID termina com .apps.googleusercontent.com";
  if (!CLIENT_ID_REGEX.test(value.trim()))
    return "Client ID inválido. O formato correto é: 123456789-xxxxxxxx.apps.googleusercontent.com";
  return "";
}

function validateClientSecret(value: string): string {
  if (!value.trim()) return "";
  if (value.includes("@"))
    return "Erro: Insira o Client Secret do projeto, não seu e-mail.";
  if (value.includes(" "))
    return "Client Secret não pode conter espaços.";
  if (value.trim().length < 10)
    return "Client Secret parece muito curto. Verifique o valor copiado do Google Cloud Console.";
  return "";
}

/** Detects if a value looks like browser autofill injected an email or password */
function looksLikeAutofill(value: string): boolean {
  if (!value) return false;
  if (value.includes("@")) return true;
  // Common autofill password patterns (dots, all lowercase short strings)
  if (/^[•·*]{4,}$/.test(value)) return true;
  return false;
}

// ── Anti-autofill Input ─────────────────────────────────────
interface SecureInputProps {
  fieldId: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  error: string;
  label: string;
  onAutofillDetected?: () => void;
}

function SecureTextarea({
  fieldId,
  value,
  onChange,
  placeholder,
  error,
  label,
  onAutofillDetected,
}: SecureInputProps) {
  const [readOnly, setReadOnly] = useState(true);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Autofill detection: when value changes externally (e.g. browser autofill on mount)
  useEffect(() => {
    if (readOnly && ref.current) {
      const domVal = ref.current.value;
      if (domVal && looksLikeAutofill(domVal)) {
        // Browser injected something — clear it
        ref.current.value = "";
        onChange("");
        onAutofillDetected?.();
      }
    }
  }, [readOnly]);

  // Also detect via onChange (Chrome fires change events for autofill)
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const raw = e.target.value.replace(/\n/g, "");
      if (looksLikeAutofill(raw)) {
        onChange("");
        if (ref.current) ref.current.value = "";
        onAutofillDetected?.();
        return;
      }
      onChange(raw);
    },
    [onChange, onAutofillDetected]
  );

  return (
    <div className="space-y-1.5">
      <Label className="text-sm flex items-center gap-1.5" htmlFor={fieldId}>
        <KeyRound className="h-3.5 w-3.5" />
        {label}
      </Label>
      <textarea
        ref={ref}
        id={fieldId}
        name={fieldId}
        aria-label={`Configuração do projeto ${label}`}
        rows={1}
        placeholder={placeholder}
        value={value}
        readOnly={readOnly}
        onFocus={() => setReadOnly(false)}
        onChange={handleChange}
        className={`flex w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono shadow-xs transition-all duration-200 resize-none overflow-hidden ring-offset-background placeholder:text-muted-foreground/60 hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-destructive focus-visible:ring-destructive/40" : "border-input"}`}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-form-type="other"
        data-lpignore="true"
        data-1p-ignore="true"
        data-bwignore="true"
      />
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1 mt-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export function GoogleCalendarConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // State is ALWAYS initialized empty — DB values shown only as status labels
  const [gcalClientId, setGcalClientId] = useState("");
  const [gcalClientSecret, setGcalClientSecret] = useState("");
  const [identityError, setIdentityError] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [autofillWarning, setAutofillWarning] = useState(false);

  // Unique React-generated IDs — randomized per render to defeat autofill heuristics
  const formId = useId();

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

  // Fetch config status via Edge Function gateway (admin RPCs are service_role only)
  const { data: configStatus, isLoading: loadingConfig } = useQuery({
    queryKey: ["google_calendar_config"],
    queryFn: async () => {
      const { data: fnData, error } = await supabase.functions.invoke("google-calendar-admin", {
        body: { action: "config_status" },
      });
      if (error) throw error;
      const result = fnData?.data as any;
      return {
        hasClientId: result?.hasClientId ?? false,
        hasClientSecret: result?.hasClientSecret ?? false,
        maskedClientId: result?.maskedClientId ?? null,
        lastUpdated: result?.lastUpdated ?? null,
      };
    },
  });

  // List connected consultants via Edge Function gateway
  const { data: connectedUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["google_calendar_connected_users"],
    queryFn: async () => {
      const { data: fnData, error } = await supabase.functions.invoke("google-calendar-admin", {
        body: { action: "connected_users" },
      });
      if (error) throw error;
      return (fnData?.data as any[]) || [];
    },
  });

  const isConfigured = configStatus?.hasClientId && configStatus?.hasClientSecret;

  const handleSave = async () => {
    const trimmedId = gcalClientId.trim();
    const trimmedSecret = gcalClientSecret.trim();

    // Frontend validation (defense layer 1 — backend also validates)
    const idErr = validateClientId(trimmedId);
    const secretErr = validateClientSecret(trimmedSecret);
    if (idErr || secretErr) {
      setIdentityError(idErr);
      setSecurityError(secretErr);
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

      // Check for structured backend errors
      for (const r of results) {
        if (r.error) throw new Error(r.error.message || "Erro ao salvar credenciais.");
        if (r.data?.error) {
          const code = r.data?.code || r.data?.error?.code;
          const msg = r.data?.error?.message || r.data?.error || r.data?.details || "Credencial inválida.";
          throw new Error(code === "CONFIG_INVALID" ? msg : `Erro: ${msg}`);
        }
      }

      toast({ title: "Credenciais salvas ✅", description: "Google Calendar configurado com sucesso." });

      // WRITE-ONLY: clear fields immediately, never show saved values
      setGcalClientId("");
      setGcalClientSecret("");
      setIdentityError("");
      setSecurityError("");
      setEditing(false);
      setAutofillWarning(false);
      await queryClient.invalidateQueries({ queryKey: ["google_calendar_config"] });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const clearFields = () => {
    setGcalClientId("");
    setGcalClientSecret("");
    setIdentityError("");
    setSecurityError("");
    setAutofillWarning(false);
  };

  const handleAutofillDetected = useCallback(() => {
    setAutofillWarning(true);
  }, []);

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

          {/* ── Configured state: show status (WRITE-ONLY — never show secret) ── */}
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
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-success" />
                Client Secret configurado
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearFields();
                  setEditing(true);
                }}
                className="gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Alterar Credenciais
              </Button>
            </div>
          )}

          {/* ── Form: only rendered when editing (never pre-filled with DB values) ── */}
          {(!isConfigured || editing) && (
            <form
              autoComplete="off"
              data-form-type="other"
              aria-label="Configuração de projeto OAuth"
              onSubmit={(e) => e.preventDefault()}
              className="space-y-3 relative"
            >
              {/* Hidden decoy inputs — absorb browser autofill attempts */}
              <div aria-hidden="true" className="absolute w-0 h-0 overflow-hidden">
                <input type="text" name="fakeusernameremembered" tabIndex={-1} readOnly value="" />
                <input type="password" name="fakepasswordremembered" tabIndex={-1} readOnly value="" />
              </div>

              {/* Autofill warning banner */}
              {autofillWarning && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-warning">Autofill detectado e bloqueado</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      O navegador tentou preencher com e-mail/senha. Os campos foram limpos.
                      Cole manualmente o Client ID e Client Secret do Google Cloud Console.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutofillWarning(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              )}

              {saving && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-sm font-medium">Salvando credenciais…</span>
                  </div>
                </div>
              )}

              {/* Client ID — anti-autofill textarea with readonly-until-focus */}
              <SecureTextarea
                fieldId={`${formId}-gc-proj-${Math.random().toString(36).slice(2, 6)}-a`}
                value={gcalClientId}
                onChange={(val) => {
                  setGcalClientId(val);
                  setIdentityError(validateClientId(val));
                }}
                placeholder="123456789-xxxxxxxx.apps.googleusercontent.com"
                error={identityError}
                label="Client ID"
                onAutofillDetected={handleAutofillDetected}
              />

              {/* Client Secret — WRITE-ONLY: always starts empty, never shows saved value */}
              <SecureTextarea
                fieldId={`${formId}-gc-proj-${Math.random().toString(36).slice(2, 6)}-b`}
                value={gcalClientSecret}
                onChange={(val) => {
                  setGcalClientSecret(val);
                  setSecurityError(validateClientSecret(val));
                }}
                placeholder="GOCSPX-..."
                error={securityError}
                label="Client Secret"
                onAutofillDetected={handleAutofillDetected}
              />

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !gcalClientId.trim() || !gcalClientSecret.trim() || !!identityError || !!securityError}
                  className="gap-2"
                >
                  {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                  {saving ? "Salvando..." : isConfigured ? "Atualizar Credenciais" : "Salvar Credenciais"}
                </Button>
                {(gcalClientId || gcalClientSecret) && (
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
