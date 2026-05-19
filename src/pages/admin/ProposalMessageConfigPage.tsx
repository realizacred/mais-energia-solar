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
import { PageErrorBoundary } from "@/components/common/PageErrorBoundary";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  MessageCircle, Settings2, Save, RotateCcw, Eye, Variable,
  ToggleLeft, Sliders, Copy, CheckCircle, ShieldAlert
} from "lucide-react";
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

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Conteúdo do template</Label>
                    <div className="flex items-center gap-2">
                      <Select 
                        onValueChange={(val) => {
                          const current = templates[activeTemplateKey] || "";
                          setTemplates(prev => ({ ...prev, [activeTemplateKey]: current + val }));
                        }}
                      >
                        <SelectTrigger className="h-7 text-[10px] w-auto gap-1 border-primary/30 text-primary hover:bg-primary/5">
                          <Variable className="h-3 w-3" />
                          <span>Inserir Variável</span>
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
                      {templates[activeTemplateKey] ? (
                        <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600">Customizado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-muted/50">Padrão do Sistema</Badge>
                      )}
                    </div>
                  </div>
                  <Textarea
                    value={templates[activeTemplateKey] || ""}
                    onChange={(e) => setTemplates(prev => ({ ...prev, [activeTemplateKey]: e.target.value }))}
                    placeholder="Deixe vazio para usar o gerador automático baseado em blocos. Use {{variavel}} para inserir dados dinâmicos."
                    className="min-h-[320px] text-sm font-mono leading-relaxed resize-y focus-visible:ring-primary border-muted-foreground/20"
                  />
                  <div className="bg-muted/30 p-2 rounded border border-dashed border-muted-foreground/30">
                    <p className="text-[10px] text-muted-foreground italic">
                      Dica: Deixe este campo <strong>vazio</strong> se quiser que o sistema monte a mensagem sozinho usando os botões de ligar/desligar na aba <strong>Blocos</strong>.
                    </p>
                  </div>
                </div>

                {templates[activeTemplateKey] && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive"
                    onClick={() => setTemplates(prev => {
                      const next = { ...prev };
                      delete next[activeTemplateKey];
                      return next;
                    })}
                  >
                    Limpar customização (usar padrão)
                  </Button>
                )}
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
                    <strong>Pré-visualização com dados de exemplo.</strong> Os valores
                    abaixo (cliente "João Silva", R$ 42.500, PROP-2026-0042…) são fictícios
                    e servem só para ver o layout do template. A mensagem real é gerada na
                    proposta com dados verdadeiros do cliente.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={previewMode}
                    onValueChange={(v) => setPreviewMode(v as MessageMode)}
                  >
                    <SelectTrigger className="w-[140px]">
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
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="curta">Curta</SelectItem>
                      <SelectItem value="completa">Completa</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="text-[9px] gap-1 ml-auto">
                    <Eye className="h-3 w-3" />
                    Dados de exemplo
                  </Badge>
                </div>

                <Tabs value={previewTab} onValueChange={(v: any) => setPreviewTab(v)} className="w-full">
                  <TabsList className="w-full h-8 p-1 bg-muted/50 grid grid-cols-2">
                    <TabsTrigger value="text" className="text-[10px] h-6">Mensagem Final</TabsTrigger>
                    <TabsTrigger value="structure" className="text-[10px] h-6">Estrutura Usada</TabsTrigger>
                  </TabsList>

                  <TabsContent value="text" className="mt-3">
                    <ScrollArea className="h-[350px]">
                      <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono border border-border">
                        {previewText}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="structure" className="mt-3">
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-4 p-1">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Template Base</Label>
                          <div className="flex items-center gap-2">
                            <Badge variant={templates[`${previewMode}_${previewStyle}`] ? "secondary" : "outline"} className="text-xs">
                              {structureAnalysis.templateUsed}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">({previewMode}_{previewStyle})</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Blocos Ativos</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {structureAnalysis.activeBlocks.length > 0 ? (
                              structureAnalysis.activeBlocks.map(b => (
                                <Badge key={b} variant="soft-success" className="text-[10px] gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  {BLOCK_LABELS[b]?.label || b}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Nenhum bloco ativo para esta configuração</span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Variáveis Resolvidas no Preview</Label>
                          <div className="rounded-lg border border-border bg-card overflow-hidden">
                            <div className="max-h-[180px] overflow-y-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead className="bg-muted/50 sticky top-0">
                                  <tr>
                                    <th className="text-left p-2 font-semibold border-b">Variável</th>
                                    <th className="text-left p-2 font-semibold border-b">Valor Resolvido</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(structureAnalysis.variables).map(([k, v]) => (
                                    <tr key={k} className="hover:bg-muted/30 border-b last:border-0">
                                      <td className="p-2 font-mono text-[10px] text-primary">{`{{${k}}}`}</td>
                                      <td className="p-2 text-muted-foreground truncate max-w-[150px]" title={v}>{v}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(BLOCK_LABELS).map(([key, meta]) => {
                  const blockCfg = blocks[key] || SYSTEM_DEFAULT_BLOCKS[key];
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors",
                        blockCfg?.enabled ? "border-primary/20 bg-primary/5" : "border-border bg-card"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{meta.label}</p>
                        <p className="text-[10px] text-muted-foreground">{meta.description}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {blockCfg?.modes?.map(m => (
                            <Badge key={m} variant="outline" className="text-[8px] h-4 px-1">
                              {m === "cliente" ? "👤" : "📋"} {m}
                            </Badge>
                          ))}
                          {blockCfg?.styles?.map(s => (
                            <Badge key={s} variant="outline" className="text-[8px] h-4 px-1">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Switch
                        checked={blockCfg?.enabled ?? true}
                        onCheckedChange={(v) => handleBlockToggle(key, v)}
                      />
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

