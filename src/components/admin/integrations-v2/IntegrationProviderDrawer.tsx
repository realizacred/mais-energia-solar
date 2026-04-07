import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  CheckCircle2, AlertTriangle, Eye, EyeOff, Plug, Power,
  RefreshCw, HelpCircle, Loader2, Sun, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getProviderIconUrl } from "@/services/integrations/iconMap";
import { connectProvider, connectSupplierProvider, connectSignatureProvider, resolveSupplierProviderKey } from "@/services/integrations/integrationService";
import type { IntegrationProvider, CredentialField, ConnectionStatus } from "@/services/integrations/types";
import { supabase } from "@/integrations/supabase/client";
import { LEGACY_ID_MAP } from "@/services/monitoring/providerRegistry";
import { translateCapability } from "@/services/integrations/capabilityLabels";

const LEGACY_PROVIDER_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_ID_MAP).map(([legacy, canonical]) => [canonical, legacy])
);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: IntegrationProvider;
  connStatus: ConnectionStatus;
  onSuccess: () => void;
  onDisconnect: () => void;
  onSync: () => void;
  syncing: boolean;
}

export function IntegrationProviderDrawer({
  open, onOpenChange, provider, connStatus,
  onSuccess, onDisconnect, onSync, syncing,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [savedSecrets, setSavedSecrets] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  const isConnected = connStatus === "connected";
  const fields = (provider.credential_schema || []) as CredentialField[];
  const tutorial = provider.tutorial;
  const isComingSoon = provider.status === "coming_soon";
  const hasFields = fields.length > 0 && !isComingSoon;

  const iconUrl = getProviderIconUrl(provider.id) || (provider.logo_key ? getProviderIconUrl(provider.logo_key) : null);

  const isSecretField = (field: CredentialField) => {
    const key = field.key.toLowerCase();
    return field.type === "password" || key.includes("secret") || key.includes("token") || key.includes("password");
  };

  // Pre-fill credentials
  useEffect(() => {
    if (!open || loaded) return;

    (async () => {
      try {
        let merged: Record<string, any> = {};

        if (provider.category === "suppliers") {
          const providerKey = resolveSupplierProviderKey(provider.id, provider.label);
          const { data: rows } = await (supabase as any)
            .from("integrations_api_configs")
            .select("credentials")
            .eq("provider", providerKey)
            .order("updated_at", { ascending: false })
            .limit(1);

          const row = ((rows as any[]) || [])[0];
          merged = (row?.credentials as Record<string, any>) || {};
        } else if (provider.category === "signature") {
          // Signature providers persist in signature_settings
          const { data } = await (supabase as any)
            .from("signature_settings")
            .select("provider, sandbox_mode, api_token_encrypted, webhook_secret_encrypted")
            .maybeSingle();

          if (data) {
            merged = {
              api_token: data.api_token_encrypted || "",
              sandbox_mode: data.sandbox_mode ? "true" : "false",
              webhook_secret: data.webhook_secret_encrypted || "",
            };
          }
        } else {
          const legacyId = LEGACY_PROVIDER_MAP[provider.id] || provider.id;
          const { data } = await (supabase
            .from("monitoring_integrations" as any)
            .select("credentials, tokens")
            .eq("provider", legacyId)
            .maybeSingle() as any);

          if (data) {
            const creds = (data.credentials as Record<string, any>) || {};
            const tokens = (data.tokens as Record<string, any>) || {};
            merged = { ...creds, ...tokens };
          }
        }

        const prefilled: Record<string, string> = {};
        const secrets: Record<string, boolean> = {};

        for (const field of fields) {
          const val = merged[field.key];
          if (!val || typeof val !== "string") continue;

          if (isSecretField(field)) {
            secrets[field.key] = true;
          } else {
            prefilled[field.key] = val;
          }
        }

        if (Object.keys(prefilled).length > 0) setFormValues(prefilled);
        if (Object.keys(secrets).length > 0) setSavedSecrets(secrets);
      } catch {
        // silent
      }
      setLoaded(true);
    })();
  }, [open, provider.id, loaded]);

  const handleFieldChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormValues((prev) => ({ ...prev, [key]: value }));

    if (value.trim() !== "") {
      setSavedSecrets((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const isValid = fields.every((f) => {
    if (!f.required) return true;
    return !!formValues[f.key]?.trim() || !!savedSecrets[f.key];
  });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const credentials: Record<string, string> = {};
      for (const field of fields) {
        if (formValues[field.key]) credentials[field.key] = formValues[field.key];
      }
      let result: { success: boolean; error?: string };
      if (provider.category === "suppliers") {
        result = await connectSupplierProvider(provider.id, provider.label, credentials);
      } else if (provider.category === "signature") {
        result = await connectSignatureProvider(provider.id, provider.label, credentials);
      } else {
        result = await connectProvider(LEGACY_PROVIDER_MAP[provider.id] || provider.id, credentials);
      }

      if (result.success) {
        toast.success(`${provider.label} conectado com sucesso!`);
        onSuccess();
      } else {
        toast.error(result.error || "Falha na conexão");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setFormValues({});
      setSavedSecrets({});
      setLoaded(false);
    }
    onOpenChange(isOpen);
  };

  const activeCapabilities = provider.capabilities
    ? Object.entries(provider.capabilities).filter(([, v]) => v)
    : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/50 bg-muted/20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-card border border-border/50 shadow-sm shrink-0">
              {iconUrl ? (
                <img src={iconUrl} alt={provider.label} className="max-h-8 max-w-8 object-contain" />
              ) : (
                <Sun className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground">
                {provider.label}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {provider.description}
              </DialogDescription>
            </div>
            {isConnected && (
              <Badge className="text-[10px] font-semibold bg-success/15 text-success border-success/25 px-2.5 py-1 gap-1 shrink-0">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                </span>
                Conectado
              </Badge>
            )}
          </div>

          {/* Capabilities */}
          {activeCapabilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {activeCapabilities.map(([key]) => (
                <Badge key={key} variant="secondary" className="text-[10px] gap-1 py-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {translateCapability(key)}
                </Badge>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            {/* Coming soon warning */}
            {isComingSoon && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Esta integração estará disponível em breve.
                </span>
              </div>
            )}

            {/* Connection status (when connected) */}
            {isConnected && (
              <div className="rounded-lg border border-border/50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Status da Conexão</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-sm text-foreground">Conectado</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={onSync} disabled={syncing} className="text-xs gap-1.5">
                    <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
                    Sincronizar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDisconnect}
                    className="text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Power className="h-3.5 w-3.5" />
                    Desconectar
                  </Button>
                </div>
              </div>
            )}

            {/* Credential fields */}
            {hasFields && (
              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`modal-${field.key}`} className="text-xs font-semibold">
                      {field.label}
                      {!field.required && <span className="text-muted-foreground ml-1 font-normal">(opcional)</span>}
                    </Label>
                    {field.type === "select" && field.options ? (
                      <Select
                        value={formValues[field.key] || ""}
                        onValueChange={(val) => setFormValues((prev) => ({ ...prev, [field.key]: val }))}
                      >
                        <SelectTrigger id={`modal-${field.key}`} className="h-10">
                          <SelectValue placeholder={field.placeholder || "Selecione..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="relative">
                        <Input
                          id={`modal-${field.key}`}
                          type={field.type === "password" && showPassword[field.key] ? "text" : field.type}
                          placeholder={savedSecrets[field.key] ? "••••••••  (salvo)" : (field.placeholder || "")}
                          value={formValues[field.key] || ""}
                          onChange={handleFieldChange(field.key)}
                          className="h-10"
                        />
                        {field.type === "password" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                            tabIndex={-1}
                          >
                            {showPassword[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    )}
                    {field.helperText && (
                      <p className="text-[10px] text-muted-foreground">{field.helperText}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {fields.some((f) => f.key === "password") && (
              <p className="text-[10px] text-muted-foreground">
                A senha é usada apenas para autenticação e <strong>não é armazenada</strong>. Apenas o token de acesso é salvo.
              </p>
            )}

            {/* Help / Tutorial */}
            {tutorial && (tutorial.steps?.length > 0 || tutorial.notes) && (
              <Accordion type="single" collapsible className="w-full" defaultValue={isComingSoon ? "tutorial" : undefined}>
                <AccordionItem value="tutorial" className="border-border">
                  <AccordionTrigger className="text-sm gap-2 py-2">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-info" />
                      <span>Como obter credenciais</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {tutorial.steps && tutorial.steps.length > 0 && (
                        <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground">
                          {tutorial.steps.map((step, i) => (
                            <li key={i} className="leading-relaxed">{step}</li>
                          ))}
                        </ol>
                      )}
                      {tutorial.notes && (
                        <div className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3 py-1">
                          {tutorial.notes}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {hasFields && (
          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || saving}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              {isConnected ? "Atualizar" : "Conectar"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
