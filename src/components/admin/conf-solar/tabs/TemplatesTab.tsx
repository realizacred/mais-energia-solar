import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Loader2, FileText, GripVertical, Eye, X } from "lucide-react";

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
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("proposta_templates")
      .select("id, nome, descricao, grupo, categoria, tipo, ativo, ordem, thumbnail_url, template_html")
      .order("ordem", { ascending: true });
    if (error) toast({ title: "Erro ao carregar templates", description: error.message, variant: "destructive" });
    setTemplates((data as unknown as TemplateRow[]) || []);
    setLoading(false);
  }

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
      await loadData();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Templates de Proposta
        </CardTitle>
        <Button variant="outline" size="sm" onClick={addTemplate} className="gap-1.5 text-xs">
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
                   <div className="flex items-center gap-3">
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

      {/* Preview Modal */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setPreviewHtml(null)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-semibold">Preview do Template</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewHtml(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto bg-white rounded-b-xl">
              <iframe srcDoc={previewHtml} title="Preview" className="w-full border-0" style={{ height: 600, pointerEvents: "none" }} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
