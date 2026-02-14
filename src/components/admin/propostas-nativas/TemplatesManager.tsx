import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Save, X, FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PropostaTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  grupo: string;
  categoria: string;
  tipo: string;
  template_html: string | null;
  thumbnail_url: string | null;
  ativo: boolean;
  ordem: number;
}

const GRUPOS = [
  { value: "B", label: "Grupo B (Baixa Tensão)" },
  { value: "A", label: "Grupo A (Média/Alta Tensão)" },
  { value: "AB", label: "Ambos" },
];

const TIPOS = [
  { value: "html", label: "HTML" },
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
];

export function TemplatesManager() {
  const [templates, setTemplates] = useState<PropostaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PropostaTemplate>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("proposta_templates")
      .select("id, nome, descricao, grupo, categoria, tipo, template_html, thumbnail_url, ativo, ordem")
      .order("ordem", { ascending: true });
    setTemplates((data as PropostaTemplate[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadTemplates(); }, []);

  const startNew = () => {
    setEditingId("new");
    setForm({ nome: "", descricao: "", grupo: "B", categoria: "geral", tipo: "html", template_html: "", ativo: true, ordem: templates.length });
  };

  const startEdit = (t: PropostaTemplate) => {
    setEditingId(t.id);
    setForm({ ...t });
  };

  const cancelEdit = () => { setEditingId(null); setForm({}); };

  const handleSave = async () => {
    if (!form.nome || !form.grupo) {
      toast({ title: "Preencha nome e grupo", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        nome: form.nome,
        descricao: form.descricao || null,
        grupo: form.grupo,
        categoria: form.categoria || "geral",
        tipo: form.tipo || "html",
        template_html: form.template_html || null,
        thumbnail_url: form.thumbnail_url || null,
        ativo: form.ativo ?? true,
        ordem: form.ordem ?? 0,
        variaveis_disponiveis: {} as Record<string, unknown>,
      };

      if (editingId === "new") {
        const { error } = await supabase.from("proposta_templates").insert(payload as any);
        if (error) throw error;
        toast({ title: "Template criado!" });
      } else {
        const { variaveis_disponiveis, ...updatePayload } = payload;
        const { error } = await supabase.from("proposta_templates").update(updatePayload as any).eq("id", editingId!);
        if (error) throw error;
        toast({ title: "Template atualizado!" });
      }
      cancelEdit();
      loadTemplates();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    await supabase.from("proposta_templates").delete().eq("id", id);
    toast({ title: "Template excluído" });
    loadTemplates();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Templates de Proposta
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os modelos HTML usados na geração de propostas
          </p>
        </div>
        <Button onClick={startNew} className="gap-1.5" disabled={editingId !== null}>
          <Plus className="h-4 w-4" /> Novo Template
        </Button>
      </div>

      {/* Edit Form */}
      {editingId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={form.nome || ""} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Modelo Premium" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Input value={form.descricao || ""} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Template com layout moderno" className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Grupo</Label>
                <Select value={form.grupo || "B"} onValueChange={v => setForm(f => ({ ...f, grupo: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{GRUPOS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo || "html"} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ordem</Label>
                <Input type="number" value={form.ordem ?? 0} onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))}
                  className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">HTML do Template</Label>
              <Textarea value={form.template_html || ""} onChange={e => setForm(f => ({ ...f, template_html: e.target.value }))}
                placeholder="<html>...</html>" className="min-h-[200px] text-xs font-mono" />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use placeholders como {"{{cliente_nome}}"}, {"{{valor_total}}"}, {"{{potencia_kwp}}"} etc.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.ativo ?? true} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
                <Label className="text-xs">Ativo</Label>
              </div>
              {form.template_html && (
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setPreviewHtml(form.template_html || null)}>
                  <Eye className="h-3 w-3" /> Preview
                </Button>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="h-3 w-3 mr-1" /> Cancelar</Button>
              <Button size="sm" onClick={handleSave}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {previewHtml && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Preview</p>
              <Button variant="ghost" size="sm" onClick={() => setPreviewHtml(null)}><X className="h-3 w-3" /></Button>
            </div>
            <div className="border rounded-xl overflow-hidden bg-white" style={{ maxHeight: 400, overflow: "auto" }}>
              <iframe srcDoc={previewHtml} title="Template Preview" className="w-full border-0" style={{ height: 500, pointerEvents: "none" }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 && !editingId ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto opacity-20 mb-3" />
          <p className="text-sm">Nenhum template criado.</p>
          <Button variant="link" onClick={startNew} className="mt-2">Criar primeiro template</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <Card key={t.id} className={`border-border/40 ${!t.ativo ? "opacity-50" : ""}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {t.thumbnail_url ? (
                      <img src={t.thumbnail_url} alt={t.nome} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted/50 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{t.nome}</p>
                        <Badge variant="outline" className="text-[9px]">Grupo {t.grupo}</Badge>
                        <Badge variant="secondary" className="text-[9px]">{t.tipo.toUpperCase()}</Badge>
                        {!t.ativo && <Badge variant="destructive" className="text-[9px]">Inativo</Badge>}
                      </div>
                      {t.descricao && <p className="text-[11px] text-muted-foreground">{t.descricao}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(t)} disabled={editingId !== null}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => handleDelete(t.id)} disabled={editingId !== null}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
