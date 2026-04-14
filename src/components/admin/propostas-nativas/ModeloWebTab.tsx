import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Plus, Trash2, Save, Loader2, FileText, GripVertical, Eye, Pencil, Sparkles, Search, LayoutTemplate, Star } from "lucide-react";
import { usePropostaTemplates, useRefreshPropostaTemplates } from "@/hooks/useConfSolar";
import { useAtualizarTemplateHtml } from "@/hooks/usePropostaTemplatesCrud";
import { ProposalBuilderEditor } from "@/components/admin/proposal-builder";
import type { TemplateBlock } from "@/components/admin/proposal-builder/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TemplateFinalPreview } from "@/components/proposal-landing/TemplateFinalPreview";
import { VARIABLES_CATALOG } from "@/lib/variablesCatalog";
import { createDefaultTemplateBlocks, type TemplateStyle } from "@/components/admin/proposal-builder/defaultTemplateBlocks";
import { SearchInput } from "@/components/ui-kit/SearchInput";

// ── Types ──────────────────────────────────────────────────────

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

// ── Categories ─────────────────────────────────────────────────

type WebTemplateCategory =
  | "alta_conversao"
  | "consultivo"
  | "whatsapp"
  | "corporativo"
  | "educacional"
  | "financeiro"
  | "off_grid"
  | "cases"
  | "geral";

const WEB_CATEGORIES: { value: WebTemplateCategory; label: string }[] = [
  { value: "alta_conversao", label: "Alta Conversão" },
  { value: "consultivo", label: "Consultivo" },
  { value: "whatsapp", label: "WhatsApp / Rápido" },
  { value: "corporativo", label: "Corporativo / B2B" },
  { value: "educacional", label: "Educacional" },
  { value: "financeiro", label: "Financeiro" },
  { value: "off_grid", label: "Off-grid / Híbrido" },
  { value: "cases", label: "Cases / Social" },
  { value: "geral", label: "Geral" },
];

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  WEB_CATEGORIES.map(c => [c.value, c.label])
);

// ── Default templates config ───────────────────────────────────

interface DefaultTemplateCfg {
  style: TemplateStyle;
  nome: string;
  descricao: string;
  categoria: WebTemplateCategory;
}

const DEFAULT_TEMPLATES_CONFIG: DefaultTemplateCfg[] = [
  { style: "dashboard", nome: "Alta Conversão — Direto ao Ponto", descricao: "Visual limpo estilo Gdash com comparativo gráfico, simulador de fluxo e timeline de retorno. Mobile-first.", categoria: "alta_conversao" },
  { style: "consultivo", nome: "Premium Consultivo", descricao: "Template detalhado com comparativo antes/depois, confiança e dados técnicos. Ideal para projetos maiores.", categoria: "consultivo" },
  { style: "fechamento", nome: "Fechamento Express — WhatsApp", descricao: "Alto impacto visual com urgência e CTA forte. Ideal para envio direto ao cliente via WhatsApp.", categoria: "whatsapp" },
  { style: "corporativo", nome: "Corporativo Executivo", descricao: "Foco em ROI empresarial, multi-UC, dados técnicos detalhados. Ideal para empresas e comércios.", categoria: "corporativo" },
  { style: "escala", nome: "Educacional — Leads", descricao: "Educativo com 'Como Funciona', construção de valor progressiva. Ideal para leads frios.", categoria: "educacional" },
  { style: "impactoVisual", nome: "Impacto Visual", descricao: "Tipografia grande, layout assimétrico e bold. Foco em causar impressão forte e memorável.", categoria: "alta_conversao" },
  { style: "simulacaoFinanceira", nome: "Simulação Financeira", descricao: "Tabela financeira, timeline de retorno e dados analíticos. Ideal para clientes racionais.", categoria: "financeiro" },
  { style: "hibrido", nome: "Autonomia Energética (Off-grid)", descricao: "Múltiplos inversores, bateria, estrutura e serviços inclusos. Ideal para projetos com backup.", categoria: "off_grid" },
  { style: "propostaRapida", nome: "Proposta Rápida", descricao: "Ultra-compacto, single-scroll, tudo visível de uma vez. Perfeito para envio rápido por WhatsApp.", categoria: "whatsapp" },
  { style: "conversaoCases", nome: "Conversão com Cases", descricao: "Prova social com depoimentos, badges de confiança e cases de sucesso. Para leads indecisos.", categoria: "cases" },
];

// ── Preview variables ──────────────────────────────────────────

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

// ── Preview renderer ───────────────────────────────────────────

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

// ── Category badge color ───────────────────────────────────────

function CategoryBadge({ categoria }: { categoria: string }) {
  const label = CATEGORY_LABEL_MAP[categoria] || categoria;
  const colorMap: Record<string, string> = {
    alta_conversao: "bg-success/10 text-success border-success/20",
    consultivo: "bg-primary/10 text-primary border-primary/20",
    whatsapp: "bg-warning/10 text-warning border-warning/20",
    corporativo: "bg-info/10 text-info border-info/20",
    educacional: "bg-accent/10 text-accent-foreground border-accent/20",
    financeiro: "bg-muted text-muted-foreground border-border",
    off_grid: "bg-primary/10 text-primary border-primary/20",
    cases: "bg-warning/10 text-warning border-warning/20",
    geral: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${colorMap[categoria] || colorMap.geral}`}>
      {label}
    </Badge>
  );
}

// ── Main component ─────────────────────────────────────────────

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

  // Filters
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("todos");

  useEffect(() => {
    if (serverData && !initialized) {
      setTemplates(serverData as unknown as TemplateRow[]);
      setInitialized(true);
    }
  }, [serverData]);

  // Only HTML templates (filter out DOCX that might be in the same table)
  const htmlTemplates = useMemo(() =>
    templates.filter(t => t.tipo === "html" || !t.tipo),
    [templates]
  );

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    let result = htmlTemplates;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.nome?.toLowerCase().includes(q) ||
        t.descricao?.toLowerCase().includes(q) ||
        t.categoria?.toLowerCase().includes(q)
      );
    }
    if (filterCategory !== "todos") {
      result = result.filter(t => t.categoria === filterCategory);
    }
    return result;
  }, [htmlTemplates, search, filterCategory]);

  function addTemplate() {
    setTemplates([...templates, {
      id: crypto.randomUUID(), nome: "", descricao: null, grupo: "B",
      categoria: "geral", tipo: "html", ativo: true, ordem: templates.length,
      thumbnail_url: null, template_html: null, isNew: true,
    }]);
  }

  function removeTemplate(idx: number) {
    const templateToRemove = filteredTemplates[idx];
    setTemplates(templates.filter(t => t.id !== templateToRemove.id));
  }

  function updateTemplate(tplId: string, key: keyof TemplateRow, value: any) {
    setTemplates(prev => prev.map(t => t.id === tplId ? { ...t, [key]: value } : t));
  }

  async function handleSave() {
    // Validate no duplicate names
    const htmlNames = htmlTemplates.map(t => t.nome?.trim().toLowerCase()).filter(Boolean);
    const dupes = htmlNames.filter((n, i) => htmlNames.indexOf(n) !== i);
    if (dupes.length > 0) {
      toast({ title: "Nomes duplicados", description: `Corrija os templates com nomes repetidos: ${[...new Set(dupes)].join(", ")}`, variant: "destructive" });
      return;
    }

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

      // Deduplication: check existing template names
      const existingNames = new Set(
        htmlTemplates.map(t => t.nome?.trim().toLowerCase()).filter(Boolean)
      );

      let created = 0;
      let skipped = 0;
      for (let i = 0; i < DEFAULT_TEMPLATES_CONFIG.length; i++) {
        const cfg = DEFAULT_TEMPLATES_CONFIG[i];

        // Skip if name already exists (deduplication)
        if (existingNames.has(cfg.nome.toLowerCase())) {
          skipped++;
          continue;
        }

        const blocks = createDefaultTemplateBlocks("grid", cfg.style);
        const templateHtml = JSON.stringify(blocks);
        const { error } = await supabase.from("proposta_templates").insert({
          nome: cfg.nome,
          descricao: cfg.descricao,
          grupo: "B",
          categoria: cfg.categoria,
          tipo: "html",
          template_html: templateHtml,
          ativo: true,
          ordem: templates.length + i,
          tenant_id: profile.tenant_id,
        } as any);
        if (error) throw error;
        created++;
        existingNames.add(cfg.nome.toLowerCase());
      }

      if (created > 0) {
        toast({ title: `${created} template${created > 1 ? "s" : ""} criado${created > 1 ? "s" : ""}${skipped > 0 ? ` (${skipped} já existiam)` : ""}` });
      } else {
        toast({ title: "Todos os templates padrão já existem", description: `${skipped} templates encontrados` });
      }
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
    setTemplates(prev => prev.map(t =>
      t.id === editingTemplate.id ? { ...t, template_html: jsonData } : t
    ));
  }, [editingTemplate, atualizarHtml]);

  const parseInitialData = useCallback((): TemplateBlock[] | undefined => {
    if (!editingTemplate?.template_html) return undefined;
    try {
      const parsed = JSON.parse(editingTemplate.template_html);
      if (Array.isArray(parsed)) return parsed as TemplateBlock[];
    } catch { /* not valid JSON */ }
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
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-primary" />
            Templates WEB de Proposta
            <Badge variant="outline" className="text-[10px] ml-1">
              {htmlTemplates.length} template{htmlTemplates.length !== 1 ? "s" : ""}
            </Badge>
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
        </div>

        {/* Search & Filter bar */}
        {htmlTemplates.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar template..."
              className="max-w-xs"
            />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[200px] h-9 text-sm">
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as categorias</SelectItem>
                {WEB_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <LayoutTemplate className="h-10 w-10 mx-auto opacity-20 mb-3" />
            <p className="text-sm">
              {htmlTemplates.length === 0
                ? "Nenhum template WEB cadastrado. Use \"Criar templates padrão\" para começar."
                : "Nenhum template corresponde à busca."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTemplates.map((t) => (
              <div key={t.id} className={`border border-border/60 rounded-xl p-4 space-y-3 bg-card transition-opacity ${!t.ativo ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <Badge variant={t.ativo ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {t.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <CategoryBadge categoria={t.categoria || "geral"} />
                    <span className="text-xs font-semibold truncate">{t.nome || "Sem nome"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
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
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewHtml(t.template_html)} aria-label="Preview">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Switch checked={t.ativo} onCheckedChange={(v) => updateTemplate(t.id, "ativo", v)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                      const idx = templates.findIndex(x => x.id === t.id);
                      if (idx >= 0) setTemplates(templates.filter((_, i) => i !== idx));
                    }} aria-label="Remover">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Description row */}
                {t.descricao && (
                  <p className="text-xs text-muted-foreground pl-6 line-clamp-2">{t.descricao}</p>
                )}

                {/* Expanded form for editing metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[10px] text-muted-foreground">Nome</Label>
                    <Input value={t.nome} onChange={(e) => updateTemplate(t.id, "nome", e.target.value)} placeholder="Ex: Proposta Premium" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Categoria</Label>
                    <Select value={t.categoria || "geral"} onValueChange={(v) => updateTemplate(t.id, "categoria", v)}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEB_CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Grupo</Label>
                    <Select value={t.grupo} onValueChange={(v) => updateTemplate(t.id, "grupo", v)}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Grupo A</SelectItem>
                        <SelectItem value="B">Grupo B</SelectItem>
                        <SelectItem value="ambos">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Descrição</Label>
                  <Textarea
                    value={t.descricao || ""}
                    onChange={(e) => updateTemplate(t.id, "descricao", e.target.value)}
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
