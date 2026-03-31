/**
 * ExtractionCenterPage — Central de Extração de Dados por concessionária.
 * §26: PageHeader. §27: KPI cards. §4: Table. §12: Skeleton.
 * Reposicionada para modelo 100% nativo — provedores internos não expostos.
 */
import { useState } from "react";
import { Settings2, Plus, CheckCircle2, AlertTriangle, Cpu, Pencil, Trash2, Eye, Shield, Database, RefreshCw, Upload, Sparkles, UserX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import {
  useExtractionConfigs,
  useExtractionRuns,
  useExtractionRunStats,
  useDeleteExtractionConfig,
  type ExtractionConfig,
} from "@/hooks/useExtractionConfigs";
import { ExtractionConfigModal, type ExtractionConfigPrefill } from "./ExtractionConfigModal";
import { ExtractionTestTab } from "./ExtractionTestTab";
import { ExtractionAssistantTab } from "./ExtractionAssistantTab";
import { LayoutLearningTab } from "./LayoutLearningTab";
import { ExtractionEmailsTab } from "./ExtractionEmailsTab";
import { EmailAccountsManager } from "@/components/admin/email/EmailAccountsManager";
import { toast } from "sonner";
import { format } from "date-fns";

/** UI-facing strategy labels — 100% nativo */
const STRATEGY_LABELS: Record<string, string> = {
  native: "Nativo",
  provider: "Nativo (assistido)",
  auto: "Automático",
};

const STRATEGY_COLORS: Record<string, string> = {
  native: "bg-primary/10 text-primary border-primary/20",
  provider: "bg-info/10 text-info border-info/20",
  auto: "bg-warning/10 text-warning border-warning/20",
};

const STATUS_LABELS: Record<string, { label: string; variant: string }> = {
  success: { label: "Sucesso", variant: "bg-success/10 text-success border-success/20" },
  partial: { label: "Parcial", variant: "bg-warning/10 text-warning border-warning/20" },
  failed: { label: "Falha", variant: "bg-destructive/10 text-destructive border-destructive/20" },
  needs_ocr: { label: "Precisa OCR", variant: "bg-info/10 text-info border-info/20" },
};

/** Resolve parser label from config */
function getParserLabel(config: ExtractionConfig): string {
  if (config.native_enabled && config.parser_version) {
    return `Parser ${config.concessionaria_nome} v${config.parser_version}`;
  }
  if (config.native_enabled) return "Parser Nativo";
  return "Parser Universal";
}

/** Resolve capability badges — sem menção a provedores */
function getCapabilityBadges(config: ExtractionConfig) {
  const badges: { label: string; className: string }[] = [];

  if (config.native_enabled) {
    badges.push({ label: "Parser Nativo", className: "bg-primary/10 text-primary border-primary/20" });
  }
  if (config.provider_enabled) {
    badges.push({ label: "Suporte avançado", className: "bg-info/10 text-info border-info/20" });
  }
  if (config.fallback_enabled) {
    badges.push({ label: "Recuperação automática", className: "bg-warning/10 text-warning border-warning/20" });
  }
  return badges;
}

export default function ExtractionCenterPage() {
  const { data: configs = [], isLoading } = useExtractionConfigs();
  const { data: stats } = useExtractionRunStats();
  const { data: runs = [], isLoading: runsLoading } = useExtractionRuns(undefined, 100);
  const deleteConfig = useDeleteExtractionConfig();

  const [modalOpen, setModalOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<ExtractionConfig | null>(null);
  const [prefillData, setPrefillData] = useState<ExtractionConfigPrefill | null>(null);
  const [activeTab, setActiveTab] = useState("configs");

  const activeConfigs = configs.filter(c => c.active).length;
  const nativeConfigs = configs.filter(c => c.native_enabled).length;
  const withFallback = configs.filter(c => c.fallback_enabled).length;

  // Count invoices pending manual assignment
  const { data: pendingAssignmentCount } = useQuery({
    queryKey: ["invoices_pending_assignment_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("unit_invoices")
        .select("id", { count: "exact", head: true })
        .eq("needs_manual_assignment", true);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  const handleEdit = (config: ExtractionConfig) => {
    setEditConfig(config);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditConfig(null);
    setPrefillData(null);
    setModalOpen(true);
  };

  const handleGenerateConfig = (prefill: ExtractionConfigPrefill) => {
    setEditConfig(null);
    setPrefillData(prefill);
    setModalOpen(true);
  };

  const handleDelete = async (config: ExtractionConfig) => {
    if ((config as any).is_system_default) {
      toast.error("Configurações padrão do sistema não podem ser removidas");
      return;
    }
    try {
      await deleteConfig.mutateAsync(config.id);
      toast.success(`Configuração "${config.concessionaria_nome}" removida`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings2}
        title="Central de Extração"
        description="Configure, teste e ensine o sistema a analisar contas de luz por concessionária"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setActiveTab("test")}>
              <Upload className="w-4 h-4 mr-1" /> Importar conta para análise
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-1" /> Nova Configuração
            </Button>
          </div>
        }
      />

      <Card className="border-border bg-muted/30">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Onde importar uma conta de luz?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Use a aba <strong>Teste de Extração</strong> para enviar uma conta real, ver os campos encontrados,
                entender o que faltou e alimentar o aprendizado de layouts.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setActiveTab("test")}>
            <Upload className="w-4 h-4 mr-1" /> Abrir Teste de Extração
          </Button>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {isLoading ? <Skeleton className="h-8 w-12" /> : activeConfigs}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Configs Ativas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {stats ? stats.success : <Skeleton className="h-8 w-12" />}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Extrações OK (30d)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-destructive bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {stats ? stats.failed : <Skeleton className="h-8 w-12" />}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Falhas (30d)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {pendingAssignmentCount != null ? pendingAssignmentCount : <Skeleton className="h-8 w-12" />}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Atribuição pendente</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {isLoading ? <Skeleton className="h-8 w-12" /> : withFallback}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Com Recuperação</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-concessionária breakdown */}
      {stats?.byConcessionaria && Object.keys(stats.byConcessionaria).length > 0 && (
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Taxa por Concessionária (30d)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(stats.byConcessionaria)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([code, s]) => {
                  const rate = s.total > 0 ? Math.round((s.success / s.total) * 100) : 0;
                  const rateColor = rate >= 80 ? "text-success" : rate >= 50 ? "text-warning" : "text-destructive";
                  return (
                    <div key={code} className="rounded-lg border border-border p-3 space-y-1">
                      <p className="text-xs font-mono font-medium text-foreground uppercase">{code}</p>
                      <p className={`text-lg font-bold ${rateColor}`}>{rate}%</p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.success} ok · {s.partial} parcial · {s.failed} falha · {s.total} total
                      </p>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="configs">Configurações</TabsTrigger>
          <TabsTrigger value="test">Teste de Extração</TabsTrigger>
          <TabsTrigger value="learning">Aprendizado de Layouts</TabsTrigger>
          <TabsTrigger value="runs">Histórico</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="accounts">Contas de Email</TabsTrigger>
          <TabsTrigger value="assistant">Assistente</TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : configs.length === 0 ? (
            <EmptyState
              icon={Settings2}
              title="Nenhuma configuração cadastrada"
              description="Configure a estratégia de extração por concessionária para automatizar o processamento de faturas."
              action={{ label: "Nova Configuração", onClick: handleCreate, icon: Plus }}
            />
          ) : (
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Concessionária</TableHead>
                    <TableHead className="font-semibold text-foreground">Estratégia</TableHead>
                    <TableHead className="font-semibold text-foreground">Parser</TableHead>
                    <TableHead className="font-semibold text-foreground">Capacidades</TableHead>
                    <TableHead className="font-semibold text-foreground">Campos</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground">Origem</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map(config => {
                    const isSystemDefault = (config as any).is_system_default;
                    const capabilities = getCapabilityBadges(config);
                    return (
                      <TableRow key={config.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-foreground">
                          <div>
                            <p>{config.concessionaria_nome}</p>
                            <p className="text-xs text-muted-foreground font-mono">{config.concessionaria_code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${STRATEGY_COLORS[config.strategy_mode] || ""}`}>
                            {STRATEGY_LABELS[config.strategy_mode] || config.strategy_mode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-foreground">{getParserLabel(config)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {capabilities.map((b, i) => (
                              <Badge key={i} variant="outline" className={`text-xs ${b.className}`}>
                                {b.label}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-muted-foreground">
                            {config.required_fields?.length || 0} obrigatórios
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${config.active ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>
                            {config.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isSystemDefault ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                    <Shield className="w-3 h-3 mr-1" />
                                    Sistema
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Configuração padrão do sistema</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <Database className="w-3 h-3 mr-1" />
                              Customizada
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="hidden lg:flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(config)}>
                                    <Pencil className="w-4 h-4 text-warning" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {!isSystemDefault && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(config)}>
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remover</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="flex lg:hidden">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(config)}>Editar</DropdownMenuItem>
                                {!isSystemDefault && (
                                  <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(config)}>Excluir</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="test" className="mt-4">
          <ExtractionTestTab onGenerateConfig={handleGenerateConfig} />
        </TabsContent>

        <TabsContent value="learning" className="mt-4">
          <LayoutLearningTab />
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          {runsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <EmptyState
              icon={Eye}
              title="Nenhuma extração registrada"
              description="As extrações serão exibidas aqui após o processamento de faturas."
            />
          ) : (
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Data</TableHead>
                    <TableHead className="font-semibold text-foreground">Concessionária</TableHead>
                    <TableHead className="font-semibold text-foreground">Estratégia</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground">Confiança</TableHead>
                    <TableHead className="font-semibold text-foreground">Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map(run => {
                    const statusInfo = STATUS_LABELS[run.status] || { label: run.status, variant: "" };
                    return (
                      <TableRow key={run.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(run.created_at), "dd/MM HH:mm")}
                        </TableCell>
                        <TableCell className="font-medium text-foreground font-mono text-sm">
                          {run.concessionaria_code}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${STRATEGY_COLORS[run.strategy_used] || ""}`}>
                            {STRATEGY_LABELS[run.strategy_used] || run.strategy_used}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${statusInfo.variant}`}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {run.confidence_score != null ? `${run.confidence_score}%` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {run.error_reason || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="emails" className="mt-4">
          <ExtractionEmailsTab />
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <EmailAccountsManager />
        </TabsContent>

        <TabsContent value="assistant" className="mt-4">
          <ExtractionAssistantTab />
        </TabsContent>
      </Tabs>

      <ExtractionConfigModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        config={editConfig}
        prefill={prefillData}
      />
    </div>
  );
}
