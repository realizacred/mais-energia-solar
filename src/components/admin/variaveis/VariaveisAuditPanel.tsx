import { useMemo, useState, useCallback } from "react";
import {
  CheckCircle2, AlertTriangle, XCircle, Download, Search, X,
  Filter, ShieldCheck, Clock, AlertCircle, Ban, FileWarning,
  Database, BarChart3, ListOrdered, Loader2, Info, Code2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { runVariableAudit, auditToCSV } from "@/services/variableAudit";
import type { AuditResult, AuditStatus, SnapshotObservation } from "@/services/variableAudit";
import { CATEGORY_LABELS, type VariableCategory } from "@/lib/variablesCatalog";

const STATUS_CONFIG: Record<AuditStatus, { label: string; icon: React.ElementType; className: string }> = {
  OK: { label: "OK", icon: CheckCircle2, className: "bg-success/10 text-success border-success/20" },
  LEGADA: { label: "Legada", icon: Clock, className: "bg-info/10 text-info border-info/20" },
  NOT_IMPLEMENTED: { label: "Não Impl.", icon: Ban, className: "bg-muted text-muted-foreground border-border" },
  FALTA_RESOLVER_FRONTEND: { label: "Falta FE", icon: AlertTriangle, className: "bg-warning/10 text-warning border-warning/20" },
  FALTA_RESOLVER_BACKEND: { label: "Falta BE", icon: AlertTriangle, className: "bg-warning/10 text-warning border-warning/20" },
  FALTA_ORIGEM: { label: "S/ Origem", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  FALTA_CATALOGAR: { label: "S/ Catálogo", icon: FileWarning, className: "bg-destructive/10 text-destructive border-destructive/20" },
  ORFA: { label: "Órfã", icon: AlertCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  CONFLITANTE: { label: "Conflito", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export function VariaveisAuditPanel() {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLegacy, setFilterLegacy] = useState<string>("all");
  const [filterSnapshot, setFilterSnapshot] = useState<string>("all");

  const runAudit = useCallback(async (withSnapshots = false) => {
    setLoading(true);
    if (withSnapshots) setLoadingSnapshots(true);

    try {
      let snapshotData: Record<string, SnapshotObservation> | undefined;

      if (withSnapshots) {
        const staticResult = runVariableAudit();
        const keys = staticResult.records.map(r => r.key);

        const { data, error } = await supabase.functions.invoke("audit-variables-snapshot", {
          body: { keys },
          headers: { "x-client-timeout": "120" },
        });

        if (error) {
          console.error("Snapshot audit error:", error);
          toast.error("Erro ao buscar snapshots reais. Auditoria estática será exibida.");
        } else if (data?.observed_keys) {
          snapshotData = data.observed_keys;
          toast.success(`${data.total_snapshots_sampled} snapshots analisados`);
        }
      }

      const result = runVariableAudit(snapshotData);
      setAudit(result);
      const meta = result.analysis_metadata;
      toast.success(
        `Auditoria real concluída: ${result.summary.total} variáveis | FE: ${meta.frontend_resolver.total_explicit_keys} keys | BE: ${meta.backend_flatten.total_explicit_keys} keys | Preview: ${meta.template_preview.total_explicit_keys} keys`
      );
    } catch (err) {
      console.error("Audit error:", err);
      const result = runVariableAudit();
      setAudit(result);
      toast.error("Erro parcial na auditoria.");
    } finally {
      setLoading(false);
      setLoadingSnapshots(false);
    }
  }, []);

  const filteredRecords = useMemo(() => {
    if (!audit) return [];
    let records = audit.records;
    if (search.trim()) {
      const q = search.toLowerCase();
      records = records.filter(r =>
        r.key.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.legacy_aliases.some(a => a.toLowerCase().includes(q))
      );
    }
    if (filterGroup !== "all") records = records.filter(r => r.group === filterGroup);
    if (filterStatus !== "all") records = records.filter(r => r.status === filterStatus);
    if (filterLegacy === "legacy") records = records.filter(r => r.is_legacy);
    else if (filterLegacy === "not_legacy") records = records.filter(r => !r.is_legacy);
    else if (filterLegacy === "not_implemented") records = records.filter(r => r.not_implemented);
    if (filterSnapshot === "observed") records = records.filter(r => r.observed_in_real_snapshots);
    else if (filterSnapshot === "not_observed") records = records.filter(r => !r.observed_in_real_snapshots);
    return records;
  }, [audit, search, filterGroup, filterStatus, filterLegacy, filterSnapshot]);

  const exportJSON = useCallback(() => {
    if (!audit) return;
    const blob = new Blob([JSON.stringify(audit, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-variaveis-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exportado");
  }, [audit]);

  const exportCSV = useCallback(() => {
    if (!audit) return;
    const csv = auditToCSV(audit);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-variaveis-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  }, [audit]);

  if (!audit && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <ShieldCheck className="w-12 h-12 text-muted-foreground/40" />
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">Auditoria Real de Consistência</p>
          <p className="text-xs text-muted-foreground max-w-md">
            Analisa o código-fonte real do resolver frontend, flatten backend e template-preview
            para verificar cobertura de cada variável do catálogo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => runAudit(false)}>
            <Code2 className="w-4 h-4 mr-1.5" />
            Auditoria de Código
          </Button>
          <Button size="sm" onClick={() => runAudit(true)}>
            <Database className="w-4 h-4 mr-1.5" />
            Completa (+ Snapshots Reais)
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {loadingSnapshots && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analisando snapshots reais de propostas...
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!audit) return null;
  const { summary, analysis_metadata: meta } = audit;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Analysis metadata banner */}
      <div className="shrink-0 px-3 pt-2 pb-1 border-b border-border bg-muted/30">
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Análise real de código-fonte:</span>
          <span>FE Resolver: <strong className="text-foreground">{meta.frontend_resolver.total_explicit_keys}</strong> keys ({meta.frontend_resolver.source_lines} linhas)</span>
          <span>BE Flatten: <strong className="text-foreground">{meta.backend_flatten.total_explicit_keys}</strong> keys ({meta.backend_flatten.source_lines} linhas)</span>
          <span>Preview: <strong className="text-foreground">{meta.template_preview.total_explicit_keys}</strong> keys ({meta.template_preview.source_lines} linhas)</span>
          {meta.template_preview.has_dynamic_snapshot_passthrough && (
            <Badge variant="outline" className="text-[9px] h-4 border-info/30 text-info">passthrough dinâmico</Badge>
          )}
          {meta.frontend_resolver.has_final_snapshot_fallback && (
            <Badge variant="outline" className="text-[9px] h-4 border-info/30 text-info">finalSnapshot fallback</Badge>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="shrink-0 p-3 border-b border-border">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-11 gap-2">
          <SummaryCard label="Total" value={summary.total} className="text-foreground" />
          <SummaryCard label="OK" value={summary.ok} className="text-success" />
          <SummaryCard label="Legadas" value={summary.legacy} className="text-info" />
          <SummaryCard label="Não Impl." value={summary.not_implemented} className="text-muted-foreground" />
          <SummaryCard label="Falta FE" value={summary.missing_frontend} className="text-warning" />
          <SummaryCard label="Falta BE" value={summary.missing_backend} className="text-warning" />
          <SummaryCard label="S/ Origem" value={summary.missing_origin} className="text-destructive" />
          <SummaryCard label="Órfãs" value={summary.orphaned} className="text-destructive" />
          <SummaryCard label="Conflito" value={summary.conflicting} className="text-destructive" />
          <SummaryCard label="Em Snap." value={summary.observed_in_snapshots} className="text-success" />
          <SummaryCard label="S/ Snap." value={summary.not_observed_in_snapshots} className="text-warning" />
        </div>
      </div>

      <Tabs defaultValue="detalhes" className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0 px-3 pt-2 border-b border-border">
          <TabsList className="h-8">
            <TabsTrigger value="detalhes" className="text-xs gap-1">
              <Filter className="w-3 h-3" /> Detalhes
            </TabsTrigger>
            <TabsTrigger value="grupos" className="text-xs gap-1">
              <BarChart3 className="w-3 h-3" /> Por Grupo
            </TabsTrigger>
            <TabsTrigger value="backlog" className="text-xs gap-1">
              <ListOrdered className="w-3 h-3" /> Backlog
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Details Tab ── */}
        <TabsContent value="detalhes" className="flex flex-col flex-1 min-h-0 mt-0">
          <div className="shrink-0 p-3 border-b border-border flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por chave, label ou alias..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs pl-8"
              />
              {search && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setSearch("")}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Grupo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterLegacy} onValueChange={setFilterLegacy}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="legacy">Legadas</SelectItem>
                <SelectItem value="not_legacy">Não legadas</SelectItem>
                <SelectItem value="not_implemented">Não impl.</SelectItem>
              </SelectContent>
            </Select>
            {audit.snapshot_data_loaded && (
              <Select value={filterSnapshot} onValueChange={setFilterSnapshot}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Snapshot" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="observed">Observadas</SelectItem>
                  <SelectItem value="not_observed">Não observadas</SelectItem>
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <Badge variant="outline" className="text-[10px]">{filteredRecords.length} de {summary.total}</Badge>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportJSON}>
                <Download className="w-3 h-3 mr-1" /> JSON
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCSV}>
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => runAudit(audit.snapshot_data_loaded)}>
                Reexecutar
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <TooltipProvider delayDuration={300}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 z-10 backdrop-blur-sm">
                  <tr className="text-[10px] uppercase text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Variável</th>
                    <th className="text-left py-2 px-3 font-medium">Grupo</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-center py-2 px-3 font-medium">FE</th>
                    <th className="text-center py-2 px-3 font-medium">BE</th>
                    <th className="text-center py-2 px-3 font-medium">Preview</th>
                    {audit.snapshot_data_loaded && (
                      <th className="text-center py-2 px-3 font-medium">Snap.</th>
                    )}
                    <th className="text-left py-2 px-3 font-medium">Origem</th>
                    <th className="text-left py-2 px-3 font-medium">Ação</th>
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => {
                    const sc = STATUS_CONFIG[r.status];
                    const Icon = sc.icon;
                    return (
                      <tr key={r.key} className="border-b border-border/10 hover:bg-muted/20 transition-colors">
                        <td className="py-2 px-3">
                          <code className="font-mono text-[10px] text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                            {`{{${r.key}}}`}
                          </code>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[220px]">{r.label}</p>
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-[10px] text-muted-foreground">
                            {CATEGORY_LABELS[r.group as VariableCategory] || r.group}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className={`text-[9px] gap-0.5 ${sc.className}`}>
                            <Icon className="w-2.5 h-2.5" />
                            {sc.label}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-center"><BoolBadge value={r.exists_in_frontend_resolver} /></td>
                        <td className="py-2 px-3 text-center"><BoolBadge value={r.exists_in_backend_flatten} /></td>
                        <td className="py-2 px-3 text-center"><BoolBadge value={r.exists_in_backend_template_preview} /></td>
                        {audit.snapshot_data_loaded && (
                          <td className="py-2 px-3 text-center"><BoolBadge value={r.observed_in_real_snapshots} /></td>
                        )}
                        <td className="py-2 px-3">
                          <span className="text-[10px] text-muted-foreground truncate block max-w-[140px]">
                            {r.canonical_source}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] font-medium ${r.recommended_action === "NENHUMA" ? "text-muted-foreground" : "text-warning"}`}>
                            {r.recommended_action}
                          </span>
                        </td>
                        <td className="py-1 px-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-5 w-5">
                                <Info className="w-3 h-3 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[300px]">
                              <p className="text-xs">{r.evidence}</p>
                              {r.snapshot_sample_value && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Exemplo: <code>{r.snapshot_sample_value}</code>
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={audit.snapshot_data_loaded ? 10 : 9} className="py-12 text-center text-muted-foreground text-sm">
                        Nenhuma variável encontrada com os filtros aplicados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TooltipProvider>
          </ScrollArea>
        </TabsContent>

        {/* ── Groups Tab ── */}
        <TabsContent value="grupos" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {audit.group_summaries.map((gs) => (
                <Card key={gs.group} className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{gs.group_label}</p>
                        <p className="text-xs text-muted-foreground">{gs.total} variáveis</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="text-center">
                          <p className="font-bold text-success">{gs.ok}</p>
                          <p className="text-[9px] text-muted-foreground">OK</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-warning">{gs.problems}</p>
                          <p className="text-[9px] text-muted-foreground">Problemas</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-20 shrink-0">Completude</span>
                        <Progress value={gs.completeness_pct} className="h-2 flex-1" />
                        <span className="text-[10px] font-medium text-foreground w-10 text-right">{gs.completeness_pct}%</span>
                      </div>
                      {audit.snapshot_data_loaded && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-20 shrink-0">Snapshots</span>
                          <Progress value={gs.observed_pct} className="h-2 flex-1" />
                          <span className="text-[10px] font-medium text-foreground w-10 text-right">{gs.observed_pct}%</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ── Backlog Tab ── */}
        <TabsContent value="backlog" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-3">
                Top 20 variáveis mais críticas, ordenadas por impacto na proposta/documento.
              </p>
              <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-foreground w-8">#</TableHead>
                      <TableHead className="font-semibold text-foreground">Variável</TableHead>
                      <TableHead className="font-semibold text-foreground">Grupo</TableHead>
                      <TableHead className="font-semibold text-foreground">Status</TableHead>
                      <TableHead className="font-semibold text-foreground">Impacto</TableHead>
                      <TableHead className="font-semibold text-foreground">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.backlog.map((item, i) => {
                      const sc = STATUS_CONFIG[item.status];
                      const Icon = sc.icon;
                      return (
                        <TableRow key={item.key} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell>
                            <code className="font-mono text-[10px] text-primary bg-primary/5 px-1 py-0.5 rounded">
                              {`{{${item.key}}}`}
                            </code>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {CATEGORY_LABELS[item.group as VariableCategory] || item.group}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[9px] gap-0.5 ${sc.className}`}>
                              <Icon className="w-2.5 h-2.5" />
                              {sc.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground max-w-[200px]">
                            {item.impact}
                          </TableCell>
                          <TableCell>
                            <span className="text-[10px] font-medium text-warning">{item.action}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {audit.backlog.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success/40" />
                          Nenhuma variável crítica pendente!
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-2 text-center">
        <p className={`text-lg font-bold leading-none ${className}`}>{value}</p>
        <p className="text-[9px] text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function BoolBadge({ value }: { value: boolean }) {
  return (
    <span className={`text-[10px] font-bold ${value ? "text-success" : "text-destructive/50"}`}>
      {value ? "✓" : "✗"}
    </span>
  );
}
