import React, { useState } from "react";
import { FormModalTemplate } from "@/components/ui-kit/FormModalTemplate";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { connectProvider } from "@/services/monitoring/monitorService";
import { getTutorial } from "@/services/monitoring/providerTutorials";
import type { ProviderDefinition } from "@/services/monitoring/providerRegistry";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Info, Eye, EyeOff } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderDefinition;
  onSuccess: () => void;
}

export function ConnectProviderModal({ open, onOpenChange, provider, onSuccess }: Props) {
  const [saving, setSaving] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  const tutorial = getTutorial(provider.id);

  const handleFieldChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const isValid = provider.fields.every(
    (f) => !f.required || (formValues[f.key] && formValues[f.key].trim() !== "")
  );

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const credentials: Record<string, string> = {};
      for (const field of provider.fields) {
        if (formValues[field.key]) {
          credentials[field.key] = formValues[field.key];
        }
      }

      const result = await connectProvider(provider.id, credentials);
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
    if (!isOpen) setFormValues({});
    onOpenChange(isOpen);
  };

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={handleOpenChange}
      title={`Conectar ${provider.label}`}
      submitLabel="Conectar"
      onSubmit={handleSubmit}
      disabled={!isValid}
      saving={saving}
      asForm
    >
      {/* Tutorial */}
      {tutorial && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="tutorial" className="border-border">
            <AccordionTrigger className="text-sm gap-2 py-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-info" />
                <span>Como obter credenciais</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-sans leading-relaxed">
                {tutorial}
              </pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Dynamic credential fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {provider.fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
            {field.type === "select" && field.options ? (
              <Select
                value={formValues[field.key] || ""}
                onValueChange={(val) => setFormValues((prev) => ({ ...prev, [field.key]: val }))}
              >
                <SelectTrigger id={`field-${field.key}`}>
                  <SelectValue placeholder={field.placeholder} />
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
                  id={`field-${field.key}`}
                  type={field.type === "password" && showPassword[field.key] ? "text" : field.type}
                  placeholder={field.placeholder}
                  value={formValues[field.key] || ""}
                  onChange={handleFieldChange(field.key)}
                />
                {field.type === "password" && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                    tabIndex={-1}
                  >
                    {showPassword[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            )}
            {field.helperText && (
              <p className="text-2xs text-muted-foreground">{field.helperText}</p>
            )}
          </div>
        ))}
      </div>

      {provider.fields.some((f) => f.key === "password") && (
        <p className="text-2xs text-muted-foreground">
          A senha é usada apenas para autenticação e <strong>não é armazenada</strong>. Apenas o token
          de acesso é salvo no servidor.
        </p>
      )}
    </FormModalTemplate>
  );
}
