import { useState, useRef, useMemo, useCallback } from "react";
import { Plus, Trash2, Edit2, Save, X, FileText, Eye, Upload, Download, Loader2, Globe, FileDown, Paintbrush } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
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
import { usePropostaTemplatesCrud, useSalvarPropostaTemplate, useDeletarPropostaTemplate, useAtualizarTemplateHtml } from "@/hooks/usePropostaTemplatesCrud";
import type { PropostaTemplateFull } from "@/hooks/usePropostaTemplatesCrud";
import { ProposalBuilderEditor } from "@/components/admin/proposal-builder";
import type { TemplateBlock } from "@/components/admin/proposal-builder";

/** Extract storage path from a public/signed URL for the proposta-templates bucket */
function extractStoragePath(fileUrl: string): string | null {
  // Handle both /object/public/ and /object/sign/ URL formats
  const markers = ["/proposta-templates/"];
  for (const marker of markers) {
    const idx = fileUrl.indexOf(marker);
    if (idx === -1) continue;
    let path = fileUrl.substring(idx + marker.length);
    // Remove query params
    const qIdx = path.indexOf("?");
    if (qIdx !== -1) path = path.substring(0, qIdx);
    return decodeURIComponent(path);
  }
  return null;
}

async function downloadDocx(fileUrl: string) {
  const extracted = extractStoragePath(fileUrl);
  console.log("[downloadDocx] fileUrl:", fileUrl, "| extractedPath:", extracted);
  if (!extracted) {
    console.warn("[downloadDocx] Could not extract path, trying fetch-to-blob fallback");
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileUrl.split("/").pop()?.split("?")[0] || "template.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Erro ao baixar arquivo", description: err.message, variant: "destructive" });
    }
    return;
  }
  // Normalize path — decode first to avoid double-encoding,
  // then keep as plain string for SDK (SDK handles encoding internally)
  const normalizedPath = decodeURIComponent(extracted).replace(/\+/g, " ");
  console.log("[downloadDocx] normalized path:", normalizedPath);

  // Step 1: create signed URL (avoids SDK .download() encoding issues with special chars)
  const { data: signedData, error: signedError } = await supabase.storage
    .from("proposta-templates")
    .createSignedUrl(normalizedPath, 300);

  if (signedError || !signedData?.signedUrl) {
    console.error("[downloadDocx] Signed URL error:", signedError?.message, "| path:", normalizedPath);
    toast({ title: "Erro ao baixar template", description: `${signedError?.message || "Arquivo não encontrado"} — path: ${normalizedPath}`, variant: "destructive" });
    return;
  }

  // Step 2: fetch the file using the signed URL
  const fetchResponse = await fetch(signedData.signedUrl);
  if (!fetchResponse.ok) {
    console.error("[downloadDocx] Fetch error: HTTP", fetchResponse.status, "| path:", normalizedPath);
    toast({ title: "Erro ao baixar template", description: `HTTP ${fetchResponse.status} — path: ${normalizedPath}`, variant: "destructive" });
    return;
  }

  const arrayBuffer = await fetchResponse.arrayBuffer();
  const docxBlob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const url = URL.createObjectURL(docxBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = normalizedPath.split("/").pop() || "template.docx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const GRUPOS = [
  { value: "B", label: "Grupo B (Baixa Tensão)" },
  { value: "A", label: "Grupo A (Média/Alta Tensão)" },
  { value: "AB", label: "Ambos" },
];

export function TemplatesManager() {
  const { data: templates = [], isLoading: loading, refetch: loadTemplates } = usePropostaTemplatesCrud();
  const salvarMutation = useSalvarPropostaTemplate();
  const deletarMutation = useDeletarPropostaTemplate();
  const atualizarHtmlMutation = useAtualizarTemplateHtml();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PropostaTemplateFull>>({});
  const [uploading, setUploading] = useState(false);
  const [tipoTab, setTipoTab] = useState<"html" | "docx">("html");
  const [previewTemplate, setPreviewTemplate] = useState<PropostaTemplateFull | null>(null);
  const [builderTemplate, setBuilderTemplate] = useState<PropostaTemplateFull | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!confirm("Excluir este template? Esta ação não pode ser desfeita.")) return;
    try {
      // First try to delete related records that reference this template
      const { error: versionsError } = await supabase
        .from("proposta_versoes" as any)
        .update({ template_id_used: null } as any)
        .eq("template_id_used", id);
      if (versionsError) console.warn("[TemplatesManager] Erro ao desvincular versões:", versionsError.message);

      const { error } = await supabase.from("proposta_templates").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Template excluído com sucesso" });
      loadTemplates();
    } catch (e: any) {
      console.error("[TemplatesManager] Erro ao excluir template:", e);
      toast({
        title: "Erro ao excluir template",
        description: e.message?.includes("foreign key")
          ? "Este template está vinculado a propostas existentes. Desative-o em vez de excluir."
          : e.message,
        variant: "destructive",
      });
    }
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Templates de Proposta</h2>
            <p className="text-sm text-muted-foreground">
              Gerencie modelos WEB e DOCX usados na geração de propostas
            </p>
          </div>
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
        <Button
          variant={tipoTab === "html" ? "default" : "outline"}
          size="sm"
          onClick={() => handleTabChange("html")}
          className={tipoTab === "html"
            ? "gap-2 bg-primary/10 text-primary border-primary hover:bg-primary/15 shadow-sm"
            : "gap-2 text-muted-foreground border-transparent"
          }
        >
          <Globe className="h-4 w-4" />
          WEB
          <Badge className={`text-[9px] border-0 ${tipoTab === "html" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{htmlCount}</Badge>
        </Button>
        <Button
          variant={tipoTab === "docx" ? "default" : "outline"}
          size="sm"
          onClick={() => handleTabChange("docx")}
          className={tipoTab === "docx"
            ? "gap-2 bg-primary/10 text-primary border-primary hover:bg-primary/15 shadow-sm"
            : "gap-2 text-muted-foreground border-transparent"
          }
        >
          <FileDown className="h-4 w-4" />
          DOCX
          <Badge className={`text-[9px] border-0 ${tipoTab === "docx" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{docxCount}</Badge>
        </Button>
      </div>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) cancelEdit(); }}>
        <DialogContent className="w-[90vw] max-w-[620px] p-6 gap-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingId === "new" ? "Novo template" : "Editar template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Dados do template */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4" style={{ boxShadow: "var(--shadow-xs)" }}>
              <p className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-secondary" /> Dados do template
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
              <div className="rounded-xl border border-border bg-card p-4 space-y-3" style={{ boxShadow: "var(--shadow-xs)" }}>
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
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Baixar" onClick={() => downloadDocx(form.file_url!)}>
                          <Download className="h-3 w-3" />
                        </Button>
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
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-center space-y-2">
                <Paintbrush className="h-6 w-6 text-secondary mx-auto" />
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
          <Button variant="default" onClick={startNew} className="mt-2">
            Criar primeiro template {tipoTab.toUpperCase()}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTemplates.map(t => (
            <div
              key={t.id}
              className={`flex items-center justify-between p-4 rounded-lg bg-card border border-border hover:bg-muted/50 transition-colors ${!t.ativo ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-3">
                {t.thumbnail_url ? (
                  <img src={t.thumbnail_url} alt={t.nome} className="h-9 w-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{t.nome}</p>
                    <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5">Grupo {t.grupo}</Badge>
                    <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5">{t.tipo.toUpperCase()}</Badge>
                    {t.file_url && <Badge variant="outline" className="text-[9px] text-success border-success/30 bg-success/5">📎 DOCX</Badge>}
                    {!t.ativo && <Badge variant="outline" className="text-[9px] text-destructive border-destructive/30 bg-destructive/5">Inativo</Badge>}
                  </div>
                  {t.descricao && <p className="text-xs text-muted-foreground mt-0.5">{t.descricao}</p>}
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
                <TooltipProvider delayDuration={600}>
                  {((t.tipo === "html" && t.template_html) || (t.tipo === "docx" && t.file_url)) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => setPreviewTemplate(t)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Preview</TooltipContent>
                    </Tooltip>
                  )}
                  {t.file_url && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => downloadDocx(t.file_url!)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Baixar DOCX</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-warning" onClick={() => startEdit(t)} disabled={dialogOpen}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Editar</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)} disabled={dialogOpen}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Excluir</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
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
