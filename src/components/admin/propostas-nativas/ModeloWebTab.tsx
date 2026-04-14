import { useEffect, useState, useCallback, useMemo } from "react";
import { Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrandSettings } from "@/hooks/useBrandSettings";
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
import { Plus, Trash2, Save, Loader2, FileText, GripVertical, Eye, Pencil, Sparkles } from "lucide-react";
import { usePropostaTemplates, useRefreshPropostaTemplates } from "@/hooks/useConfSolar";
import { useAtualizarTemplateHtml } from "@/hooks/usePropostaTemplatesCrud";
import { ProposalBuilderEditor } from "@/components/admin/proposal-builder";
import type { TemplateBlock } from "@/components/admin/proposal-builder/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TemplateFinalPreview } from "@/components/proposal-landing/TemplateFinalPreview";
import { VARIABLES_CATALOG } from "@/lib/variablesCatalog";
import { createDefaultTemplateBlocks, type TemplateStyle } from "@/components/admin/proposal-builder/defaultTemplateBlocks";

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
/** Renders block JSON as a visual preview (read-only) */
const TEMPLATE_PREVIEW_VARIABLES: Record<string, string> = VARIABLES_CATALOG.reduce<Record<string, string>>((acc, variable) => {
  acc[variable.legacyKey] = variable.example;
  acc[variable.canonicalKey] = variable.example;

  const canonicalWithoutBraces = variable.canonicalKey.replace(/^\{\{/, "").replace(/\}\}$/, "");
  acc[canonicalWithoutBraces] = variable.example;

  return acc;
}, {
  cliente_nome: "João Silva",
  cliente_cidade: "Belo Horizonte",
  cliente_estado: "MG",
  empresa_nome: "Mais Energia Solar",
  potencia_kwp: "8,20",
  economia_percentual: "93",
  geracao_media_mensal: "1.120",
  geracao_mensal: "1.120",
  modulo_quantidade: "16",
  modulo_fabricante: "Canadian Solar",
  modulo_modelo: "HiKu 550W",
  modulo_potencia: "550 Wp",
  modulo_eficiencia: "21,3",
  inversor_fabricante: "Growatt",
  inversor_modelo: "MID 10KTL3-X",
  inversor_garantia: "10 anos",
  valor_total: "42.500,00",
  economia_anual: "6.960,00",
  economia_25_anos: "174.000,00",
  co2_evitado_ton_ano: "1,8",
  payback: "4,8",
  payback_meses: "58",
  economia_mensal: "580,00",
});

function PreviewRenderer({ jsonData }: { jsonData: string | null }) {
  const { settings: brandSettings } = useBrandSettings();
  const blocks = useMemo(() => {
    if (!jsonData) return [];
    try {
      const parsed = JSON.parse(jsonData);
      if (Array.isArray(parsed)) return parsed as TemplateBlock[];
    } catch { /* ignore */ }
    return [];
  }, [jsonData]);

  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Nenhum bloco encontrado neste template
      </div>
    );
  }

  return (
    <TemplateFinalPreview
      blocks={blocks}
      variables={TEMPLATE_PREVIEW_VARIABLES}
      theme={2}
      logoUrl={brandSettings?.logo_url || brandSettings?.logo_white_url}
      companyName="Mais Energia Solar"
    />
  );
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
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (serverData && !initialized) {
      setTemplates(serverData as unknown as TemplateRow[]);
      setInitialized(true);
    }
  }, [serverData]);

  // Filter: only show active WEB templates by default, optionally show archived
  const visibleTemplates = useMemo(() => {
    return templates.filter(t => {
      if (t.tipo !== "html" && t.tipo !== "web") return false;
      if (!showArchived && !t.ativo) return false;
      return true;
    });
  }, [templates, showArchived]);

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

  const WEB_CATEGORY_MAP: Record<string, string> = {
    dashboard: "alta_conversao",
    consultivo: "consultivo",
    fechamento: "whatsapp",
    corporativo: "corporativo",
    escala: "educacional",
    impactoVisual: "alta_conversao",
    simulacaoFinanceira: "financeiro",
    hibrido: "offgrid",
    propostaRapida: "whatsapp",
    conversaoCases: "alta_conversao",
  };

  const DEFAULT_TEMPLATES_CONFIG: { style: TemplateStyle; nome: string; descricao: string }[] = [
    { style: "dashboard", nome: "Alta Conversão — Direto ao Ponto", descricao: "Visual limpo estilo Gdash com comparativo gráfico, simulador de fluxo e timeline de retorno. Mobile-first." },
    { style: "consultivo", nome: "Premium Consultivo", descricao: "Template detalhado com comparativo antes/depois, confiança e dados técnicos. Ideal para projetos maiores." },
    { style: "fechamento", nome: "Fechamento Express — WhatsApp", descricao: "Alto impacto visual com urgência e CTA forte. Ideal para envio direto ao cliente via WhatsApp." },
    { style: "corporativo", nome: "Corporativo Executivo", descricao: "Foco em ROI empresarial, multi-UC, dados técnicos detalhados. Ideal para empresas e comércios." },
    { style: "escala", nome: "Educacional — Leads", descricao: "Educativo com 'Como Funciona', construção de valor progressiva. Ideal para leads frios." },
    { style: "impactoVisual", nome: "Impacto Visual", descricao: "Tipografia grande, layout assimétrico e bold. Foco em causar impressão forte e memorável." },
    { style: "simulacaoFinanceira", nome: "Simulação Financeira", descricao: "Tabela financeira, timeline de retorno e dados analíticos. Ideal para clientes racionais." },
    { style: "hibrido", nome: "Autonomia Energética (Off-grid)", descricao: "Múltiplos inversores, bateria, estrutura e serviços inclusos. Ideal para projetos com backup." },
    { style: "propostaRapida", nome: "Proposta Rápida", descricao: "Ultra-compacto, single-scroll, tudo visível de uma vez. Perfeito para envio rápido por WhatsApp." },
    { style: "conversaoCases", nome: "Conversão com Cases", descricao: "Prova social com depoimentos, badges de confiança e cases de sucesso. Para leads indecisos." },
  ];

  async function handleSeedDefaults() {
    setSeedingDefaults(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      // Check existing names to avoid duplicates
      const existingNames = new Set(
        templates.filter(t => t.ativo && (t.tipo === "html" || t.tipo === "web")).map(t => t.nome)
      );

      let created = 0;
      let skipped = 0;
      for (let i = 0; i < DEFAULT_TEMPLATES_CONFIG.length; i++) {
        const cfg = DEFAULT_TEMPLATES_CONFIG[i];
        if (existingNames.has(cfg.nome)) {
          skipped++;
          continue;
        }
        const blocks = createDefaultTemplateBlocks("grid", cfg.style);
        const templateHtml = JSON.stringify(blocks);
        const categoria = WEB_CATEGORY_MAP[cfg.style] || "alta_conversao";
        const { error } = await supabase.from("proposta_templates").insert({
          nome: cfg.nome,
          descricao: cfg.descricao,
          grupo: "B",
          categoria,
          tipo: "html",
          template_html: templateHtml,
          ativo: true,
          ordem: templates.length + i,
          tenant_id: profile.tenant_id,
        } as any);
        if (error) throw error;
        created++;
      }
      const msg = skipped > 0 ? `${created} criados, ${skipped} já existiam` : `${created} templates criados`;
      toast({ title: msg });
      setInitialized(false);
      refreshTemplates();
    } catch (e: any) {
      toast({ title: "Erro ao criar templates", description: e.message, variant: "destructive" });
    } finally {
      setSeedingDefaults(false);
    }
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedDefaults}
            disabled={seedingDefaults}
            className="gap-1.5 text-xs"
          >
            {seedingDefaults ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Criar templates padrão
          </Button>
          <Button variant="default" size="sm" onClick={addTemplate} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Novo Template
          </Button>
        </div>
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
