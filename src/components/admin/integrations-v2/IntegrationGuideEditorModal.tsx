import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, ArrowUp, ArrowDown, ImagePlus, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSaveIntegrationGuide } from "@/hooks/useIntegrationGuides";
import type { IntegrationGuide, GuideStep } from "@/hooks/useIntegrationGuides";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guide: IntegrationGuide | null;
  onSuccess: () => void;
}

export function IntegrationGuideEditorModal({ open, onOpenChange, guide, onSuccess }: Props) {
  const saveMut = useSaveIntegrationGuide();
  const [providerId, setProviderId] = useState("");
  const [title, setTitle] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [portalLabel, setPortalLabel] = useState("");
  const [warning, setWarning] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<GuideStep[]>([{ text: "" }]);
  const [uploading, setUploading] = useState<number | null>(null);

  useEffect(() => {
    if (guide) {
      setProviderId(guide.provider_id);
      setTitle(guide.title);
      setPortalUrl(guide.portal_url || "");
      setPortalLabel(guide.portal_label || "");
      setWarning(guide.warning || "");
      setIsActive(guide.is_active);
      setSteps(guide.steps?.length ? guide.steps : [{ text: "" }]);
    } else {
      setProviderId("");
      setTitle("");
      setPortalUrl("");
      setPortalLabel("");
      setWarning("");
      setIsActive(true);
      setSteps([{ text: "" }]);
    }
  }, [guide, open]);

  const updateStep = (index: number, patch: Partial<GuideStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleImageUpload = async (index: number, file: File) => {
    setUploading(index);
    try {
      const ext = file.name.split(".").pop();
      const path = `guides/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("integration-guides").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("integration-guides").getPublicUrl(path);
      updateStep(index, { image_url: urlData.publicUrl });
    } catch {
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async () => {
    if (!providerId.trim() || !title.trim()) {
      toast.error("Provider e título são obrigatórios");
      return;
    }
    const validSteps = steps.filter((s) => s.text.trim());
    if (validSteps.length === 0) {
      toast.error("Adicione pelo menos um passo");
      return;
    }

    try {
      await saveMut.mutateAsync({
        ...(guide ? { id: guide.id, tenant_id: guide.tenant_id } : {}),
        provider_id: providerId.trim(),
        title: title.trim(),
        portal_url: portalUrl.trim() || null,
        portal_label: portalLabel.trim() || null,
        warning: warning.trim() || null,
        is_active: isActive,
        steps: validSteps,
      });
      toast.success(guide ? "Guia atualizado" : "Guia criado");
      onSuccess();
    } catch {
      toast.error("Erro ao salvar guia");
    }
  };

  const isValid = providerId.trim() && title.trim() && steps.some((s) => s.text.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {guide ? "Editar Guia" : "Novo Guia de Integração"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure o passo a passo para obtenção de credenciais
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            {/* Basic fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Provider ID *</Label>
                <Input
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  placeholder="ex: solis_cloud"
                  disabled={!!guide}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Como obter sua API Key"
                />
              </div>
              <div className="space-y-1.5">
                <Label>URL do Portal</Label>
                <Input
                  value={portalUrl}
                  onChange={(e) => setPortalUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Label do Botão</Label>
                <Input
                  value={portalLabel}
                  onChange={(e) => setPortalLabel(e.target.value)}
                  placeholder="Abrir Portal"
                />
              </div>
            </div>

            {/* Warning */}
            <div className="space-y-1.5">
              <Label>Aviso (opcional)</Label>
              <Textarea
                value={warning}
                onChange={(e) => setWarning(e.target.value)}
                placeholder="Ex: Crie um usuário dedicado para API"
                rows={2}
              />
              {warning.trim() && (
                <div className="flex gap-2 p-2.5 rounded-md bg-warning/10 border border-warning/20 text-xs text-warning mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {warning}
                </div>
              )}
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label className="text-sm text-muted-foreground">Guia ativo</Label>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Passos</Label>
              <div className="rounded-lg bg-muted/30 border border-border p-4 space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold mt-1">
                        {i + 1}
                      </span>
                      <Textarea
                        value={step.text}
                        onChange={(e) => updateStep(i, { text: e.target.value })}
                        placeholder="Descreva o passo..."
                        rows={2}
                        className="flex-1 text-sm"
                      />
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveStep(i, -1)}
                          disabled={i === 0}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveStep(i, 1)}
                          disabled={i === steps.length - 1}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          onClick={() => removeStep(i)}
                          disabled={steps.length <= 1}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Image upload */}
                    {step.image_url ? (
                      <div className="relative inline-block ml-8">
                        <img
                          src={step.image_url}
                          alt={`Passo ${i + 1}`}
                          className="max-h-32 rounded-md object-cover border border-border"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 bg-destructive/90 text-destructive-foreground hover:bg-destructive rounded-full"
                          onClick={() => updateStep(i, { image_url: undefined })}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="ml-8 flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <ImagePlus className="w-4 h-4" />
                        {uploading === i ? "Enviando…" : "Adicionar imagem"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(i, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => setSteps((prev) => [...prev, { text: "" }])}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar passo
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveMut.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || saveMut.isPending}>
            {saveMut.isPending ? "Salvando…" : guide ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
