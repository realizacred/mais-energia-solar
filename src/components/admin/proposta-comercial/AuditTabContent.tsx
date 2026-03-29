import { useMemo, useState, useCallback } from "react";
import {
  ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronRight, Info, Database, Filter, TableProperties, PlusCircle, FileWarning, Ghost, Layers, Zap,
  FileText, Clock, Bug, Sparkles, Copy, Bot
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useQuickAudit, useFullAudit, type FullAuditResult } from "@/hooks/useRealAudit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table as ShadTable,
  TableBody as ShadTableBody,
  TableCell as ShadTableCell,
  TableHead as ShadTableHead,
  TableHeader as ShadTableHeader,
  TableRow as ShadTableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  useVariablesAudit,
  SORTED_TABLES,
  FLOW_GROUPS,
  SOURCE_LABELS,
  type DbCustomVar,
  type AuditItem,
  type AuditStatus,
  type CategoryAuditEntry,
  type VariableSource,
} from "@/hooks/useVariablesAudit";

// ── Status config ──────────────────────────────────────────
const statusConfig: Record<AuditStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  ok: { icon: CheckCircle2, color: "text-success", label: "Sincronizada" },
  missing_catalog: { icon: AlertTriangle, color: "text-warning", label: "Falta no catálogo" },
  missing_db: { icon: XCircle, color: "text-destructive", label: "Falta no banco" },
};

// AI loading step messages
const AI_STEPS = [
  "Lendo templates DOCX ativos...",
  "Extraindo placeholders dos templates...",
  "Testando variáveis na proposta...",
  "Consultando IA para análise...",
  "Gerando relatório...",
];

// ── Main Component ──────────────────────────────────────────
export function AuditTabContent({
  dbCustomVars,
  loadingCustom,
  onRefresh,
  onRequestCreateVariable,
}: {
  dbCustomVars: DbCustomVar[];
  loadingCustom: boolean;
  onRefresh: () => void | Promise<any>;
  onRequestCreateVariable?: (suggested: { nome: string; label: string; table: string; column: string; colType?: string }) => void;
}) {
  const [showSynced, setShowSynced] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "missing" | "mapped">("all");
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [showDescIssues, setShowDescIssues] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [aiStepIdx, setAiStepIdx] = useState(0);
  const [fullAuditResult, setFullAuditResult] = useState<FullAuditResult | null>(null);

  const { customAudit, schemaAudit, descriptionAudit, ghostVariables, totalCustomDivergences, categoryAudit, resolverCoverage } = useVariablesAudit(dbCustomVars);

  // Real-time audit data from edge function
  const { data: quickAudit, isLoading: quickLoading } = useQuickAudit();
  const fullAuditMutation = useFullAudit();
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      await queryClient.invalidateQueries({ queryKey: ["audit-variables"] });
      toast.success("Análise concluída com sucesso");
    } catch {
      toast.error("Erro ao reanalisar variáveis");
    } finally {
      setLastRefresh(new Date());
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [onRefresh, queryClient]);

  const handleFullAudit = useCallback(async () => {
    setAiStepIdx(0);
    setFullAuditResult(null);

    // Animate steps
    const interval = setInterval(() => {
      setAiStepIdx((prev) => Math.min(prev + 1, AI_STEPS.length - 1));
    }, 2500);

    try {
      const result = await fullAuditMutation.mutateAsync();
      setFullAuditResult(result);
      toast.success("Auditoria com IA concluída!");
    } catch (e: any) {
      toast.error(e.message || "Erro na auditoria com IA");
    } finally {
      clearInterval(interval);
    }
  }, [fullAuditMutation]);

  // ── Filtered schema fields ──────────────────────────────────
  const filteredFields = useMemo(() => {
    let items = schemaAudit.fields;
    if (activeTable) items = items.filter((f) => f.table === activeTable);
    if (activeFilter === "missing") items = items.filter((f) => !f.hasVariable);
    if (activeFilter === "mapped") items = items.filter((f) => f.hasVariable);
    return items;
  }, [schemaAudit, activeTable, activeFilter]);

  if (loadingCustom) {
    return (
      <div className="divide-y divide-border">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/10">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-warning" />
          <span className="text-xs font-semibold text-foreground">Auditoria de Variáveis</span>
          <span className="text-[10px] text-muted-foreground">— Tempo real · Templates × Resolvers × IA</span>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {lastRefresh.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isRefreshing} className="h-7 text-xs gap-1.5">
            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Analisando..." : "Reanalisar"}
          </Button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* REAL-TIME DOCX AUDIT — from edge function               */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">DOCX Ativos — Auditoria em Tempo Real</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[300px] text-xs">
              <p>Dados extraídos em tempo real dos templates DOCX ativos. O sistema lê cada template, extrai [placeholders] e testa contra a última proposta gerada.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* KPIs */}
        {quickLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : quickAudit ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-0.5">
                <p className="text-[9px] text-primary uppercase tracking-wider font-medium">Templates DOCX</p>
                <p className="text-lg font-bold text-primary tabular-nums">{quickAudit.templates_ativos}</p>
                <p className="text-[10px] text-muted-foreground">Ativos</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-2.5 space-y-0.5">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Variáveis Reais</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{quickAudit.total_variaveis}</p>
                <p className="text-[10px] text-muted-foreground">Encontradas nos DOCX</p>
              </div>
              <div className="rounded-lg border border-success/30 bg-success/5 p-2.5 space-y-0.5">
                <p className="text-[9px] text-success uppercase tracking-wider font-medium">OK</p>
                <p className="text-lg font-bold text-success tabular-nums">{quickAudit.ok.length}</p>
                <p className="text-[10px] text-muted-foreground">Resolver OK</p>
              </div>
              <div className={cn(
                "rounded-lg border p-2.5 space-y-0.5",
                quickAudit.quebradas.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
              )}>
                <p className="text-[9px] text-destructive uppercase tracking-wider font-medium">Quebradas</p>
                <p className="text-lg font-bold text-destructive tabular-nums">{quickAudit.quebradas.length}</p>
                <p className="text-[10px] text-muted-foreground">Sem resolver</p>
              </div>
              <div className={cn(
                "rounded-lg border p-2.5 space-y-0.5",
                quickAudit.nulas.length > 0 ? "border-warning/30 bg-warning/5" : "border-border bg-card"
              )}>
                <p className="text-[9px] text-warning uppercase tracking-wider font-medium">Valor Nulo</p>
                <p className="text-lg font-bold text-warning tabular-nums">{quickAudit.nulas.length}</p>
                <p className="text-[10px] text-muted-foreground">Retorna vazio</p>
              </div>
              <div className="rounded-lg border border-info/30 bg-info/5 p-2.5 space-y-0.5">
                <p className="text-[9px] text-info uppercase tracking-wider font-medium">Cobertura</p>
                <p className="text-lg font-bold text-info tabular-nums">
                  {quickAudit.total_variaveis > 0
                    ? Math.round((quickAudit.ok.length / quickAudit.total_variaveis) * 100)
                    : 0}%
                </p>
                <p className="text-[10px] text-muted-foreground">Resolução real</p>
              </div>
            </div>

            {/* Broken variables table */}
            {quickAudit.quebradas.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Bug className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-semibold text-foreground">Variáveis Quebradas</span>
                  <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">
                    {quickAudit.quebradas.length}
                  </Badge>
                </div>
                <div className="rounded-lg border border-destructive/20 overflow-hidden">
                  <ShadTable>
                    <ShadTableHeader>
                      <ShadTableRow className="bg-destructive/5 hover:bg-destructive/5">
                        <ShadTableHead className="text-[10px] w-[30px]">⚠️</ShadTableHead>
                        <ShadTableHead className="text-[10px]">Variável</ShadTableHead>
                        <ShadTableHead className="text-[10px]">Status</ShadTableHead>
                      </ShadTableRow>
                    </ShadTableHeader>
                    <ShadTableBody>
                      {quickAudit.quebradas.map((v) => (
                        <ShadTableRow key={v}>
                          <ShadTableCell className="py-2">
                            <XCircle className="h-3 w-3 text-destructive" />
                          </ShadTableCell>
                          <ShadTableCell className="py-2">
                            <code className="font-mono text-destructive bg-destructive/5 px-1.5 py-0.5 rounded text-[10px]">[{v}]</code>
                          </ShadTableCell>
                          <ShadTableCell className="py-2">
                            <Badge variant="outline" className="text-[8px] bg-destructive/10 text-destructive border-destructive/20">
                              Sem resolver
                            </Badge>
                          </ShadTableCell>
                        </ShadTableRow>
                      ))}
                    </ShadTableBody>
                  </ShadTable>
                </div>
              </div>
            )}

            {/* Null variables */}
            {quickAudit.nulas.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  <span className="text-xs font-semibold text-foreground">Variáveis com Valor Nulo</span>
                  <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20">
                    {quickAudit.nulas.length}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {quickAudit.nulas.map((v) => (
                    <code key={v} className="font-mono text-warning bg-warning/5 px-1.5 py-0.5 rounded text-[10px] border border-warning/20">
                      [{v}]
                    </code>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>Erro ao carregar auditoria. Clique em Reanalisar para tentar novamente.</span>
          </div>
        )}

        {/* AI Audit Button */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleFullAudit}
            disabled={fullAuditMutation.isPending}
            className="gap-1.5 text-xs"
          >
            {fullAuditMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {fullAuditMutation.isPending ? "Auditando..." : "✨ Auditar com IA"}
          </Button>
          {fullAuditMutation.isPending && (
            <span className="text-[11px] text-muted-foreground animate-pulse">
              {AI_STEPS[aiStepIdx]}
            </span>
          )}
        </div>

        {/* AI Analysis Result */}
        {fullAuditResult?.analise_ia && (
          <div className="space-y-3">
            {/* AI Analysis Card */}
            <Card className="border-info/30 bg-info/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-info" />
                  <span className="text-xs font-semibold text-foreground">Análise da IA</span>
                </div>
                <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {fullAuditResult.analise_ia}
                </p>
              </CardContent>
            </Card>

            {/* Prompt for Lovable */}
            {fullAuditResult.prompt_lovable && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">Prompt para Lovable</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => {
                        navigator.clipboard.writeText(fullAuditResult.prompt_lovable!);
                        toast.success("Prompt copiado para a área de transferência!");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      Copiar prompt
                    </Button>
                  </div>
                  <pre className="text-[10px] text-foreground/80 whitespace-pre-wrap bg-background/50 rounded-lg p-3 border border-border/50 max-h-[300px] overflow-y-auto font-mono leading-relaxed">
                    {fullAuditResult.prompt_lovable}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="text-[9px] text-muted-foreground/60 flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {quickAudit?.gerado_em
            ? `Varredura: ${new Date(quickAudit.gerado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${quickAudit.templates_ativos} templates · ${quickAudit.total_variaveis} variáveis`
            : "Auditoria pendente"}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* CATÁLOGO GLOBAL — Schema + Resolver coverage           */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="px-4 py-3 space-y-3">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Catálogo Global — Cobertura de Schema (catálogo × banco)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg border border-border bg-card p-2.5 space-y-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Campos no Banco</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{schemaAudit.fields.length}</p>
            <p className="text-[10px] text-muted-foreground">{SORTED_TABLES.length} tabelas</p>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-2.5 space-y-0.5">
            <p className="text-[9px] text-success uppercase tracking-wider font-medium">Campos Mapeados</p>
            <p className="text-lg font-bold text-success tabular-nums">{schemaAudit.totalMapped}</p>
            <p className="text-[10px] text-muted-foreground">Com variável no catálogo</p>
          </div>
          <div className={cn(
            "rounded-lg border p-2.5 space-y-0.5",
            schemaAudit.totalMissing > 0 ? "border-warning/30 bg-warning/5" : "border-border bg-card"
          )}>
            <p className="text-[9px] text-warning uppercase tracking-wider font-medium">Sem Variável</p>
            <p className="text-lg font-bold text-warning tabular-nums">{schemaAudit.totalMissing}</p>
            <p className="text-[10px] text-muted-foreground">Precisam mapeamento</p>
          </div>
          <div className={cn(
            "rounded-lg border p-2.5 space-y-0.5",
            ghostVariables.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
          )}>
            <p className="text-[9px] text-destructive uppercase tracking-wider font-medium">Variáveis Fantasma</p>
            <p className="text-lg font-bold text-destructive tabular-nums">{ghostVariables.length}</p>
            <p className="text-[10px] text-muted-foreground">Sem coluna no banco</p>
          </div>
        </div>

        {/* Row 2: Resolver coverage KPIs — honest view */}
        <div className="flex items-center gap-2 mt-4 mb-1">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Catálogo Global — Cobertura de Resolver (catálogo × implementação)</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[280px] text-xs">
              <p>Indica quantas variáveis do catálogo têm resolver mapeado (RESOLVER_MAP). Variáveis com fonte "Desconhecida" não têm resolver identificado e podem sair em branco no PDF.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="rounded-lg border border-border bg-card p-2.5 space-y-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Total Catálogo</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{resolverCoverage.totalCatalog}</p>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-2.5 space-y-0.5">
            <p className="text-[9px] text-success uppercase tracking-wider font-medium">Com Resolver</p>
            <p className="text-lg font-bold text-success tabular-nums">{resolverCoverage.withResolver}</p>
          </div>
          <div className={cn(
            "rounded-lg border p-2.5 space-y-0.5",
            resolverCoverage.ghostCount > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
          )}>
            <p className="text-[9px] text-destructive uppercase tracking-wider font-medium">Sem Resolver</p>
            <p className="text-lg font-bold text-destructive tabular-nums">{resolverCoverage.ghostCount}</p>
          </div>
          <div className={cn(
            "rounded-lg border p-2.5 space-y-0.5",
            resolverCoverage.pendingCount > 0 ? "border-warning/30 bg-warning/5" : "border-border bg-card"
          )}>
            <p className="text-[9px] text-warning uppercase tracking-wider font-medium">Pendentes</p>
            <p className="text-lg font-bold text-warning tabular-nums">{resolverCoverage.pendingCount}</p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-0.5">
            <p className="text-[9px] text-primary uppercase tracking-wider font-medium">Cobertura Real</p>
            <p className="text-lg font-bold text-primary tabular-nums">{resolverCoverage.coveragePct}%</p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* SECTION: Category Breakdown (right after KPIs) */}
      {/* ════════════════════════════════════════════════════════ */}
      <CategoryAuditSection entries={categoryAudit} />

      {/* ════════════════════════════════════════════════════════ */}
      {/* GHOST VARIABLES */}
      {/* ════════════════════════════════════════════════════════ */}
      {ghostVariables.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Ghost className="h-4 w-4 text-destructive" />
            <span className="text-xs font-semibold text-foreground">Variáveis Fantasma</span>
            <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">
              {ghostVariables.length}
            </Badge>
            <span className="text-[10px] text-muted-foreground">— Referenciam colunas que não existem mais no banco</span>
          </div>
          <div className="rounded-lg border border-destructive/20 overflow-hidden">
            <ShadTable>
              <ShadTableHeader>
                <ShadTableRow className="bg-destructive/5 hover:bg-destructive/5">
                  <ShadTableHead className="text-[10px] w-[30px]">⚠️</ShadTableHead>
                  <ShadTableHead className="text-[10px]">Variável</ShadTableHead>
                  <ShadTableHead className="text-[10px]">Chave</ShadTableHead>
                  <ShadTableHead className="text-[10px]">Problema</ShadTableHead>
                </ShadTableRow>
              </ShadTableHeader>
              <ShadTableBody>
                {ghostVariables.map((g) => (
                  <ShadTableRow key={g.key}>
                    <ShadTableCell className="py-2"><Ghost className="h-3 w-3 text-destructive" /></ShadTableCell>
                    <ShadTableCell className="py-2"><span className="text-[11px] font-medium text-foreground">{g.label}</span></ShadTableCell>
                    <ShadTableCell className="py-2"><code className="font-mono text-destructive bg-destructive/5 px-1.5 py-0.5 rounded text-[10px]">[{g.key}]</code></ShadTableCell>
                    <ShadTableCell className="py-2"><span className="text-[10px] text-destructive">{g.reason}</span></ShadTableCell>
                  </ShadTableRow>
                ))}
              </ShadTableBody>
            </ShadTable>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* SECTION 0: Description Quality */}
      {/* ════════════════════════════════════════════════════════ */}
      {descriptionAudit.totalIncomplete > 0 && (
        <div className="px-4 py-3 space-y-2">
          <Button
            variant="ghost"
            className="flex items-center gap-2 w-full justify-start px-0 h-auto py-0 hover:bg-transparent"
            onClick={() => setShowDescIssues(!showDescIssues)}
          >
            {showDescIssues ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <FileWarning className="h-4 w-4 text-warning" />
            <span className="text-xs font-semibold text-foreground">Qualidade das Descrições</span>
            <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20">
              {descriptionAudit.totalIncomplete} incompleta{descriptionAudit.totalIncomplete !== 1 ? "s" : ""}
            </Badge>
          </Button>

          {showDescIssues && (
            <div className="rounded-lg border border-border overflow-hidden ml-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[30px]">⚠️</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Variável</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Chave</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Problema</th>
                  </tr>
                </thead>
                <tbody>
                  {descriptionAudit.issues.slice(0, 20).map((issue, idx) => (
                    <tr key={issue.key} className={cn("border-b border-border/40", idx % 2 === 0 ? "bg-card" : "bg-muted/10")}>
                      <td className="px-3 py-2">
                        <AlertTriangle className="h-3 w-3 text-warning" />
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] font-medium text-foreground">{issue.label}</span>
                      </td>
                      <td className="px-3 py-2">
                        <code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[10px]">[{issue.key}]</code>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={cn(
                          "text-[8px]",
                          issue.issue === "missing" ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-warning/10 text-warning border-warning/20"
                        )}>
                          {issue.issue === "missing" ? "Sem descrição" : "Descrição curta"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {descriptionAudit.issues.length > 20 && (
                <div className="px-3 py-2 text-[10px] text-muted-foreground bg-muted/20 border-t border-border">
                  +{descriptionAudit.issues.length - 20} variáveis não exibidas
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* SECTION 1: Data Flow Visual */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <TableProperties className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Cobertura do Schema</span>
          <span className="text-[10px] text-muted-foreground">— Todos os dados que alimentam uma proposta</span>
        </div>

        {/* Data flow indicator */}
        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground bg-muted/20 rounded-lg px-3 py-2 border border-border/40">
          <span className="font-semibold text-foreground">Fluxo de dados:</span>
          {SORTED_TABLES.slice(0, 5).map((t, i) => (
            <span key={t.name} className="flex items-center gap-1">
              {i > 0 && <span className="text-primary font-bold">→</span>}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-auto px-1.5 py-0.5 text-[10px] font-medium",
                  activeTable === t.name ? "bg-primary text-primary-foreground" : "bg-card border border-border/40 hover:bg-muted"
                )}
                onClick={() => setActiveTable(activeTable === t.name ? null : t.name)}
              >
                {t.icon} {t.label}
              </Button>
            </span>
          ))}
          <span className="text-primary font-bold ml-1">+</span>
          <span className="text-muted-foreground">dados complementares</span>
        </div>

        {/* Summary cards — clickable filters */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="ghost"
            onClick={() => setActiveFilter("all")}
            className={cn(
              "rounded-lg border p-2.5 text-left h-auto flex flex-col items-start transition-all",
              activeFilter === "all" ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card hover:bg-muted/20"
            )}
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total campos</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{schemaAudit.fields.length}</p>
            <p className="text-[10px] text-muted-foreground">{SORTED_TABLES.length} tabelas</p>
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveFilter("mapped")}
            className={cn(
              "rounded-lg border p-2.5 text-left h-auto flex flex-col items-start transition-all",
              activeFilter === "mapped" ? "border-success/40 bg-success/5 ring-1 ring-success/20" : "border-border bg-card hover:bg-muted/20"
            )}
          >
            <p className="text-[10px] text-success uppercase tracking-wider font-medium">Com variável</p>
            <p className="text-lg font-bold text-success tabular-nums">{schemaAudit.totalMapped}</p>
            <p className="text-[10px] text-muted-foreground">Mapeados no catálogo</p>
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveFilter("missing")}
            className={cn(
              "rounded-lg border p-2.5 text-left h-auto flex flex-col items-start transition-all",
              activeFilter === "missing" ? "border-destructive/40 bg-destructive/5 ring-1 ring-destructive/20" : "border-border bg-card hover:bg-muted/20"
            )}
          >
            <p className="text-[10px] text-destructive uppercase tracking-wider font-medium">Sem variável</p>
            <p className="text-lg font-bold text-destructive tabular-nums">{schemaAudit.totalMissing}</p>
            <p className="text-[10px] text-muted-foreground">Precisam mapeamento</p>
          </Button>
        </div>

        {/* Table filter chips — grouped by flow */}
        <div className="space-y-1.5">
          {FLOW_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider w-[100px] shrink-0">{group.label}</span>
              {SORTED_TABLES.filter(t => group.tables.includes(t.name)).map((t) => {
                const stats = schemaAudit.byTable[t.name];
                const isActive = activeTable === t.name;
                return (
                  <Button
                    key={t.name}
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTable(isActive ? null : t.name)}
                    className={cn(
                      "h-auto px-2.5 py-1 text-[10px] font-medium rounded-md",
                      isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted/40 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                    {stats.missing > 0 && (
                      <span className={cn(
                        "text-[8px] font-mono font-bold",
                        isActive ? "text-primary-foreground/70" : "text-destructive"
                      )}>
                        {stats.missing}
                      </span>
                    )}
                    {stats.missing === 0 && (
                      <CheckCircle2 className={cn("h-2.5 w-2.5", isActive ? "text-primary-foreground/70" : "text-success")} />
                    )}
                  </Button>
                );
              })}
            </div>
          ))}

          {/* "All" reset button */}
          <div className="flex items-center gap-1.5 ml-[100px]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTable(null)}
              className={cn(
                "h-auto px-2.5 py-1 text-[10px] font-medium rounded-md",
                !activeTable ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              <Filter className="h-2.5 w-2.5" />
              Todas as tabelas
            </Button>
          </div>
        </div>

        {/* Schema results table */}
        {filteredFields.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[40px]">Status</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Tabela</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Campo</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Descrição</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Variável</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[80px]">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredFields.map((field, idx) => {
                  const tableMeta = SORTED_TABLES.find((t) => t.name === field.table);
                  const suggestedKey = field.variableKey || `${field.table.replace(/s$/, "").replace("proposta_versoe", "proposta")}_${field.column}`;
                  return (
                    <tr key={`${field.table}.${field.column}`} className={cn(
                      "border-b border-border/40 transition-colors hover:bg-accent/5",
                      idx % 2 === 0 ? "bg-card" : "bg-muted/10"
                    )}>
                      <td className="px-3 py-2">
                        {field.hasVariable ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive/60" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] text-muted-foreground">{tableMeta?.icon} {tableMeta?.label}</span>
                      </td>
                      <td className="px-3 py-2">
                        <code className="font-mono text-foreground bg-muted/40 px-1.5 py-0.5 rounded text-[10px]">{field.column}</code>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] text-foreground">{field.label}</span>
                      </td>
                      <td className="px-3 py-2">
                        {field.hasVariable && field.variableKey ? (
                          <code className="font-mono text-success bg-success/5 px-1.5 py-0.5 rounded text-[10px]">[{field.variableKey}]</code>
                        ) : field.variableKey ? (
                          <span className="text-[10px] text-destructive/70 flex items-center gap-1">
                            <code className="font-mono bg-destructive/5 px-1.5 py-0.5 rounded">[{field.variableKey}]</code>
                            <span>← esperada</span>
                          </span>
                        ) : (
                          <code className="font-mono text-muted-foreground/50 bg-muted/20 px-1.5 py-0.5 rounded text-[10px] italic">[{suggestedKey}]</code>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {!field.hasVariable && onRequestCreateVariable && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/10 border-primary/30"
                            onClick={() => {
                              const tableMeta2 = SORTED_TABLES.find((t) => t.name === field.table);
                              const colMeta = tableMeta2?.columns.find((c) => c.column === field.column);
                              onRequestCreateVariable({
                                nome: suggestedKey,
                                label: field.label,
                                table: field.table,
                                column: field.column,
                                colType: colMeta?.colType,
                              });
                            }}
                          >
                            <PlusCircle className="h-3 w-3" />
                            Criar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 mx-auto opacity-20 mb-1" />
            <p className="text-xs">Nenhum campo encontrado com esse filtro.</p>
          </div>
        )}
      </div>




      {/* ════════════════════════════════════════════════════════ */}
      {/* SECTION 2: Custom Variables Sync */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-warning" />
          <span className="text-xs font-semibold text-foreground">Variáveis Customizadas</span>
          <span className="text-[10px] text-muted-foreground">— catálogo × banco (proposta_variaveis_custom)</span>
          {totalCustomDivergences > 0 && (
            <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20">{totalCustomDivergences} divergências</Badge>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg border border-border bg-card p-2.5 space-y-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Catálogo</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{schemaAudit.fields.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5 space-y-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Banco</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{dbCustomVars.length}</p>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-2.5 space-y-0.5">
            <p className="text-[9px] text-success uppercase tracking-wider font-medium">Sync</p>
            <p className="text-lg font-bold text-success tabular-nums">{customAudit.synced.length}</p>
          </div>
          <div className={cn(
            "rounded-lg border p-2.5 space-y-0.5",
            totalCustomDivergences > 0 ? "border-warning/30 bg-warning/5" : "border-border bg-card"
          )}>
            <p className="text-[9px] text-warning uppercase tracking-wider font-medium">Divergências</p>
            <p className="text-lg font-bold text-warning tabular-nums">{totalCustomDivergences}</p>
          </div>
        </div>

        {/* Divergence sections */}
        {customAudit.missingDb.length > 0 && (
          <AuditSection
            title="Faltam no banco"
            icon={<XCircle className="h-3.5 w-3.5 text-destructive" />}
            count={customAudit.missingDb.length}
            badgeColor="bg-destructive/10 text-destructive border-destructive/20"
            items={customAudit.missingDb}
            defaultOpen
          />
        )}
        {customAudit.missingCatalog.length > 0 && (
          <AuditSection
            title="Faltam no catálogo"
            icon={<AlertTriangle className="h-3.5 w-3.5 text-warning" />}
            count={customAudit.missingCatalog.length}
            badgeColor="bg-warning/10 text-warning border-warning/20"
            items={customAudit.missingCatalog}
            defaultOpen
          />
        )}

        {/* Synced (collapsed) */}
        <Button
          variant="ghost"
          onClick={() => setShowSynced(!showSynced)}
          className="flex items-center gap-2 w-full justify-start px-0 h-auto py-0 hover:bg-transparent"
        >
          {showSynced ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          <span className="text-[11px] font-medium text-foreground">Sincronizadas</span>
          <Badge variant="outline" className="text-[8px] bg-success/10 text-success border-success/20">{customAudit.synced.length}</Badge>
        </Button>
        {showSynced && (
          <div className="ml-6 flex flex-wrap gap-1">
            {customAudit.synced.map((item) => (
              <Badge key={item.key} variant="outline" className="text-[9px] font-mono bg-success/5 text-success/80 border-success/20">[{item.key}]</Badge>
            ))}
          </div>
        )}

        {totalCustomDivergences === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 mx-auto opacity-20 mb-1" />
            <p className="text-[11px] font-medium">Tudo sincronizado!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section sub-component ────────────────────────────────────
function AuditSection({
  title, icon, count, badgeColor, items, defaultOpen = false,
}: {
  title: string; icon: React.ReactNode; count: number; badgeColor: string; items: AuditItem[]; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Button
        variant="ghost"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full justify-start px-3 py-2 h-auto rounded-none bg-muted/20 hover:bg-muted/30"
      >
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        {icon}
        <span className="text-[11px] font-semibold text-foreground">{title}</span>
        <Badge variant="outline" className={`text-[8px] ${badgeColor}`}>{count}</Badge>
      </Button>
      {open && (
        <table className="w-full text-xs">
          <tbody>
            {items.map((item, idx) => {
              const cfg = statusConfig[item.status];
              const Icon = cfg.icon;
              return (
                <tr key={item.key} className={cn(
                  "border-t border-border/40",
                  idx % 2 === 0 ? "bg-card" : "bg-muted/10"
                )}>
                  <td className="px-3 py-2 w-[30px]"><Icon className={`h-3 w-3 ${cfg.color}`} /></td>
                  <td className="px-3 py-2"><span className="text-[11px] font-medium text-foreground">{item.label}</span></td>
                  <td className="px-3 py-2"><code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[10px]">[{item.key}]</code></td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[8px] font-mono">{item.source}</Badge></td>
                  <td className="px-3 py-2"><span className="text-[10px] text-muted-foreground flex items-center gap-1"><Info className="h-2.5 w-2.5 shrink-0" />{item.action}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Category Audit Section ───────────────────────────────────
function CategoryAuditSection({ entries }: { entries: CategoryAuditEntry[] }) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const totalVars = entries.reduce((sum, e) => sum + e.total, 0);

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Auditoria por Categoria</span>
        <span className="text-[10px] text-muted-foreground">— {totalVars} variáveis em {entries.length} categorias</span>
      </div>

      {/* Legenda de status */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] bg-muted/20 rounded-lg px-3 py-2 border border-border/40">
        <span className="font-semibold text-foreground">Legenda:</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> OK — Resolver mapeado</span>
        <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> Fantasma — Sem resolver</span>
        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-warning" /> Pendente — Não implementada</span>
        <span className="text-muted-foreground">|</span>
        <span className="flex items-center gap-1">📸 Snapshot</span>
        <span className="flex items-center gap-1">👤 BD: Cliente</span>
        <span className="flex items-center gap-1">👔 BD: Consultor</span>
        <span className="flex items-center gap-1">🧮 Calculada</span>
        <span className="flex items-center gap-1">❓ Desconhecida</span>
      </div>

      {/* Category grid with summary badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {entries.map((entry) => {
          const isActive = expandedCat === entry.category;
          const okCount = entry.variables.filter(v => !v.notImplemented && v.source !== "unknown").length;
          const ghostCount = entry.variables.filter(v => v.source === "unknown").length;
          const pendingCount = entry.variables.filter(v => v.notImplemented).length;
          return (
            <Button
              key={entry.category}
              variant="ghost"
              onClick={() => setExpandedCat(isActive ? null : entry.category)}
              className={cn(
                "rounded-lg border p-2.5 text-left h-auto flex flex-col items-start transition-all gap-1",
                isActive
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-card hover:bg-muted/20"
              )}
            >
              <div className="flex items-center gap-1.5 w-full">
                <span className="text-sm">{entry.icon}</span>
                <span className="text-[10px] font-medium text-foreground truncate flex-1">{entry.label}</span>
              </div>
              <p className="text-lg font-bold text-foreground tabular-nums">{entry.total}</p>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[8px] px-1 py-0 rounded bg-success/10 text-success font-semibold">✅ {okCount}</span>
                {ghostCount > 0 && <span className="text-[8px] px-1 py-0 rounded bg-destructive/10 text-destructive font-semibold">❓ {ghostCount}</span>}
                {pendingCount > 0 && <span className="text-[8px] px-1 py-0 rounded bg-warning/10 text-warning font-semibold">⚠️ {pendingCount}</span>}
              </div>
            </Button>
          );
        })}
      </div>

      {/* Expanded category detail — card-based layout, no horizontal scroll */}
      {expandedCat && (() => {
        const entry = entries.find((e) => e.category === expandedCat);
        if (!entry) return null;
        const okCount = entry.variables.filter(v => !v.notImplemented && v.source !== "unknown").length;
        const ghostCount = entry.variables.filter(v => v.source === "unknown" && !v.notImplemented).length;
        const pendingCount = entry.variables.filter(v => v.notImplemented).length;
        return (
          <div className="rounded-lg border border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/20 border-b border-border flex-wrap">
              <span className="text-base">{entry.icon}</span>
              <span className="text-sm font-semibold text-foreground">{entry.label}</span>
              <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20">{entry.total} variáveis</Badge>
              <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/20">✅ {okCount} OK</Badge>
              {ghostCount > 0 && <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">❓ {ghostCount} fantasma</Badge>}
              {pendingCount > 0 && <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20">⚠️ {pendingCount} pendente</Badge>}
            </div>

            {/* Variable list — stacked cards */}
            <div className="divide-y divide-border/40 max-h-[500px] overflow-y-auto">
              {entry.variables.map((v, idx) => {
                const srcInfo = SOURCE_LABELS[v.source];
                const isOk = !v.notImplemented && v.source !== "unknown";
                const isGhost = v.source === "unknown" && !v.notImplemented;
                const isPending = !!v.notImplemented;

                return (
                  <div
                    key={v.key}
                    className={cn(
                      "px-3 py-2 flex flex-col gap-1 transition-colors hover:bg-accent/5",
                      idx % 2 === 0 ? "bg-card" : "bg-muted/10",
                      isGhost && "bg-destructive/[0.04] border-l-2 border-l-destructive/40",
                      isPending && "bg-warning/[0.04] border-l-2 border-l-warning/40 opacity-70",
                      isOk && "border-l-2 border-l-success/40"
                    )}
                  >
                    {/* Row 1: Status icon + Label + Key */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status icon */}
                      {isPending ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                      ) : isGhost ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      )}

                      {/* Label */}
                      <span className="text-xs font-medium text-foreground">{v.label}</span>

                      {/* Key */}
                      <code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[10px] shrink-0">[{v.key}]</code>
                    </div>

                    {/* Row 2: Origem + Resolver + Status text */}
                    <div className="flex items-center gap-2 ml-5 flex-wrap">
                      {/* Origem badge */}
                      <Badge variant="outline" className={cn(
                        "text-[9px] gap-0.5 h-5",
                        v.source === "snapshot" && "bg-info/10 text-info border-info/20",
                        (v.source === "db_cliente" || v.source === "db_lead" || v.source === "db_consultor" || v.source === "db_projeto" || v.source === "db_proposta" || v.source === "db_versao") && "bg-primary/10 text-primary border-primary/20",
                        v.source === "computed" && "bg-warning/10 text-warning border-warning/20",
                        v.source === "custom_vc" && "bg-success/10 text-success border-success/20",
                        v.source === "unknown" && "bg-destructive/10 text-destructive border-destructive/20",
                      )}>
                        {srcInfo.icon} {srcInfo.label}
                      </Badge>

                      {/* Resolver */}
                      {v.resolver ? (
                        <span className="text-[10px] text-muted-foreground">
                          via <code className="font-mono bg-muted/40 px-1 py-0.5 rounded text-[9px]">{v.resolver}</code>
                        </span>
                      ) : (
                        <span className="text-[10px] text-destructive font-medium">❌ Sem resolver</span>
                      )}

                      {/* Status text */}
                      {isPending && <span className="text-[10px] text-warning font-medium">— ⚠️ Não implementada</span>}
                      {isGhost && <span className="text-[10px] text-destructive font-medium">— ❌ Variável fantasma (pode sair em branco no PDF!)</span>}

                      {/* Description */}
                      {v.description && (
                        <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">— {v.description}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}