/**
 * ExtractionCenterPage — Central de Extração de Dados por concessionária.
 * §26: PageHeader. §27: KPI cards. §4: Table. §12: Skeleton.
 */
import { useState } from "react";
import { Settings2, Plus, CheckCircle2, AlertTriangle, Cpu, Globe, Pencil, Trash2, Eye } from "lucide-react";
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
import { ExtractionConfigModal } from "./ExtractionConfigModal";
import { toast } from "sonner";
import { format } from "date-fns";

const STRATEGY_LABELS: Record<string, string> = {
  native: "Parser Nativo",
  provider: "Provedor Externo",
  auto: "Automático",
};

const STATUS_LABELS: Record<string, { label: string; variant: string }> = {
  success: { label: "Sucesso", variant: "bg-success/10 text-success border-success/20" },
  partial: { label: "Parcial", variant: "bg-warning/10 text-warning border-warning/20" },
  failed: { label: "Falha", variant: "bg-destructive/10 text-destructive border-destructive/20" },
  needs_ocr: { label: "Precisa OCR", variant: "bg-info/10 text-info border-info/20" },
};

export default function ExtractionCenterPage() {
  const { data: configs = [], isLoading } = useExtractionConfigs();
  const { data: stats } = useExtractionRunStats();
  const { data: runs = [], isLoading: runsLoading } = useExtractionRuns(undefined, 100);
  const deleteConfig = useDeleteExtractionConfig();

  const [modalOpen, setModalOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<ExtractionConfig | null>(null);

  const activeConfigs = configs.filter(c => c.active).length;
  const nativeConfigs = configs.filter(c => c.native_enabled).length;
  const providerConfigs = configs.filter(c => c.provider_enabled).length;

  const handleEdit = (config: ExtractionConfig) => {
    setEditConfig(config);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditConfig(null);
    setModalOpen(true);
  };

  const handleDelete = async (config: ExtractionConfig) => {
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
        description="Configure a estratégia de extração de dados por concessionária"
        actions={
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" /> Nova Configuração
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
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

        <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {isLoading ? <Skeleton className="h-8 w-12" /> : providerConfigs}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Com Provedor</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="configs">
        <TabsList>
          <TabsTrigger value="configs">Configurações</TabsTrigger>
          <TabsTrigger value="runs">Histórico de Extrações</TabsTrigger>
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
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Concessionária</TableHead>
                    <TableHead className="font-semibold text-foreground">Estratégia</TableHead>
                    <TableHead className="font-semibold text-foreground">Parser</TableHead>
                    <TableHead className="font-semibold text-foreground">Provedor</TableHead>
                    <TableHead className="font-semibold text-foreground">Fallback</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map(config => (
                    <TableRow key={config.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-foreground">
                        <div>
                          <p>{config.concessionaria_nome}</p>
                          <p className="text-xs text-muted-foreground font-mono">{config.concessionaria_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {STRATEGY_LABELS[config.strategy_mode] || config.strategy_mode}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm">{config.native_enabled ? "Ativo" : "—"}</span>
                          {config.parser_version && (
                            <span className="text-xs text-muted-foreground">v{config.parser_version}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {config.provider_enabled ? (
                          <div className="flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm capitalize">{config.provider_name || "—"}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${config.fallback_enabled ? "bg-success/10 text-success border-success/20" : ""}`}>
                          {config.fallback_enabled ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${config.active ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>
                          {config.active ? "Ativo" : "Inativo"}
                        </Badge>
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
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(config)}>Excluir</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
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
                          <Badge variant="outline" className="text-xs">
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
      </Tabs>

      <ExtractionConfigModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        config={editConfig}
      />
    </div>
  );
}
