import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Plus, Trash2, Edit2, Save, X, FileText, Eye, Upload, Download, Loader2, Globe, FileDown, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { ProposalBuilderEditor } from "@/components/admin/proposal-builder";
import type { TemplateBlock } from "@/components/admin/proposal-builder";

interface PropostaTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  grupo: string;
  categoria: string;
  tipo: string;
  template_html: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  ativo: boolean;
  ordem: number;
}

const GRUPOS = [
  { value: "B", label: "Grupo B (Baixa Tensão)" },
  { value: "A", label: "Grupo A (Média/Alta Tensão)" },
  { value: "AB", label: "Ambos" },
];

export function TemplatesManager() {
  const [templates, setTemplates] = useState<PropostaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PropostaTemplate>>({});
  const [uploading, setUploading] = useState(false);
  const [tipoTab, setTipoTab] = useState<"html" | "docx">("html");
  const [previewTemplate, setPreviewTemplate] = useState<PropostaTemplate | null>(null);
  const [builderTemplate, setBuilderTemplate] = useState<PropostaTemplate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredTemplates = useMemo(
    () => templates.filter(t => t.tipo === tipoTab),
    [templates, tipoTab]
  );
  const htmlCount = useMemo(() => templates.filter(t => t.tipo === "html").length, [templates]);
  const docxCount = useMemo(() => templates.filter(t => t.tipo === "docx").length, [templates]);

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("proposta_templates")
      .select("id, nome, descricao, grupo, categoria, tipo, template_html, file_url, thumbnail_url, ativo, ordem")
      .order("ordem", { ascending: true });
    
    const all = (data as PropostaTemplate[]) || [];
    const htmlTemplates = all.filter(t => t.tipo === "html");
    const hasGrid = htmlTemplates.some(t => t.nome.includes("Grid"));
    const hasHibrido = htmlTemplates.some(t => t.nome.includes("Híbrido"));
    const hasDual = htmlTemplates.some(t => t.nome.includes("Dual"));
    const hasAllDefaults = hasGrid && hasHibrido && hasDual;

    // Auto-seed: if no new default templates exist, import them
    if (!hasAllDefaults) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { console.error("Auto-seed: user not authenticated"); }
        else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("tenant_id")
            .eq("user_id", user.id)
            .single();
          
          if (profile?.tenant_id) {
            // Delete legacy HTML templates (not Grid/Híbrido/Dual)
            const legacyTemplates = htmlTemplates.filter(t => 
              !t.nome.includes("Grid") && !t.nome.includes("Híbrido") && !t.nome.includes("Dual")
            );
            console.log("Auto-seed: deleting", legacyTemplates.length, "legacy HTML templates");
            for (const old of legacyTemplates) {
              const { error: delErr } = await supabase.from("proposta_templates").delete().eq("id", old.id);
              if (delErr) console.error("Auto-seed delete error:", old.id, delErr.message);
            }

            const defaults = [
              { nome: "Template Grid (On-Grid)", file: "template-grid.json", ordem: 1, check: hasGrid },
              { nome: "Template Híbrido", file: "template-hybrid.json", ordem: 2, check: hasHibrido },
              { nome: "Template Dual (Grid + Híbrido)", file: "template-dual.json", ordem: 3, check: hasDual },
            ];

            let insertedCount = 0;
            for (const def of defaults) {
              if (def.check) continue; // already exists
              const res = await fetch(`/default-templates/${def.file}`);
              console.log("Auto-seed fetch:", def.file, "status:", res.status);
              if (!res.ok) continue;
              const jsonContent = await res.text();
              console.log("Auto-seed inserting:", def.nome, "content length:", jsonContent.length);
              const { error: insErr } = await supabase.from("proposta_templates").insert({
                nome: def.nome,
                descricao: `Template padrão`,
                grupo: "B",
                categoria: "geral",
                tipo: "html",
                template_html: jsonContent,
                ativo: true,
                ordem: def.ordem,
                tenant_id: profile.tenant_id,
                variaveis_disponiveis: {},
              } as any);
              if (insErr) {
                console.error("Auto-seed insert error:", def.nome, insErr.message);
              } else {
                insertedCount++;
              }
            }

            if (insertedCount > 0) {
              // Re-fetch after seeding
              const { data: refreshed } = await supabase
                .from("proposta_templates")
                .select("id, nome, descricao, grupo, categoria, tipo, template_html, file_url, thumbnail_url, ativo, ordem")
                .order("ordem", { ascending: true });
              setTemplates((refreshed as PropostaTemplate[]) || []);
              setLoading(false);
              toast({ title: "Templates padrão importados!", description: `${insertedCount} templates WEB criados` });
              return;
            }
          }
        }
      } catch (err: any) {
        console.error("Auto-seed failed:", err.message);
      }
    }

    setTemplates(all);
    setLoading(false);
  };

  useEffect(() => { loadTemplates(); }, []);

  const seedDefaultTemplates = async () => {
    if (!confirm("Isso vai EXCLUIR todos os templates WEB existentes e criar 3 novos (Grid, Híbrido, Dual). Continuar?")) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      // 1. Delete ALL existing HTML templates for this tenant
      const { error: delErr } = await supabase
        .from("proposta_templates")
        .delete()
        .eq("tipo", "html")
        .eq("tenant_id", profile.tenant_id);
      
      if (delErr) {
        console.error("Seed: delete error", delErr);
        throw new Error("Erro ao deletar templates: " + delErr.message);
      }

      // 2. Insert 3 new templates one by one
      const defaults = [
        { nome: "Template Grid (On-Grid)", file: "template-grid.json", ordem: 1 },
        { nome: "Template Híbrido", file: "template-hybrid.json", ordem: 2 },
        { nome: "Template Dual (Grid + Híbrido)", file: "template-dual.json", ordem: 3 },
      ];

      const errors: string[] = [];
      let successCount = 0;

      for (const def of defaults) {
        try {
          const res = await fetch(`/default-templates/${def.file}`);
          if (!res.ok) {
            errors.push(`${def.nome}: fetch falhou (${res.status})`);
            continue;
          }
          const jsonContent = await res.text();
          if (!jsonContent || jsonContent.length < 100) {
            errors.push(`${def.nome}: conteúdo vazio ou inválido`);
            continue;
          }

          const { error: insErr } = await supabase.from("proposta_templates").insert({
            nome: def.nome,
            descricao: "Template padrão",
            grupo: "B",
            categoria: "geral",
            tipo: "html",
            template_html: jsonContent,
            ativo: true,
            ordem: def.ordem,
            tenant_id: profile.tenant_id,
            variaveis_disponiveis: {},
          } as any);

          if (insErr) {
            errors.push(`${def.nome}: ${insErr.message}`);
          } else {
            successCount++;
          }
        } catch (fetchErr: any) {
          errors.push(`${def.nome}: ${fetchErr.message}`);
        }
      }

      if (errors.length > 0) {
        console.error("Seed errors:", errors);
        toast({ 
          title: `${successCount}/3 templates criados`, 
          description: errors.join("; "), 
          variant: successCount === 0 ? "destructive" : "default" 
        });
      } else {
        toast({ title: "3 templates importados com sucesso!" });
      }

      loadTemplates();
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const startNew = () => {
    setEditingId("new");
    setForm({ nome: "", descricao: "", grupo: "B", categoria: "geral", tipo: tipoTab, template_html: "", file_url: null, ativo: true, ordem: templates.length });
  };

  const startEdit = (t: PropostaTemplate) => {
    setEditingId(t.id);
    setForm({ ...t });
  };

  const cancelEdit = () => { setEditingId(null); setForm({}); };

  const handleTabChange = (tab: "html" | "docx") => {
    cancelEdit();
    setTipoTab(tab);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".docx")) {
      toast({ title: "Apenas arquivos .docx são aceitos", variant: "destructive" });
      return;
    }

    const MAX_SIZE_MB = 50;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: `Arquivo excede o limite de ${MAX_SIZE_MB}MB`, variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      await supabase.auth.refreshSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const fileName = `${profile.tenant_id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("proposta-templates")
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("proposta-templates")
        .getPublicUrl(fileName);

      setForm(f => ({ ...f, file_url: urlData.publicUrl, tipo: "docx" }));
      toast({ title: "Arquivo enviado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.nome || !form.grupo) {
      toast({ title: "Preencha nome e grupo", variant: "destructive" });
      return;
    }

    if (form.tipo === "docx" && !form.file_url) {
      toast({ title: "Faça upload do arquivo DOCX", variant: "destructive" });
      return;
    }

    try {
      // Get tenant_id for insert
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const payload = {
        nome: form.nome,
        descricao: form.descricao || null,
        grupo: form.grupo,
        categoria: form.categoria || "geral",
        tipo: form.tipo || "html",
        template_html: form.tipo === "html" ? (form.template_html || null) : null,
        file_url: form.tipo === "docx" ? (form.file_url || null) : null,
        thumbnail_url: form.thumbnail_url || null,
        ativo: form.ativo ?? true,
        ordem: form.ordem ?? 0,
        variaveis_disponiveis: {} as Record<string, unknown>,
        tenant_id: profile.tenant_id,
      };

      if (editingId === "new") {
        const { error } = await supabase.from("proposta_templates").insert(payload as any);
        if (error) throw error;
        toast({ title: "Template criado!" });
      } else {
        const { variaveis_disponiveis, tenant_id, ...updatePayload } = payload;
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

  const handleBuilderSave = useCallback(async (jsonData: string) => {
    if (!builderTemplate) return;
    const { error } = await supabase
      .from("proposta_templates")
      .update({ template_html: jsonData } as any)
      .eq("id", builderTemplate.id);
    if (error) throw error;
    loadTemplates();
  }, [builderTemplate]);

  const isDocx = form.tipo === "docx";
  const dialogOpen = editingId !== null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-secondary" /> Templates de proposta
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie modelos WEB e DOCX usados na geração de propostas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={seedDefaultTemplates} className="gap-1.5 text-xs" disabled={loading}>
            <Download className="h-3 w-3" /> Importar Padrões
          </Button>
          <Button onClick={startNew} className="gap-1.5" disabled={dialogOpen}>
            <Plus className="h-4 w-4" /> Novo template
          </Button>
        </div>
      </div>

      {/* Tipo Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/40 w-fit">
        <button
          onClick={() => handleTabChange("html")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tipoTab === "html"
              ? "bg-secondary text-secondary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="h-4 w-4" />
          WEB
          <Badge className="text-[9px] bg-secondary/80 text-secondary-foreground border-0">{htmlCount}</Badge>
        </button>
        <button
          onClick={() => handleTabChange("docx")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tipoTab === "docx"
              ? "bg-secondary text-secondary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileDown className="h-4 w-4" />
          DOCX
          <Badge className="text-[9px] bg-secondary/80 text-secondary-foreground border-0">{docxCount}</Badge>
        </button>
      </div>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) cancelEdit(); }}>
        <DialogContent className="sm:max-w-[620px] p-6 gap-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingId === "new" ? "Novo template" : "Editar template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Dados do template */}
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-4">
              <p className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Dados do template
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Nome *</Label>
                  <Input value={form.nome || ""} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Modelo Premium" className="h-9 text-sm bg-background" />
                </div>
                <div>
                  <Label className="text-xs font-medium">Descrição</Label>
                  <Input value={form.descricao || ""} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Template com layout moderno" className="h-9 text-sm bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-medium">Grupo</Label>
                  <Select value={form.grupo || "B"} onValueChange={v => setForm(f => ({ ...f, grupo: v }))}>
                    <SelectTrigger className="h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>{GRUPOS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Tipo</Label>
                  <div className="h-9 flex items-center px-3 rounded-md border border-border/40 bg-muted/30 text-sm font-medium text-muted-foreground">
                    {form.tipo === "docx" ? "📄 DOCX (Word)" : "🎨 WEB (Editor Visual)"}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium">Ordem</Label>
                  <Input type="number" value={form.ordem ?? 0} onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))}
                    className="h-9 text-sm bg-background" />
                </div>
              </div>
            </div>

            {/* Conteúdo — only for DOCX */}
            {isDocx && (
              <div className="rounded-xl border-2 border-secondary/30 bg-secondary/5 p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Upload className="h-4 w-4 text-secondary" />
                  Arquivo DOCX
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs bg-background"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      {uploading ? "Enviando..." : "Upload DOCX"}
                    </Button>
                    {form.file_url && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] gap-1 text-success border-success/30 bg-success/5">
                          <FileText className="h-3 w-3" /> {form.file_url.split("/").pop()?.replace(/^\d+_/, "") || "Arquivo anexado"}
                        </Badge>
                        <a href={form.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Baixar">
                            <Download className="h-3 w-3" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          title="Remover arquivo"
                          onClick={() => setForm(f => ({ ...f, file_url: null }))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Limite de 50MB. Use variáveis no formato <code className="text-secondary bg-secondary/10 px-1 rounded">[campo]</code> ou{" "}
                    <code className="text-secondary bg-secondary/10 px-1 rounded">{"{{grupo.campo}}"}</code> dentro do DOCX
                  </p>
                </div>
              </div>
            )}

            {/* For WEB templates: hint to use Visual Builder */}
            {!isDocx && (
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-center space-y-2">
                <Paintbrush className="h-6 w-6 text-primary mx-auto" />
                <p className="text-sm font-medium text-foreground">Conteúdo editado via Editor Visual</p>
                <p className="text-xs text-muted-foreground">
                  Após salvar os dados básicos, use o botão <strong>"Editar Visual"</strong> na lista para abrir o editor drag & drop.
                </p>
              </div>
            )}

            {/* Opções */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.ativo ?? true} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
                <Label className="text-xs font-medium">Ativo</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="h-3 w-3 mr-1" /> Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={uploading}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto opacity-20 mb-3" />
          <p className="text-sm">Nenhum template {tipoTab === "html" ? "WEB" : "DOCX"} criado.</p>
          <Button variant="link" onClick={startNew} className="mt-2">
            Criar primeiro template {tipoTab.toUpperCase()}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTemplates.map(t => (
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
                        {t.file_url && <Badge variant="outline" className="text-[9px] text-success border-success/30">📎 DOCX</Badge>}
                        {!t.ativo && <Badge variant="destructive" className="text-[9px]">Inativo</Badge>}
                      </div>
                      {t.descricao && <p className="text-[11px] text-muted-foreground">{t.descricao}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {t.tipo === "html" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-[10px] font-semibold border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => setBuilderTemplate(t)}
                      >
                        <Paintbrush className="h-3 w-3" />
                        Editar Visual
                      </Button>
                    )}
                    {((t.tipo === "html" && t.template_html) || (t.tipo === "docx" && t.file_url)) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-secondary" onClick={() => setPreviewTemplate(t)} title="Preview com dados reais">
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                    {t.file_url && (
                      <a href={t.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Baixar DOCX">
                          <Download className="h-3 w-3" />
                        </Button>
                      </a>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(t)} disabled={dialogOpen}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => handleDelete(t.id)} disabled={dialogOpen}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      {previewTemplate && (previewTemplate.template_html || previewTemplate.file_url) && (
        <TemplatePreviewDialog
          open={!!previewTemplate}
          onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}
          templateHtml={previewTemplate.template_html}
          templateNome={previewTemplate.nome}
          templateId={previewTemplate.id}
          templateTipo={previewTemplate.tipo as "html" | "docx"}
          fileUrl={previewTemplate.file_url}
        />
      )}

      {/* Visual Builder Overlay */}
      {builderTemplate && (
        <ProposalBuilderEditor
          initialData={(() => {
            try {
              const parsed = JSON.parse(builderTemplate.template_html || "[]");
              return Array.isArray(parsed) ? parsed as TemplateBlock[] : [];
            } catch {
              return [];
            }
          })()}
          templateName={builderTemplate.nome}
          onSave={handleBuilderSave}
          onClose={() => setBuilderTemplate(null)}
        />
      )}
    </div>
  );
}
