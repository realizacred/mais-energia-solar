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
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  linkProposta: "https://app.maisenergiasolar.com/proposta/abc123",
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
  const { user } = useAuth();

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

  // Initialize from config (sem setState durante render)
  useEffect(() => {
    if (config && !initialized) {
      setTemplates(config.templates);
      setBlocks(config.blocks_config);
      setDefaults(config.defaults);
      setInitialized(true);
    }
  }, [config, initialized]);

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
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
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
      {/* Header — §26 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Mensagens da Proposta</h1>
            <p className="text-sm text-muted-foreground">Configure templates, blocos e padrões por tenant</p>
          </div>
        </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Editor de Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Selecione o template</Label>
                  <Select value={activeTemplateKey} onValueChange={setActiveTemplateKey}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_KEYS.map(tk => (
                        <SelectItem key={tk.key} value={tk.key}>{tk.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Conteúdo do template</Label>
                    <Badge variant="outline" className="text-[9px]">
                      {templates[activeTemplateKey] ? "Customizado" : "Padrão do sistema"}
                    </Badge>
                  </div>
                  <Textarea
                    value={templates[activeTemplateKey] || ""}
                    onChange={(e) => setTemplates(prev => ({ ...prev, [activeTemplateKey]: e.target.value }))}
                    placeholder="Deixe vazio para usar o template padrão do sistema. Use {{variavel}} para inserir dados dinâmicos."
                    className="min-h-[300px] text-sm font-mono leading-relaxed resize-y"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Deixe vazio para usar o template padrão. Use as variáveis da aba "Variáveis" para dados dinâmicos.
                  </p>
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                </div>

                <ScrollArea className="h-[350px]">
                  <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono border border-border">
                    {previewText}
                  </div>
                </ScrollArea>

                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  Preview com dados de exemplo — não representa uma proposta real
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ BLOCKS TAB ═══ */}
        <TabsContent value="blocks" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ToggleLeft className="h-4 w-4 text-primary" />
                Blocos Configuráveis
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Habilite ou desabilite seções que aparecem na mensagem gerada
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
          <Card>
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
          <Card>
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

