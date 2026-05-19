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
  Smartphone, Mail as MailIcon, FileText
} from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  type MessageMode,
  type MessageStyle,
  type ProposalMessageContext,
} from "@/services/proposalMessageGenerator";

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

// ─── Template key helpers ───────────────────────────

const TEMPLATE_KEYS = [
  { key: "cliente_curta", label: "Cliente — Curta", mode: "cliente" as const, style: "curta" as const },
  { key: "cliente_completa", label: "Cliente — Completa", mode: "cliente" as const, style: "completa" as const },
  { key: "consultor_curta", label: "Consultor — Curta", mode: "consultor" as const, style: "curta" as const },
  { key: "consultor_completa", label: "Consultor — Completa", mode: "consultor" as const, style: "completa" as const },
];

// ─── Component ──────────────────────────────────────

function ProposalMessageConfigPageInner() {
  // Check admin role (hook centralizado, sem query inline)
  const { isAdmin, isLoading: rolesLoading } = useUserRoles();

  const { data: tenantCtx } = useQuery({
    queryKey: ["current-tenant-id"],
    queryFn: getCurrentTenantId,
    staleTime: 1000 * 60 * 15,
  });
  const tenantId = tenantCtx?.tenantId;
  const { data: config, isLoading } = useProposalMessageConfig(tenantId);
  const saveMutation = useSaveProposalMessageConfig();

  // Local state
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [blocks, setBlocks] = useState<Record<string, BlockConfig>>({});
  const [defaults, setDefaults] = useState<ProposalMessageDefaults>(SYSTEM_DEFAULT_CONFIG);
  const [initialized, setInitialized] = useState(false);
  const [activeTemplateKey, setActiveTemplateKey] = useState("cliente_completa");
  const [previewMode, setPreviewMode] = useState<MessageMode>("cliente");
  const [previewStyle, setPreviewStyle] = useState<MessageStyle>("completa");
  const [copiedPlaceholder, setCopiedPlaceholder] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"text" | "structure">("text");
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [previewChannel, setPreviewChannel] = useState<"whatsapp" | "email" | "plain">("whatsapp");

  // Initialize from config (sem setState durante render)
  useEffect(() => {
    if (config && !initialized) {
      setTemplates(config.templates);
      setBlocks(config.blocks_config);
      setDefaults(config.defaults);
      setInitialized(true);
    }
  }, [config, initialized]);

  // Analisa como a mensagem foi montada
  const structureAnalysis = useMemo(() => {
    const templateKey = `${previewMode}_${previewStyle}`;
    const customTemplate = templates[templateKey];
    
    // Resolve blocks for MOCK_CONTEXT
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
      link_pdf: MOCK_CONTEXT.linkPdf || "",
      status: MOCK_CONTEXT.propostaStatus || "—",
      consultor_nome: MOCK_CONTEXT.consultorNome || "",
      empresa_nome: MOCK_CONTEXT.empresaNome || "",
    };

    const activeBlocks = Object.entries(blocks)
      .filter(([key, cfg]) => {
        if (!cfg.enabled) return false;
        if (cfg.modes && cfg.modes.length > 0 && !cfg.modes.includes(previewMode)) return false;
        if (cfg.styles && cfg.styles.length > 0 && !cfg.styles.includes(previewStyle)) return false;
        return true;
      })
      .map(([key]) => key);

    return {
      templateUsed: customTemplate ? "Customizado" : "Padrão do Sistema",
      activeBlocks,
      variables: vars,
    };
  }, [previewMode, previewStyle, templates, blocks]);

  // Preview — depende de templates + blocks + defaults para reagir a edições e toggles
  const previewText = useMemo(() => {
    const customTemplate = templates[`${previewMode}_${previewStyle}`] || undefined;
    return generateProposalMessage(MOCK_CONTEXT, previewMode, previewStyle, { customTemplate, blocksConfig: blocks });
  }, [previewMode, previewStyle, templates, blocks, defaults]);

  // Handlers
  const handleSave = useCallback(async () => {
    if (!tenantId) return;
    try {
      await saveMutation.mutateAsync({
        tenantId,
        templates,
        blocks_config: blocks,
        defaults,
      });
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

  const handleCopyPlaceholder = useCallback(async (key: string) => {
    await navigator.clipboard.writeText(`{{${key}}}`);
    setCopiedPlaceholder(key);
    setTimeout(() => setCopiedPlaceholder(null), 2000);
  }, []);

  if (isLoading || rolesLoading) {
    return (
      <div className="p-4 md:p-6">
        <LoadingState context="config" message="Carregando configuração de mensagens..." />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7 text-destructive" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Apenas administradores podem configurar os templates e blocos das mensagens da proposta.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header padronizado §26 — PageHeader */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          icon={MessageCircle}
          title="Mensagens da Proposta"
          description="Configure templates, blocos e padrões por tenant"
        />
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Restaurar padrão
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Restaurar para o padrão do sistema?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é destrutiva: todas as customizações de templates, blocos
                  e padrões locais serão descartadas e substituídas pelos valores
                  padrão. Você ainda precisará clicar em "Salvar" para persistir.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Restaurar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="blocks" className="gap-1.5">
            <ToggleLeft className="h-3.5 w-3.5" />
            Blocos
          </TabsTrigger>
          <TabsTrigger value="defaults" className="gap-1.5">
            <Sliders className="h-3.5 w-3.5" />
            Padrões
          </TabsTrigger>
          <TabsTrigger value="variables" className="gap-1.5">
            <Variable className="h-3.5 w-3.5" />
            Variáveis
          </TabsTrigger>
        </TabsList>

        {/* ═══ TEMPLATES TAB ═══ */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10 mb-2">
            <div className="mt-0.5">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-primary">Templates de Envio</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Aqui você define o <strong>corpo da mensagem</strong> que será enviada via WhatsApp ou E-mail. 
                Se você não escrever nada, o sistema usará o gerador automático baseado nos <strong>Blocos</strong> (aba ao lado).
                Customizar aqui sobrescreve completamente a estrutura automática para este template específico.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor */}
            <Card className="border-l-4 border-l-primary shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Editor de Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Selecione o template para editar</Label>
                  <Select value={activeTemplateKey} onValueChange={setActiveTemplateKey}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_KEYS.map(tk => (
                        <SelectItem key={tk.key} value={tk.key}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{tk.label}</span>
                            {templates[tk.key] ? (
                              <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Customizado</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] text-muted-foreground opacity-60">Padrão</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Conteúdo do template</Label>
                    <div className="flex items-center gap-2">
                      {templates[activeTemplateKey] && (
                        <Select 
                          onValueChange={(val) => {
                            const current = templates[activeTemplateKey] || "";
                            setTemplates(prev => ({ ...prev, [activeTemplateKey]: current + val }));
                          }}
                        >
                          <SelectTrigger className="h-7 text-[10px] w-auto gap-1 border-primary/30 text-primary hover:bg-primary/5">
                            <Variable className="h-3 w-3" />
                            <span>Variável</span>
                          </SelectTrigger>
                          <SelectContent>
                            <ScrollArea className="h-[200px]">
                              {PLACEHOLDER_CATALOG.map(v => (
                                <SelectItem key={v.key} value={`{{${v.key}}}`} title={v.example}>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[11px] font-mono">{`{{${v.key}}}`}</span>
                                    <span className="text-[9px] text-muted-foreground">{v.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </ScrollArea>
                          </SelectContent>
                        </Select>
                      )}
                      
                      {templates[activeTemplateKey] ? (
                        <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600 gap-1">
                          <Pencil className="h-2.5 w-2.5" />
                          Customizado
                        </Badge>
                      ) : (
                        <Badge variant="soft-success" className="text-[10px] gap-1">
                          <Sparkles className="h-2.5 w-2.5" />
                          Gerado automaticamente
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="relative group">
                    <Textarea
                      value={templates[activeTemplateKey] || previewText}
                      onChange={(e) => {
                        if (!templates[activeTemplateKey]) return; // Readonly if not custom
                        setTemplates(prev => ({ ...prev, [activeTemplateKey]: e.target.value }));
                      }}
                      readOnly={!templates[activeTemplateKey]}
                      placeholder="Este conteúdo é gerado automaticamente. Clique em 'Editar manualmente' para customizar."
                      className={cn(
                        "min-h-[350px] text-sm font-mono leading-relaxed resize-y focus-visible:ring-primary border-muted-foreground/20 transition-all",
                        !templates[activeTemplateKey] && "bg-muted/40 cursor-default opacity-80 select-none grayscale-[0.5]"
                      )}
                    />
                    
                    {!templates[activeTemplateKey] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="shadow-xl border border-primary/20 pointer-events-auto"
                          onClick={() => setTemplates(prev => ({ ...prev, [activeTemplateKey]: previewText }))}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2 text-primary" />
                          Editar manualmente
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                       <FileText className="h-3 w-3" />
                       {(templates[activeTemplateKey] || previewText).length} caracteres
                    </div>
                    
                    {templates[activeTemplateKey] && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setTemplates(prev => {
                          const next = { ...prev };
                          delete next[activeTemplateKey];
                          return next;
                        })}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Voltar para automático
                      </Button>
                    )}
                  </div>
                </div>

                <Separator className="my-4" />
                
                {/* AI Preparation Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5">
                      <Wand2 className="h-3 w-3 text-primary" />
                      Sugestões de IA (Experimental)
                    </Label>
                    <Badge variant="outline" className="text-[9px] opacity-70">Em breve</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Mais persuasivo", "Mais técnico", "Mais curto", "Foco economia"].map(sug => (
                      <Button key={sug} variant="outline" size="sm" className="h-7 text-[10px] opacity-60 cursor-not-allowed">
                        {sug}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Banner: preview com dados fictícios — F1 transparência */}
                <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-2.5">
                  <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-snug text-amber-900 dark:text-amber-200">
                    <strong>Pré-visualização em tempo real.</strong> Estes valores são fictícios
                    para exemplificar o layout. O texto que você vê no <strong>Editor</strong> (esquerda)
                    é exatamente o que será usado.
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg border border-border/50">
                    <Button 
                      variant={previewChannel === "whatsapp" ? "secondary" : "ghost"} 
                      size="sm" 
                      className="h-7 text-[10px] px-2 gap-1.5"
                      onClick={() => setPreviewChannel("whatsapp")}
                    >
                      <Smartphone className="h-3 w-3" /> WhatsApp
                    </Button>
                    <Button 
                      variant={previewChannel === "email" ? "secondary" : "ghost"} 
                      size="sm" 
                      className="h-7 text-[10px] px-2 gap-1.5"
                      onClick={() => setPreviewChannel("email")}
                    >
                      <MailIcon className="h-3 w-3" /> E-mail
                    </Button>
                    <Button 
                      variant={previewChannel === "plain" ? "secondary" : "ghost"} 
                      size="sm" 
                      className="h-7 text-[10px] px-2 gap-1.5"
                      onClick={() => setPreviewChannel("plain")}
                    >
                      <FileText className="h-3 w-3" /> Texto puro
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={previewMode}
                      onValueChange={(v) => setPreviewMode(v as MessageMode)}
                    >
                      <SelectTrigger className="h-8 w-[110px] text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cliente">👤 Cliente</SelectItem>
                        <SelectItem value="consultor">📋 Consultor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={previewStyle}
                      onValueChange={(v) => setPreviewStyle(v as MessageStyle)}
                    >
                      <SelectTrigger className="h-8 w-[100px] text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="curta">Curta</SelectItem>
                        <SelectItem value="completa">Completa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Tabs value={previewTab} onValueChange={(v: any) => setPreviewTab(v)} className="w-full">
                  <TabsList className="w-full h-8 p-1 bg-muted/50 grid grid-cols-2">
                    <TabsTrigger value="text" className="text-[10px] h-6">Preview Visual</TabsTrigger>
                    <TabsTrigger value="structure" className="text-[10px] h-6">Como foi montada</TabsTrigger>
                  </TabsList>

                  <TabsContent value="text" className="mt-4">
                    <ScrollArea className="h-[450px] rounded-xl border border-border/60 bg-muted/20 relative overflow-hidden">
                      {previewChannel === "whatsapp" ? (
                        /* WhatsApp Theme */
                        <div className="p-4 bg-[#e5ddd5] dark:bg-slate-900/50 min-h-full bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] dark:bg-none bg-repeat">
                          <div className="max-w-[85%] bg-white dark:bg-slate-800 rounded-lg rounded-tl-none p-3 shadow-sm border-l-4 border-l-[#25D366] relative">
                             <div className="absolute -left-2 top-0 w-0 h-0 border-t-[8px] border-t-white dark:border-t-slate-800 border-l-[8px] border-l-transparent"></div>
                             <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200">
                               {previewText}
                             </div>
                             <div className="flex justify-end mt-1">
                               <span className="text-[10px] text-slate-400 dark:text-slate-500">14:32 ✓✓</span>
                             </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 bg-white dark:bg-slate-950 min-h-full">
                          <div className="max-w-2xl mx-auto border border-border shadow-sm rounded-lg p-6 bg-white dark:bg-slate-900">
                             <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground">
                               {previewText}
                             </div>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="structure" className="mt-4">
                    <ScrollArea className="h-[450px]">
                      <div className="space-y-6 p-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5" />
                            Template de Origem
                          </Label>
                          <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                            <Badge variant={templates[`${previewMode}_${previewStyle}`] ? "secondary" : "outline"} className="text-xs">
                              {structureAnalysis.templateUsed}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">({previewMode}_{previewStyle})</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest flex items-center gap-2">
                            <ToggleLeft className="h-3.5 w-3.5" />
                            Estrutura de Blocos ({structureAnalysis.activeBlocks.length})
                          </Label>
                          <div className="grid grid-cols-1 gap-2">
                            {structureAnalysis.activeBlocks.length > 0 ? (
                              structureAnalysis.activeBlocks.map(b => (
                                <div key={b} className="flex items-center justify-between p-2.5 rounded-lg border bg-card/50">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                    <span className="text-xs font-medium">{BLOCK_LABELS[b]?.label || b}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground opacity-60">Ativo</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-muted-foreground italic p-4 text-center border rounded-lg border-dashed">
                                Nenhum bloco ativo configurado
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest flex items-center gap-2">
                            <Variable className="h-3.5 w-3.5" />
                            Variáveis Resolvidas
                          </Label>
                          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-sm">
                            <table className="w-full text-xs border-collapse">
                              <thead className="bg-muted/50 border-b">
                                <tr>
                                  <th className="text-left p-3 font-semibold text-muted-foreground">Variável</th>
                                  <th className="text-left p-3 font-semibold text-muted-foreground">Valor Resolvido</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(structureAnalysis.variables).map(([k, v]) => (
                                  <tr key={k} className="hover:bg-muted/30 border-b last:border-0 transition-colors">
                                    <td className="p-3 font-mono text-[10px] text-primary bg-primary/5">{"{{"}{k}{"}}"}</td>
                                    <td className="p-3 text-muted-foreground/90 font-medium truncate max-w-[180px]" title={v}>{v}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ BLOCKS TAB ═══ */}
        <TabsContent value="blocks" className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10 mb-2">
            <div className="mt-0.5">
              <ToggleLeft className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-primary">Configuração Estrutural (Blocos)</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Estes blocos definem a <strong>estrutura automática</strong> da mensagem. 
                Se você <strong>não</strong> customizou um template na aba anterior, o sistema montará a mensagem ativando ou desativando os itens abaixo. 
                Isso garante um padrão visual consistente mesmo sem escrever templates manuais.
              </p>
            </div>
          </div>

          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ToggleLeft className="h-4 w-4 text-primary" />
                Gerenciar Visibilidade dos Blocos
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Habilite ou desabilite seções que aparecem na mensagem automática (gerada por blocos)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(BLOCK_LABELS)
                  .sort(([keyA], [keyB]) => {
                    const orderA = blocks[keyA]?.order ?? Object.keys(BLOCK_LABELS).indexOf(keyA);
                    const orderB = blocks[keyB]?.order ?? Object.keys(BLOCK_LABELS).indexOf(keyB);
                    return orderA - orderB;
                  })
                  .map(([key, meta], index, array) => {
                    const blockCfg = blocks[key] || SYSTEM_DEFAULT_BLOCKS[key];
                    const isFirst = index === 0;
                    const isLast = index === array.length - 1;

                    return (
                      <div
                        key={key}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 shadow-sm group/block",
                          blockCfg?.enabled ? "border-primary/30 bg-primary/[0.02] dark:bg-primary/[0.05]" : "border-border bg-card opacity-60 grayscale-[0.5]"
                        )}
                      >
                        {/* Order Controls */}
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            disabled={isFirst}
                            onClick={() => {
                              const prevKey = array[index - 1][0];
                              const currentOrder = blockCfg.order ?? index;
                              const prevOrder = blocks[prevKey]?.order ?? (index - 1);
                              setBlocks(prev => ({
                                ...prev,
                                [key]: { ...blockCfg, order: prevOrder },
                                [prevKey]: { ...(prev[prevKey] || SYSTEM_DEFAULT_BLOCKS[prevKey]), order: currentOrder }
                              }));
                            }}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            disabled={isLast}
                            onClick={() => {
                              const nextKey = array[index + 1][0];
                              const currentOrder = blockCfg.order ?? index;
                              const nextOrder = blocks[nextKey]?.order ?? (index + 1);
                              setBlocks(prev => ({
                                ...prev,
                                [key]: { ...blockCfg, order: nextOrder },
                                [nextKey]: { ...(prev[nextKey] || SYSTEM_DEFAULT_BLOCKS[nextKey]), order: currentOrder }
                              }));
                            }}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                             <h4 className="text-sm font-bold text-foreground">{blockCfg.title || meta.label}</h4>
                             {(blockCfg.title || blockCfg.prefix) && (
                               <Badge variant="outline" className="text-[8px] h-3.5 px-1 uppercase opacity-50 border-primary/30 text-primary">Customizado</Badge>
                             )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1">{meta.description}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {blockCfg?.modes?.map(m => (
                              <Badge key={m} variant="outline" className="text-[9px] h-4 px-1.5 bg-background/50 border-muted-foreground/20">
                                {m === "cliente" ? "👤" : "📋"} {m}
                              </Badge>
                            ))}
                            {blockCfg?.styles?.map(s => (
                              <Badge key={s} variant="outline" className="text-[9px] h-4 px-1.5 bg-background/50 border-muted-foreground/20">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10"
                            onClick={() => setEditingBlock(key)}
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                            Configurar
                          </Button>
                          <Separator orientation="vertical" className="h-8" />
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Habilitado</span>
                            <Switch
                              checked={blockCfg?.enabled ?? true}
                              onCheckedChange={(val) => handleBlockToggle(key, val)}
                              className="scale-90"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ DEFAULTS TAB ═══ */}
        <TabsContent value="defaults" className="space-y-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                Padrões de Geração
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Defina os valores iniciais ao abrir o gerador de mensagens
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Modo padrão</Label>
                  <Select
                    value={defaults.mode}
                    onValueChange={(v) => setDefaults(prev => ({ ...prev, mode: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">👤 Cliente</SelectItem>
                      <SelectItem value="consultor">📋 Consultor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Estilo padrão</Label>
                  <Select
                    value={defaults.style}
                    onValueChange={(v) => setDefaults(prev => ({ ...prev, style: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="curta">Curta</SelectItem>
                      <SelectItem value="completa">Completa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Canal padrão</Label>
                  <Select
                    value={defaults.channel}
                    onValueChange={(v) => setDefaults(prev => ({ ...prev, channel: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="copiar">📋 Copiar</SelectItem>
                      <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                      <SelectItem value="email">✉️ E-mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Nome da empresa (assinatura)</Label>
                  <Input
                    value={defaults.empresa_nome || ""}
                    onChange={(e) => setDefaults(prev => ({ ...prev, empresa_nome: e.target.value }))}
                    placeholder="Ex: Mais Energia Solar"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Nome padrão do consultor</Label>
                  <Input
                    value={defaults.consultor_nome || ""}
                    onChange={(e) => setDefaults(prev => ({ ...prev, consultor_nome: e.target.value }))}
                    placeholder="Preenchido automaticamente pela proposta"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Texto de oferta especial (quando habilitado)</Label>
                <Textarea
                  value={defaults.oferta_especial || ""}
                  onChange={(e) => setDefaults(prev => ({ ...prev, oferta_especial: e.target.value }))}
                  placeholder="Ex: 🎁 Promoção especial: 10% de desconto para pagamento à vista até 30/03!"
                  className="min-h-[80px] text-sm resize-y"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ VARIABLES TAB ═══ */}
        <TabsContent value="variables" className="space-y-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Variable className="h-4 w-4 text-primary" />
                Variáveis Disponíveis
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Use estas variáveis nos templates com a sintaxe {"{{variavel}}"}. Clique para copiar.
              </p>
            </CardHeader>
            <CardContent>
              {(() => {
                const categories = [...new Set(PLACEHOLDER_CATALOG.map(p => p.category))];
                return (
                  <div className="space-y-4">
                    {categories.map(cat => (
                      <div key={cat}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {PLACEHOLDER_CATALOG.filter(p => p.category === cat).map(ph => (
                            <TooltipProvider key={ph.key} delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className={cn(
                                      "flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors w-full",
                                      "hover:border-primary/30 hover:bg-primary/5",
                                      copiedPlaceholder === ph.key ? "border-success bg-success/5" : "border-border bg-card"
                                    )}
                                    onClick={() => handleCopyPlaceholder(ph.key)}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-mono text-primary font-semibold">{`{{${ph.key}}}`}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">{ph.label}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                      <span className="text-[10px] text-muted-foreground/60">{ph.example}</span>
                                      {copiedPlaceholder === ph.key ? (
                                        <CheckCircle className="h-3.5 w-3.5 text-success" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5 text-muted-foreground/40" />
                                      )}
                                    </div>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Copiar {"{{" + ph.key + "}}"}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Block Editor Dialog */}
      <Dialog open={!!editingBlock} onOpenChange={(open) => !open && setEditingBlock(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Configurar Bloco: {editingBlock && (BLOCK_LABELS[editingBlock]?.label || editingBlock)}
            </DialogTitle>
            <DialogDescription>
              Personalize o título, ícone e visibilidade deste bloco na mensagem automática.
            </DialogDescription>
          </DialogHeader>

          {editingBlock && (
            <div className="space-y-6 py-4">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Título do Bloco</Label>
                <Input 
                  value={blocks[editingBlock]?.title || ""} 
                  onChange={(e) => setBlocks(prev => ({
                    ...prev,
                    [editingBlock]: { ...(prev[editingBlock] || SYSTEM_DEFAULT_BLOCKS[editingBlock]), title: e.target.value }
                  }))}
                  placeholder={BLOCK_LABELS[editingBlock]?.label}
                />
                <p className="text-[10px] text-muted-foreground italic">
                  Este título aparecerá em destaque no WhatsApp (ex: ━━━ *{blocks[editingBlock]?.title || BLOCK_LABELS[editingBlock]?.label}* ━━━)
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Prefixo / Emoji</Label>
                <Input 
                  value={blocks[editingBlock]?.prefix || ""} 
                  onChange={(e) => setBlocks(prev => ({
                    ...prev,
                    [editingBlock]: { ...(prev[editingBlock] || SYSTEM_DEFAULT_BLOCKS[editingBlock]), prefix: e.target.value }
                  }))}
                  placeholder="Ex: ☀️, ⚡, 💰"
                />
              </div>

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0" />
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-primary uppercase tracking-wider">Dica Enterprise</h5>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Personalizar os títulos dos blocos ajuda a criar uma identidade visual única para sua empresa no WhatsApp, aumentando a percepção de profissionalismo.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setEditingBlock(null)} className="w-full sm:w-auto">
              Confirmar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProposalMessageConfigPage() {
  return (
    <PageErrorBoundary title="Não foi possível carregar a página">
      <ProposalMessageConfigPageInner />
    </PageErrorBoundary>
  );
}

