import React, { useState } from "react";
import { FormModalTemplate } from "@/components/ui-kit/FormModalTemplate";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { connectProvider } from "@/services/monitoring/monitoringService";
import { getTutorial } from "@/services/monitoring/providerTutorials";
import type { ProviderDefinition, ProviderMode } from "@/services/monitoring/providerRegistry";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Info } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderDefinition;
  onSuccess: () => void;
}

export function ConnectProviderModal({ open, onOpenChange, provider, onSuccess }: Props) {
  const [saving, setSaving] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>(provider.modes[0]?.id || "api");
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const currentMode = provider.modes.find((m) => m.id === selectedMode) || provider.modes[0];
  const tutorial = getTutorial(provider.id, selectedMode);

  const handleFieldChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const isValid = currentMode?.fields.every(
    (f) => !f.required || (formValues[f.key] && formValues[f.key].trim() !== "")
  );

  const handleSubmit = async () => {
    if (!currentMode) return;
    setSaving(true);
    try {
      const credentials: Record<string, string> = {};
      for (const field of currentMode.fields) {
        credentials[field.key] = formValues[field.key] || "";
      }

      const result = await connectProvider(provider.id, credentials, selectedMode);
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
      setSelectedMode(provider.modes[0]?.id || "api");
    }
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
      {/* Mode selector */}
      {provider.modes.length > 1 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Modo de conexão</Label>
          <RadioGroup value={selectedMode} onValueChange={setSelectedMode} className="flex flex-col gap-2">
            {provider.modes.map((mode) => (
              <div key={mode.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value={mode.id} id={`mode-${mode.id}`} className="mt-0.5" />
                <label htmlFor={`mode-${mode.id}`} className="cursor-pointer flex-1">
                  <p className="text-sm font-medium">{mode.label}</p>
                  <p className="text-xs text-muted-foreground">{mode.description}</p>
                </label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}

      {/* Tutorial accordion */}
      {tutorial && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="tutorial" className="border-border">
            <AccordionTrigger className="text-sm gap-2 py-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-info" />
                <span>{tutorial.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                {tutorial.steps.map((step, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{step.title}:</span>{" "}
                    {step.content}
                  </li>
                ))}
              </ol>
              {tutorial.notes && tutorial.notes.length > 0 && (
                <div className="mt-3 p-2 rounded bg-muted text-xs space-y-1">
                  {tutorial.notes.map((note, i) => (
                    <p key={i} className="text-muted-foreground">💡 {note}</p>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Dynamic credential fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentMode?.fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
            <Input
              id={`field-${field.key}`}
              type={field.type}
              placeholder={field.placeholder}
              value={formValues[field.key] || ""}
              onChange={handleFieldChange(field.key)}
            />
          </div>
        ))}
      </div>

      <p className="text-2xs text-muted-foreground">
        A senha é usada apenas para autenticação e <strong>não é armazenada</strong>. Apenas o token
        de acesso é salvo no servidor.
      </p>
    </FormModalTemplate>
  );
}
