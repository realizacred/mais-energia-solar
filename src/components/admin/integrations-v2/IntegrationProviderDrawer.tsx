import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  CheckCircle2, AlertTriangle, Eye, EyeOff, Plug, Power,
  RefreshCw, HelpCircle, ShieldCheck, Loader2, Sun, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getProviderIconUrl } from "@/services/integrations/iconMap";
import { connectProvider } from "@/services/integrations/integrationService";
import type { IntegrationProvider, CredentialField, ConnectionStatus } from "@/services/integrations/types";
import { supabase } from "@/integrations/supabase/client";
import { LEGACY_ID_MAP } from "@/services/monitoring/providerRegistry";

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
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("credentials");

  const isConnected = connStatus === "connected";
  const fields = (provider.credential_schema || []) as CredentialField[];
  const tutorial = provider.tutorial;
  const isComingSoon = provider.status === "coming_soon";
  const hasFields = fields.length > 0 && !isComingSoon;

  // Static icon resolution — instant
  const iconUrl = getProviderIconUrl(provider.id);

  // Pre-fill credentials
  useEffect(() => {
    if (!open || loaded) return;
    const legacyId = LEGACY_PROVIDER_MAP[provider.id] || provider.id;

    (async () => {
      try {
        const { data } = await (supabase
          .from("monitoring_integrations" as any)
          .select("credentials, tokens")
          .eq("provider", legacyId)
          .maybeSingle() as any);

        if (data) {
          const creds = (data.credentials as Record<string, any>) || {};
          const tokens = (data.tokens as Record<string, any>) || {};
          const merged = { ...creds, ...tokens };
          const prefilled: Record<string, string> = {};
          for (const field of fields) {
            const val = merged[field.key];
            if (val && typeof val === "string" && field.type !== "password" && !field.key.toLowerCase().includes("secret")) {
              prefilled[field.key] = val;
            }
          }
          if (Object.keys(prefilled).length > 0) setFormValues(prefilled);
        }
      } catch { /* silent */ }
      setLoaded(true);
    })();
  }, [open, provider.id, loaded]);

  const handleFieldChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const isValid = fields.every((f) => !f.required || (formValues[f.key] && formValues[f.key].trim() !== ""));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const credentials: Record<string, string> = {};
      for (const field of fields) {
        if (formValues[field.key]) credentials[field.key] = formValues[field.key];
      }
      const legacyId = LEGACY_PROVIDER_MAP[provider.id] || provider.id;
      const result = await connectProvider(legacyId, credentials);
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
      setLoaded(false);
      setActiveTab("credentials");
    }
    onOpenChange(isOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-card border border-border/50 shadow-sm">
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt={provider.label}
                  className="max-h-9 max-w-9 object-contain"
                />
              ) : (
                <Sun className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-bold text-foreground">
                {provider.label}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {provider.description}
              </SheetDescription>
            </div>
            {isConnected && (
              <Badge className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 px-2.5 py-1 gap-1 shrink-0">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                Conectado
              </Badge>
            )}
          </div>

          {/* Capabilities */}
          {provider.capabilities && Object.keys(provider.capabilities).filter(k => provider.capabilities[k]).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {Object.entries(provider.capabilities).filter(([, v]) => v).map(([key]) => (
                <Badge key={key} variant="secondary" className="text-[10px] gap-1 py-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {key.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 bg-muted/50 grid grid-cols-3 h-9">
            <TabsTrigger value="credentials" className="text-xs gap-1">
              <ShieldCheck className="h-3 w-3" /> Credenciais
            </TabsTrigger>
            <TabsTrigger value="connection" className="text-xs gap-1">
              <Plug className="h-3 w-3" /> Conexão
            </TabsTrigger>
            <TabsTrigger value="help" className="text-xs gap-1">
              <HelpCircle className="h-3 w-3" /> Ajuda
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 py-4">
            {/* Credentials Tab */}
            <TabsContent value="credentials" className="mt-0 space-y-4">
              {isComingSoon && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">
                    Esta integração estará disponível em breve.
                  </span>
                </div>
              )}

              {hasFields && (
                <div className="space-y-4">
                  {fields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={`drawer-${field.key}`} className="text-xs font-semibold">
                        {field.label}
                        {!field.required && <span className="text-muted-foreground ml-1 font-normal">(opcional)</span>}
                      </Label>
                      {field.type === "select" && field.options ? (
                        <Select
                          value={formValues[field.key] || ""}
                          onValueChange={(val) => setFormValues((prev) => ({ ...prev, [field.key]: val }))}
                        >
                          <SelectTrigger id={`drawer-${field.key}`} className="h-10">
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
                            id={`drawer-${field.key}`}
                            type={field.type === "password" && showPassword[field.key] ? "text" : field.type}
                            placeholder={field.placeholder || ""}
                            value={formValues[field.key] || ""}
                            onChange={handleFieldChange(field.key)}
                            className="h-10"
                          />
                          {field.type === "password" && (
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => setShowPassword((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                              tabIndex={-1}
                            >
                              {showPassword[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
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
                <p className="text-[10px] text-muted-foreground mt-2">
                  A senha é usada apenas para autenticação e <strong>não é armazenada</strong>. Apenas o token de acesso é salvo.
                </p>
              )}
            </TabsContent>

            {/* Connection Tab */}
            <TabsContent value="connection" className="mt-0 space-y-4">
              <div className="rounded-lg border border-border/50 p-4 space-y-3">
                <h4 className="text-sm font-semibold">Status da Conexão</h4>
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", isConnected ? "bg-emerald-500" : "bg-muted-foreground")} />
                  <span className="text-sm">{isConnected ? "Conectado" : "Não configurado"}</span>
                </div>
                {isConnected && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={onSync} disabled={syncing} className="text-xs gap-1.5">
                      <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
                      Sincronizar Agora
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
                )}
              </div>
            </TabsContent>

            {/* Help Tab */}
            <TabsContent value="help" className="mt-0 space-y-4">
              {tutorial && (tutorial.steps?.length > 0 || tutorial.notes) ? (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Como obter credenciais</h4>
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
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Instruções não disponíveis para este provedor.</p>
                  <p className="text-xs mt-1">Consulte a documentação oficial do fabricante.</p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Footer Actions */}
        {hasFields && (
          <div className="px-6 py-4 border-t border-border/50 bg-muted/10">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1 h-10 rounded-xl text-sm"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isValid || saving}
                className="flex-1 h-10 rounded-xl text-sm font-semibold gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4" />
                )}
                {isConnected ? "Atualizar" : "Conectar"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
