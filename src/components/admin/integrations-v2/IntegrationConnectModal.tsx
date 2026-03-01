import React, { useState, useEffect } from "react";
import { FormModalTemplate } from "@/components/ui-kit/FormModalTemplate";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { connectProvider } from "@/services/integrations/integrationService";
import type { IntegrationProvider, CredentialField } from "@/services/integrations/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LEGACY_ID_MAP } from "@/services/monitoring/providerRegistry";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: IntegrationProvider;
  onSuccess: () => void;
}

// Reverse mapping: canonical → legacy (for edge functions / monitoring_integrations)
const LEGACY_PROVIDER_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_ID_MAP).map(([legacy, canonical]) => [canonical, legacy])
);

export function IntegrationConnectModal({ open, onOpenChange, provider, onSuccess }: Props) {
  const [saving, setSaving] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  // Pre-fill form with saved credentials when opening for an existing connection
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
          const fields = (provider.credential_schema || []) as CredentialField[];
          const prefilled: Record<string, string> = {};
          for (const field of fields) {
            const val = merged[field.key];
            if (val && typeof val === "string" && !isSecretValue(field, val)) {
              prefilled[field.key] = val;
            }
          }
          if (Object.keys(prefilled).length > 0) {
            setFormValues(prefilled);
          }
        }
      } catch {
        // Silently fail — user can still fill manually
      }
      setLoaded(true);
    })();
  }, [open, provider.id, loaded]);

  // Don't pre-fill password/secret fields with actual values
  function isSecretValue(field: CredentialField, value: string): boolean {
    if (field.type === "password") return true;
    const secretKeys = ["secret", "password", "token", "apiSecret", "appSecret"];
    return secretKeys.some((k) => field.key.toLowerCase().includes(k.toLowerCase()));
  }

  const fields = (provider.credential_schema || []) as CredentialField[];
  const tutorial = provider.tutorial;
  const isComingSoon = provider.status === "coming_soon";
  const hasFields = fields.length > 0 && !isComingSoon;

  const handleFieldChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const isValid = fields.every((f) => !f.required || (formValues[f.key] && formValues[f.key].trim() !== ""));

  // Map new provider IDs to legacy IDs used by edge functions
  const LEGACY_MAP: Record<string, string> = LEGACY_PROVIDER_MAP;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const credentials: Record<string, string> = {};
      for (const field of fields) {
        if (formValues[field.key]) credentials[field.key] = formValues[field.key];
      }
      const legacyId = LEGACY_MAP[provider.id] || provider.id;
      const result = await connectProvider(legacyId, credentials);
      if (result.success) {
        toast.success(`${provider.label} conectado com sucesso!`);
        onOpenChange(false);
        onSuccess();
        setFormValues({});
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
    }
    onOpenChange(isOpen);
  };

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={handleOpenChange}
      title={isComingSoon ? provider.label : `Conectar ${provider.label}`}
      submitLabel={isComingSoon ? undefined : "Conectar"}
      onSubmit={isComingSoon ? undefined : handleSubmit}
      disabled={!isValid}
      saving={saving}
      asForm={hasFields}
    >
      {/* Status badges */}
      {isComingSoon && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="text-sm text-muted-foreground">
            Esta integração estará disponível em breve.
          </span>
        </div>
      )}

      {/* Capabilities */}
      {provider.capabilities && Object.keys(provider.capabilities).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Recursos</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(provider.capabilities).filter(([, v]) => v).map(([key]) => (
              <Badge key={key} variant="secondary" className="text-2xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {key.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tutorial */}
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
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
                    {tutorial.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                )}
                {tutorial.notes && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-info pl-3">
                    {tutorial.notes}
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Dynamic credential fields */}
      {hasFields && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`field-${field.key}`}>
                {field.label}
                {!field.required && <span className="text-muted-foreground ml-1">(opcional)</span>}
              </Label>
              {field.type === "select" && field.options ? (
                <Select
                  value={formValues[field.key] || ""}
                  onValueChange={(val) => setFormValues((prev) => ({ ...prev, [field.key]: val }))}
                >
                  <SelectTrigger id={`field-${field.key}`}>
                    <SelectValue placeholder={field.placeholder || "Selecione..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((opt: { value: string; label: string }) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={`field-${field.key}`}
                  type={field.type}
                  placeholder={field.placeholder || ""}
                  value={formValues[field.key] || ""}
                  onChange={handleFieldChange(field.key)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {fields.some((f) => f.key === "password") && (
        <p className="text-2xs text-muted-foreground">
          A senha é usada apenas para autenticação e <strong>não é armazenada</strong>. Apenas o token de acesso é salvo.
        </p>
      )}
    </FormModalTemplate>
  );
}
