/**
 * ProposalMessageConfigPage.tsx
 *
 * Área de configuração enterprise para mensagens de proposta.
 * Configurações > Mensagens da Proposta
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageErrorBoundary } from "@/components/common/PageErrorBoundary";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  MessageCircle, Settings2, Save, RotateCcw, Eye, Variable,
  ToggleLeft, Sliders, Copy, CheckCircle, ShieldAlert,
  GripVertical, Pencil, ArrowUp, ArrowDown, Check,
  ExternalLink, ChevronRight, Wand2, Sparkles,
  Smartphone, Mail as MailIcon, FileText, AlertTriangle, Info, Plus,
  Search, Filter, Layout, Zap, Database, Share2, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

// DND Kit
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import {
  useProposalMessageConfig,
  useSaveProposalMessageConfig,
  SYSTEM_DEFAULT_BLOCKS,
  SYSTEM_DEFAULT_CONFIG,
  PLACEHOLDER_CATALOG,
  type BlockConfig,
  type ProposalMessageDefaults,
} from "@/hooks/useProposalMessageConfig";
import {
  generateProposalMessage,
  DEFAULT_TEMPLATES,
  type MessageMode,
  type MessageStyle,
  type ProposalMessageContext,
} from "@/services/proposalMessageGenerator";

import { BlockSortableItem } from "@/components/admin/mensagens-proposta/BlockSortableItem";
import { LiveStructurePreview } from "@/components/admin/mensagens-proposta/LiveStructurePreview";

// ─── Mock context for preview ───────────────────────

const MOCK_CONTEXT: ProposalMessageContext = {
  clienteNome: "João Silva",
  potenciaKwp: 8.54,
  modulosQtd: 16,
  moduloPotenciaW: 545,
  moduloModelo: "Canadian Solar 545W",
  inversorModelo: "Growatt MIN 8000TL-X",
  consumoMensal: 850,
  geracaoMensal: 1100,
  economiaMensal: 680,
  paybackMeses: 48,
  valorTotal: 42500,
  linkProposta: "https://app.maisenergiasolar.com/pl/abc123",
  linkPdf: "https://app.maisenergiasolar.com/p/pdf/abc123",
  tipoTelhado: "Cerâmico",
  distribuidora: "CEMIG",
  consultorNome: "Maria Santos",
  empresaNome: "Mais Energia Solar",
  validadeDias: 15,
  pagamentoOpcoes: [
    { nome: "À Vista", entrada: 42500 },
    { nome: "Financiamento", entrada: 8500, parcelas: 60, valor_parcela: 680 },
  ],
  itensInclusos: [
    { descricao: "Canadian Solar 545W", quantidade: 16, categoria: "modulo" },
    { descricao: "Growatt MIN 8000TL-X", quantidade: 1, categoria: "inversor" },
    { descricao: "Estrutura alumínio", quantidade: 1, categoria: "estrutura" },
  ],
  servicos: [
    { descricao: "Instalação completa", valor: 0, incluso: true },
    { descricao: "Projeto elétrico", valor: 0, incluso: true },
  ],
  propostaStatus: "Gerada",
  propostaCodigo: "PROP-2026-0042",
};

// ─── Block labels ───────────────────────────────────

const BLOCK_LABELS: Record<string, { label: string; description: string }> = {
  saudacao: { label: "Saudação", description: "Mensagem de boas-vindas" },
  resumo_tecnico: { label: "Resumo Técnico", description: "Módulos, inversor e telhado" },
  consumo_geracao: { label: "Consumo & Geração", description: "Consumo e geração estimada" },
  garantias: { label: "Garantias", description: "Garantias de módulos, inversor e instalação" },
  investimento: { label: "Investimento", description: "Valor total do investimento" },
  pagamento: { label: "Pagamento", description: "Opções de pagamento disponíveis" },
  itens_inclusos: { label: "Itens Inclusos", description: "Lista de equipamentos" },
  servicos: { label: "Serviços", description: "Serviços inclusos no projeto" },
  oferta_especial: { label: "Oferta Especial", description: "Texto promocional personalizado" },
  link_proposta: { label: "Link da Proposta", description: "Link público para visualização" },
  validade: { label: "Validade", description: "Prazo de validade da proposta" },
  assinatura: { label: "Assinatura", description: "Nome do consultor e empresa" },
};

const BLOCK_VARS: Record<string, string[]> = {
  saudacao: ["cliente_nome"],
  resumo_tecnico: ["potencia_kwp", "modulos_qtd", "modulo_modelo", "inversor_modelo", "tipo_telhado"],
  consumo_geracao: ["consumo_mensal", "geracao_mensal", "economia_mensal", "payback_info"],
  garantias: ["modulo_garantia", "inversor_garantia", "instalacao_garantia"],
  investimento: ["valor_total"],
  pagamento: ["pagamento_detalhes"],
  itens_inclusos: ["lista_itens"],
  servicos: ["lista_servicos"],
  oferta_especial: ["oferta_texto"],
  link_proposta: ["link_proposta", "link_pdf"],
  validade: ["validade_dias"],
  assinatura: ["consultor_nome", "empresa_nome"],
};

// ─── Template key helpers ───────────────────────────

const TEMPLATE_KEYS = [
  { key: "cliente_curta", label: "Cliente — Curta", mode: "cliente" as const, style: "curta" as const },
  { key: "cliente_completa", label: "Cliente — Completa", mode: "cliente" as const, style: "completa" as const },
  { key: "consultor_curta", label: "Consultor — Curta", mode: "consultor" as const, style: "curta" as const },
  { key: "consultor_completa", label: "Consultor — Completa", mode: "consultor" as const, style: "completa" as const },
];

// ─── Component ──────────────────────────────────────

function ProposalMessageConfigPageInner() {
  const { isAdmin, isLoading: rolesLoading } = useUserRoles();
  const { data: tenantCtx } = useQuery({
    queryKey: ["current-tenant-id"],
    queryFn: getCurrentTenantId,
    staleTime: 1000 * 60 * 15,
  });
  const tenantId = tenantCtx?.tenantId;
  const { data: config, isLoading } = useProposalMessageConfig(tenantId);
  const saveMutation = useSaveProposalMessageConfig();

  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [blocks, setBlocks] = useState<Record<string, BlockConfig>>({});
  const [defaults, setDefaults] = useState<ProposalMessageDefaults>(SYSTEM_DEFAULT_CONFIG);
  const [initialized, setInitialized] = useState(false);
  const [activeTemplateKey, setActiveTemplateKey] = useState("cliente_completa");
  const [previewMode, setPreviewMode] = useState<MessageMode>("cliente");
  const [previewStyle, setPreviewStyle] = useState<MessageStyle>("completa");
  const [copiedPlaceholder, setCopiedPlaceholder] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [previewChannel, setPreviewChannel] = useState<"whatsapp" | "email" | "plain">("whatsapp");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (config && !initialized) {
      setTemplates(config.templates);
      setBlocks(config.blocks_config);
      setDefaults(config.defaults);
      setInitialized(true);
    }
  }, [config, initialized]);

  const sortedBlockKeys = useMemo(() => {
    return Object.keys(blocks).sort((a, b) => {
      const orderA = blocks[a]?.order ?? 100;
      const orderB = blocks[b]?.order ?? 100;
      return orderA - orderB;
    });
  }, [blocks]);

  const structureAnalysis = useMemo(() => {
    const vars: Record<string, string> = {
      cliente_nome: MOCK_CONTEXT.clienteNome || "Cliente",
      potencia_kwp: MOCK_CONTEXT.potenciaKwp ? MOCK_CONTEXT.potenciaKwp.toLocaleString('pt-BR') : "—",
      modulos_qtd: MOCK_CONTEXT.modulosQtd != null ? MOCK_CONTEXT.modulosQtd.toString() : "—",
      modulo_potencia: MOCK_CONTEXT.moduloPotenciaW ? `${MOCK_CONTEXT.moduloPotenciaW}W` : "—",
      modulo_modelo: MOCK_CONTEXT.moduloModelo || "—",
      inversor_modelo: MOCK_CONTEXT.inversorModelo || "—",
      consumo_mensal: MOCK_CONTEXT.consumoMensal != null ? MOCK_CONTEXT.consumoMensal.toLocaleString('pt-BR') : "—",
      geracao_mensal: MOCK_CONTEXT.geracaoMensal ? MOCK_CONTEXT.geracaoMensal.toLocaleString('pt-BR') : "—",
      economia_mensal: MOCK_CONTEXT.economiaMensal ? MOCK_CONTEXT.economiaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "—",
      valor_total: MOCK_CONTEXT.valorTotal ? MOCK_CONTEXT.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "—",
      link_proposta: MOCK_CONTEXT.linkProposta || "",
      proposta_link: MOCK_CONTEXT.linkProposta || "",
      link_pdf: MOCK_CONTEXT.linkPdf || "",
      pdf_link: MOCK_CONTEXT.linkPdf || "",
      status: MOCK_CONTEXT.propostaStatus || "—",
      consultor_nome: MOCK_CONTEXT.consultorNome || "",
      empresa_nome: MOCK_CONTEXT.empresaNome || "",
      validade_dias: MOCK_CONTEXT.validadeDias?.toString() || "—",
      payback_info: "4 anos",
      pagamento_detalhes: "À Vista: R$ 42.500,00",
      lista_itens: "• 16x Canadian Solar 545W\n• 1x Growatt MIN 8000TL-X",
      lista_servicos: "• Instalação completa\n• Projeto elétrico",
      modulo_garantia: "12 anos (produto)",
      inversor_garantia: "10 anos",
      instalacao_garantia: "1 ano",
      oferta_texto: defaults.oferta_especial || "—",
      titulo_sistema_solar: blocks?.resumo_tecnico?.title || "Sistema Solar",
      titulo_consumo_geracao: blocks?.consumo_geracao?.title || "Consumo e Geração",
      titulo_investimento: blocks?.investimento?.title || "Investimento",
    };

    return { variables: vars };
  }, [previewMode, previewStyle, templates, blocks, defaults, sortedBlockKeys]);

  const previewText = useMemo(() => {
    const customTemplate = templates[`${previewMode}_${previewStyle}`] || undefined;
    return generateProposalMessage(MOCK_CONTEXT, previewMode, previewStyle, { customTemplate, blocksConfig: blocks });
  }, [previewMode, previewStyle, templates, blocks, defaults]);

  const handleSave = useCallback(async () => {
    if (!tenantId) return;
    try {
      await saveMutation.mutateAsync({ tenantId, templates, blocks_config: blocks, defaults });
      toast({ title: "Configuração salva com sucesso! ✅" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  }, [tenantId, templates, blocks, defaults, saveMutation]);

  const handleReset = useCallback(() => {
    setTemplates({});
    setBlocks(SYSTEM_DEFAULT_BLOCKS);
    setDefaults(SYSTEM_DEFAULT_CONFIG);
    toast({ title: "Restaurado para padrão do sistema" });
  }, []);

  const handleBlockToggle = useCallback((blockKey: string, enabled: boolean) => {
    setBlocks(prev => ({
      ...prev,
      [blockKey]: { ...(prev[blockKey] || SYSTEM_DEFAULT_BLOCKS[blockKey]), enabled },
    }));
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedBlockKeys.indexOf(active.id as string);
      const newIndex = sortedBlockKeys.indexOf(over.id as string);

      const newKeys = arrayMove(sortedBlockKeys, oldIndex, newIndex);
      
      setBlocks((items) => {
        const updatedBlocks = { ...items };
        newKeys.forEach((key, index) => {
          updatedBlocks[key] = { ...updatedBlocks[key], order: (index + 1) * 10 };
        });
        return updatedBlocks;
      });
    }
  };

  const handleCopyPlaceholder = useCallback(async (key: string) => {
    await navigator.clipboard.writeText(`{{${key}}}`);
    setCopiedPlaceholder(key);
    setTimeout(() => setCopiedPlaceholder(null), 2000);
  }, []);

  if (isLoading || rolesLoading) {
    return <div className="p-4 md:p-6"><LoadingState context="config" message="Carregando..." /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
        <ShieldAlert className="w-14 h-14 text-destructive mb-4" />
        <h2 className="text-lg font-bold">Acesso restrito</h2>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader icon={MessageCircle} title="Mensagens da Proposta" description="Builder Enterprise de Mensagens" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5"><RotateCcw className="h-3.5 w-3.5" /> Restaurar</Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5"><Save className="h-3.5 w-3.5" /> {saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Templates</TabsTrigger>
          <TabsTrigger value="blocks" className="gap-1.5"><ToggleLeft className="h-3.5 w-3.5" /> Blocos</TabsTrigger>
          <TabsTrigger value="defaults" className="gap-1.5"><Sliders className="h-3.5 w-3.5" /> Padrões</TabsTrigger>
          <TabsTrigger value="variables" className="gap-1.5"><Variable className="h-3.5 w-3.5" /> Variáveis</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8 space-y-4">
              <Card className="border-l-4 border-l-primary shadow-sm overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-primary" /> Editor de Template de Envio
                      </CardTitle>
                      <CardDescription className="text-[10px] uppercase tracking-widest font-semibold">Customização Multicanal</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold text-muted-foreground">Contexto:</Label>
                      <Select value={activeTemplateKey} onValueChange={setActiveTemplateKey}>
                        <SelectTrigger className="w-[180px] h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>{TEMPLATE_KEYS.map(k => <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="relative group">
                    <Textarea
                      value={templates[activeTemplateKey] || DEFAULT_TEMPLATES[activeTemplateKey as keyof typeof DEFAULT_TEMPLATES]}
                      onChange={(e) => {
                        if (!templates[activeTemplateKey]) return;
                        setTemplates(prev => ({ ...prev, [activeTemplateKey]: e.target.value }));
                      }}
                      readOnly={!templates[activeTemplateKey]}
                      className={cn("min-h-[400px] font-mono text-sm leading-relaxed focus-visible:ring-primary", !templates[activeTemplateKey] && "bg-muted/40 cursor-default opacity-80")}
                    />
                    {!templates[activeTemplateKey] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Button variant="secondary" size="sm" className="pointer-events-auto shadow-lg" onClick={() => setTemplates(prev => ({ ...prev, [activeTemplateKey]: DEFAULT_TEMPLATES[activeTemplateKey as keyof typeof DEFAULT_TEMPLATES] }))}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Editar manualmente
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {templates[activeTemplateKey] && (
                        <Button variant="ghost" size="sm" className="text-destructive h-7 text-[10px]" onClick={() => setTemplates(prev => { const next = { ...prev }; delete next[activeTemplateKey]; return next; })}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Restaurar automático
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Database className="h-3 w-3" /> Armazenado no Tenant
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500 bg-blue-500/[0.02]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-blue-500" /> Dica de Governança
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Templates utilizam o motor de renderização <span className="font-mono text-blue-600 bg-blue-500/10 px-1 rounded">LiquidJS-Like</span>. 
                    Você pode usar <span className="font-mono text-primary font-bold">{"{{bloco_nome}}"}</span> para injetar blocos configurados 
                    ou <span className="font-mono text-primary font-bold">{"{{variavel}}"}</span> para dados diretos do projeto.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="xl:col-span-4 space-y-4">
              <div className="sticky top-6 space-y-4">
                <Card className="border-l-4 border-l-primary shadow-sm overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Eye className="h-4 w-4 text-primary" /> Visualização Real
                      </CardTitle>
                      <div className="flex items-center gap-1 p-0.5 bg-background border rounded-md">
                        <Button variant={previewChannel === "whatsapp" ? "secondary" : "ghost"} size="icon" className="h-6 w-6" onClick={() => { setPreviewChannel("whatsapp"); setPreviewMode("cliente"); setPreviewStyle("completa"); }}><Smartphone className="h-3 w-3" /></Button>
                        <Button variant={previewChannel === "email" ? "secondary" : "ghost"} size="icon" className="h-6 w-6" onClick={() => { setPreviewChannel("email"); setPreviewMode("cliente"); setPreviewStyle("completa"); }}><MailIcon className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className={cn(
                      "rounded-lg border shadow-inner transition-all duration-300",
                      previewChannel === "whatsapp" ? "bg-[#e5ddd5]" : "bg-white"
                    )}>
                      {previewChannel === "whatsapp" && (
                        <div className="bg-[#075e54] text-white p-2 rounded-t-lg flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px]">M</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold truncate">Mais Energia Solar</p>
                            <p className="text-[8px] opacity-80">Online</p>
                          </div>
                        </div>
                      )}
                      <ScrollArea className="h-[400px]">
                        <div className={cn(
                          "p-4 whitespace-pre-wrap font-sans text-sm leading-relaxed",
                          previewChannel === "whatsapp" && "bg-white m-4 rounded-lg shadow-sm relative after:content-[''] after:absolute after:top-0 after:-left-2 after:border-8 after:border-transparent after:border-t-white"
                        )}>
                          {previewText}
                          {previewChannel === "whatsapp" && (
                            <div className="text-[10px] text-muted-foreground text-right mt-1 opacity-60">12:45 ✓✓</div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1.5" onClick={() => { navigator.clipboard.writeText(previewText); toast({ title: "Copiado!" }); }}>
                        <Copy className="h-3.5 w-3.5" /> Copiar Texto
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1.5">
                        <Share2 className="h-3.5 w-3.5" /> Enviar Teste
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="h-[300px]">
                  <LiveStructurePreview 
                    blockKeys={sortedBlockKeys}
                    blocks={blocks}
                    blockLabels={BLOCK_LABELS}
                    previewMode={previewMode}
                    previewStyle={previewStyle}
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="blocks" className="space-y-4">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="space-y-1">
              <h3 className="text-lg font-bold tracking-tight">Builder Visual de Blocos</h3>
              <p className="text-sm text-muted-foreground">Arraste para reordenar. Configure cada unidade de mensagem individualmente.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-[11px]"><Filter className="h-3.5 w-3.5" /> Filtrar</Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-[11px]"><Layout className="h-3.5 w-3.5" /> Visualização</Button>
            </div>
          </div>

          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={sortedBlockKeys}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedBlockKeys.map((key) => {
                  const meta = BLOCK_LABELS[key];
                  const blockCfg = blocks[key] || SYSTEM_DEFAULT_BLOCKS[key];
                  const suggestedVars = BLOCK_VARS[key] || [];
                  
                  const previewSnippet = (blockCfg.template || "")
                    .replace(/\{\{(\w+)\}\}/g, (_m, k) => structureAnalysis.variables[k] ?? "")
                    .slice(0, 80);

                  return (
                    <BlockSortableItem 
                      key={key}
                      id={key}
                      config={blockCfg}
                      label={meta.label}
                      description={meta.description}
                      suggestedVars={suggestedVars}
                      previewContent={previewSnippet}
                      onToggle={(v) => handleBlockToggle(key, v)}
                      onEdit={() => setEditingBlock(key)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </TabsContent>

        <TabsContent value="defaults" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-l-4 border-l-primary">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" /> Padrões Globais de Geração
                </CardTitle>
                <CardDescription>Defina o comportamento padrão do gerador de mensagens.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Perfil de Público Padrão</Label>
                    <Select value={defaults.mode} onValueChange={(v: any) => setDefaults(prev => ({ ...prev, mode: v }))}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cliente">Cliente Final (Foco em benefícios)</SelectItem>
                        <SelectItem value="consultor">Consultor Interno (Foco em dados)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estilo de Texto Padrão</Label>
                    <Select value={defaults.style} onValueChange={(v: any) => setDefaults(prev => ({ ...prev, style: v }))}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completa">Completa (Todos os blocos)</SelectItem>
                        <SelectItem value="curta">Curta (Apenas essencial)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Oferta Especial Ativa</Label>
                      <p className="text-[10px] text-muted-foreground">Injeta automaticamente uma oferta em todas as mensagens geradas.</p>
                    </div>
                    <Switch 
                      checked={blocks.oferta_especial?.enabled} 
                      onCheckedChange={(v) => handleBlockToggle('oferta_especial', v)}
                    />
                  </div>
                  <Textarea 
                    placeholder="Ex: Instalação grátis este mês! Use {{oferta_texto}} no template." 
                    value={defaults.oferta_especial || ""}
                    onChange={(e) => setDefaults(prev => ({ ...prev, oferta_especial: e.target.value }))}
                    className="min-h-[80px] text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/[0.01]">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Sugestões de Conversão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-background border rounded-lg space-y-2">
                  <p className="text-[11px] font-bold">Use Emojis Estratégicos</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Mensagens com emojis em títulos de blocos convertem 15% mais no WhatsApp.</p>
                </div>
                <div className="p-3 bg-background border rounded-lg space-y-2">
                  <p className="text-[11px] font-bold">Escassez e Urgência</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Sempre mantenha o bloco de "Validade" ativo para incentivar a tomada de decisão.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="variables" className="space-y-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base">Catálogo de Variáveis Dinâmicas</CardTitle>
                <CardDescription>Placeholders disponíveis para serem usados em qualquer template.</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar variável..." className="pl-9 h-9 text-xs" />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PLACEHOLDER_CATALOG.map((p) => (
                    <div key={p.key} className="p-3 rounded-lg border bg-background hover:border-primary/50 transition-colors group">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="text-[9px] font-mono bg-muted/50 text-primary uppercase">{p.category}</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopyPlaceholder(p.key)}>
                          {copiedPlaceholder === p.key ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      <h4 className="text-xs font-bold mb-1">{"{{ " + p.key + " }}"}</h4>
                      <p className="text-[10px] text-muted-foreground font-medium mb-2">{p.label}</p>
                      <div className="text-[9px] text-muted-foreground italic bg-muted/30 p-1.5 rounded border border-dashed truncate">
                        Ex: {p.example}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingBlock} onOpenChange={(open) => !open && setEditingBlock(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Bloco: {editingBlock && (BLOCK_LABELS[editingBlock]?.label || editingBlock)}</DialogTitle>
            <DialogDescription>Builder Enterprise: Cada bloco é uma unidade real de mensagem.</DialogDescription>
          </DialogHeader>
          {editingBlock && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Título</Label><Input value={blocks[editingBlock]?.title || ""} onChange={(e) => setBlocks(prev => ({ ...prev, [editingBlock]: { ...(prev[editingBlock] || SYSTEM_DEFAULT_BLOCKS[editingBlock]), title: e.target.value } }))} /></div>
                <div className="space-y-2"><Label>Ícone/Emoji</Label><Input value={blocks[editingBlock]?.prefix || ""} onChange={(e) => setBlocks(prev => ({ ...prev, [editingBlock]: { ...(prev[editingBlock] || SYSTEM_DEFAULT_BLOCKS[editingBlock]), prefix: e.target.value } }))} /></div>
              </div>
              <div className="space-y-2">
                <Label>Template do Bloco</Label>
                <Textarea value={blocks[editingBlock]?.template || SYSTEM_DEFAULT_BLOCKS[editingBlock]?.template || ""} onChange={(e) => setBlocks(prev => ({ ...prev, [editingBlock]: { ...(prev[editingBlock] || SYSTEM_DEFAULT_BLOCKS[editingBlock]), template: e.target.value } }))} className="min-h-[120px] font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-primary">Variáveis Sugeridas</Label>
                <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded border">
                  {BLOCK_VARS[editingBlock]?.map(v => (
                    <Button key={v} variant="outline" size="sm" className="h-6 text-[10px] font-mono" onClick={() => { const curr = blocks[editingBlock]?.template || SYSTEM_DEFAULT_BLOCKS[editingBlock]?.template || ""; setBlocks(prev => ({ ...prev, [editingBlock]: { ...(prev[editingBlock] || SYSTEM_DEFAULT_BLOCKS[editingBlock]), template: curr + ` {{${v}}}` } })); }}>
                      <Plus className="h-3 w-3 mr-1" /> {`{{${v}}}`}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-primary flex items-center gap-1.5"><Eye className="h-4 w-4" /> Preview do Bloco</Label>
                <div className="p-3 rounded border bg-primary/[0.02] text-sm whitespace-pre-wrap leading-relaxed">
                  {(() => {
                    const cfg = blocks[editingBlock] || SYSTEM_DEFAULT_BLOCKS[editingBlock];
                    const rendered = (cfg.template || SYSTEM_DEFAULT_BLOCKS[editingBlock].template || "").replace(/\{\{(\w+)\}\}/g, (_m, k) => structureAnalysis.variables[k] ?? "");
                    return (cfg.prefix ? `${cfg.prefix} ` : "") + rendered;
                  })()}
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setEditingBlock(null)} className="w-full">Salvar Configuração do Bloco</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProposalMessageConfigPage() {
  return <PageErrorBoundary title="Erro ao carregar página"><ProposalMessageConfigPageInner /></PageErrorBoundary>;
}
