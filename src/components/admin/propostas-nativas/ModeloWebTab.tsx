import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Loader2, FileText, GripVertical, Eye, Pencil } from "lucide-react";
import { usePropostaTemplates, useRefreshPropostaTemplates } from "@/hooks/useConfSolar";
import { useAtualizarTemplateHtml } from "@/hooks/usePropostaTemplatesCrud";
import { ProposalBuilderEditor } from "@/components/admin/proposal-builder";
import type { TemplateBlock } from "@/components/admin/proposal-builder/types";
import { BlockRenderer } from "@/components/admin/proposal-builder/BlockRenderer";
import { buildTree } from "@/components/admin/proposal-builder/treeUtils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TemplateRow {
  id: string;
  nome: string;
  descricao: string | null;
  grupo: string;
  categoria: string;
  tipo: string;
  ativo: boolean;
  ordem: number;
  thumbnail_url: string | null;
  template_html: string | null;
  isNew?: boolean;
}

export function TemplatesTab() {
  const { data: serverData, isLoading: loading } = usePropostaTemplates();
  const refreshTemplates = useRefreshPropostaTemplates();
  const atualizarHtml = useAtualizarTemplateHtml();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);

  useEffect(() => {
    if (serverData && !initialized) {
      setTemplates(serverData as unknown as TemplateRow[]);
      setInitialized(true);
    }
  }, [serverData]);

  function addTemplate() {
    setTemplates([...templates, {
      id: crypto.randomUUID(), nome: "", descricao: null, grupo: "B",
      categoria: "padrao", tipo: "html", ativo: true, ordem: templates.length,
      thumbnail_url: null, template_html: null, isNew: true,
    }]);
  }

  function removeTemplate(idx: number) {
    setTemplates(templates.filter((_, i) => i !== idx));
  }

  function updateTemplate(idx: number, key: keyof TemplateRow, value: any) {
    const updated = [...templates];
    updated[idx] = { ...updated[idx], [key]: value };
    setTemplates(updated);
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const tpl of templates) {
        const { isNew, id, ...payload } = tpl;
        if (isNew) {
          const { error } = await supabase.from("proposta_templates").insert(payload as any);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("proposta_templates").update(payload as any).eq("id", id);
          if (error) throw error;
        }
      }
      toast({ title: "Templates salvos com sucesso" });
      setInitialized(false);
      refreshTemplates();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  }

  const handleBuilderSave = useCallback(async (jsonData: string) => {
    if (!editingTemplate) return;
    await atualizarHtml.mutateAsync({ id: editingTemplate.id, template_html: jsonData });
    // Update local state too
    setTemplates(prev => prev.map(t =>
      t.id === editingTemplate.id ? { ...t, template_html: jsonData } : t
    ));
  }, [editingTemplate, atualizarHtml]);

  const parseInitialData = useCallback((): TemplateBlock[] | undefined => {
    if (!editingTemplate?.template_html) return undefined;
    try {
      const parsed = JSON.parse(editingTemplate.template_html);
      if (Array.isArray(parsed)) return parsed as TemplateBlock[];
    } catch {
      // not valid JSON — might be raw HTML, ignore
    }
    return undefined;
  }, [editingTemplate]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  // Show builder fullscreen when editing
  if (editingTemplate) {
    return (
      <ProposalBuilderEditor
        initialData={parseInitialData()}
        templateName={editingTemplate.nome || "Template sem nome"}
        onSave={handleBuilderSave}
        onClose={() => setEditingTemplate(null)}
      />
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Templates de Proposta
        </CardTitle>
        <Button variant="default" size="sm" onClick={addTemplate} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Novo Template
        </Button>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum template cadastrado. Crie o primeiro para gerar propostas.
          </p>
        ) : (
          <div className="space-y-4">
            {templates.map((t, i) => (
              <div key={t.id} className="border border-border/60 rounded-xl p-4 space-y-3 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <Badge variant={t.ativo ? "default" : "secondary"} className="text-[10px]">
                      {t.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <span className="text-xs font-semibold">{t.nome || `Template ${i + 1}`}</span>
                  </div>
                   <div className="flex items-center gap-2">
                     {t.tipo === "html" && !t.isNew && (
                       <Button
                         variant="outline"
                         size="sm"
                         className="h-7 text-xs gap-1.5"
                         onClick={() => setEditingTemplate(t)}
                       >
                         <Pencil className="h-3.5 w-3.5" />
                         Editar Visual
                       </Button>
                     )}
                     {t.template_html && (
                       <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewHtml(t.template_html)}>
                         <Eye className="h-3.5 w-3.5" />
                       </Button>
                     )}
                     <Switch checked={t.ativo} onCheckedChange={(v) => updateTemplate(i, "ativo", v)} />
                     <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeTemplate(i)}>
                       <Trash2 className="h-3.5 w-3.5" />
                     </Button>
                   </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[10px] text-muted-foreground">Nome</Label>
                    <Input value={t.nome} onChange={(e) => updateTemplate(i, "nome", e.target.value)} placeholder="Ex: Proposta Premium" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Grupo</Label>
                    <Select value={t.grupo} onValueChange={(v) => updateTemplate(i, "grupo", v)}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Grupo A</SelectItem>
                        <SelectItem value="B">Grupo B</SelectItem>
                        <SelectItem value="ambos">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                    <Select value={t.tipo} onValueChange={(v) => updateTemplate(i, "tipo", v)}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="html">HTML</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="docx">DOCX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Descrição</Label>
                  <Textarea
                    value={t.descricao || ""}
                    onChange={(e) => updateTemplate(i, "descricao", e.target.value)}
                    placeholder="Breve descrição do template..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Templates
          </Button>
        </div>
      </CardContent>

      {/* Preview Modal — renders blocks visually */}
      <Dialog open={!!previewHtml} onOpenChange={(open) => { if (!open) setPreviewHtml(null); }}>
        <DialogContent className="w-[90vw] max-w-5xl max-h-[calc(100dvh-2rem)] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">Preview do Template</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Visualização da proposta web como o cliente verá</p>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <PreviewRenderer jsonData={previewHtml} />
          </ScrollArea>
          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
            <Button variant="outline" onClick={() => setPreviewHtml(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
