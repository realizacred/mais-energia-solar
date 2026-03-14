import { useMemo, useState, useCallback } from "react";
import {
  CheckCircle2, AlertTriangle, XCircle, Download, Search, X,
  Filter, ShieldCheck, Clock, AlertCircle, Ban, FileWarning,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { runVariableAudit, auditToCSV } from "@/services/variableAudit";
import type { AuditResult, AuditStatus } from "@/services/variableAudit";
import { CATEGORY_LABELS, type VariableCategory } from "@/lib/variablesCatalog";

const STATUS_CONFIG: Record<AuditStatus, { label: string; icon: React.ElementType; className: string }> = {
  OK: { label: "OK", icon: CheckCircle2, className: "bg-success/10 text-success border-success/20" },
  LEGADA: { label: "Legada", icon: Clock, className: "bg-info/10 text-info border-info/20" },
  NOT_IMPLEMENTED: { label: "Não Impl.", icon: Ban, className: "bg-muted text-muted-foreground border-border" },
  FALTA_RESOLVER_FRONTEND: { label: "Falta Frontend", icon: AlertTriangle, className: "bg-warning/10 text-warning border-warning/20" },
  FALTA_RESOLVER_BACKEND: { label: "Falta Backend", icon: AlertTriangle, className: "bg-warning/10 text-warning border-warning/20" },
  FALTA_ORIGEM: { label: "Falta Origem", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  FALTA_CATALOGAR: { label: "Falta Catálogo", icon: FileWarning, className: "bg-destructive/10 text-destructive border-destructive/20" },
  ORFA: { label: "Órfã", icon: AlertCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  CONFLITANTE: { label: "Conflitante", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export function VariaveisAuditPanel() {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLegacy, setFilterLegacy] = useState<string>("all");

  const runAudit = useCallback(() => {
    setLoading(true);
    // Run in next tick to allow UI to show loading state
    setTimeout(() => {
      const result = runVariableAudit();
      setAudit(result);
      setLoading(false);
      toast.success(`Auditoria concluída: ${result.summary.total} variáveis analisadas`);
    }, 100);
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
    if (filterGroup !== "all") {
      records = records.filter(r => r.group === filterGroup);
    }
    if (filterStatus !== "all") {
      records = records.filter(r => r.status === filterStatus);
    }
    if (filterLegacy === "legacy") {
      records = records.filter(r => r.is_legacy);
    } else if (filterLegacy === "not_legacy") {
      records = records.filter(r => !r.is_legacy);
    } else if (filterLegacy === "not_implemented") {
      records = records.filter(r => r.not_implemented);
    }
    return records;
  }, [audit, search, filterGroup, filterStatus, filterLegacy]);

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
          <p className="text-sm font-medium text-foreground">Auditoria de Consistência</p>
          <p className="text-xs text-muted-foreground max-w-md">
            Analisa todas as variáveis do catálogo e verifica se estão corretamente resolvidas
            no frontend, backend e templates DOCX.
          </p>
        </div>
        <Button onClick={runAudit} size="sm">
          <ShieldCheck className="w-4 h-4 mr-1.5" />
          Executar Auditoria
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
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
  const { summary } = audit;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Summary Cards */}
      <div className="shrink-0 p-3 border-b border-border">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-2">
          <SummaryCard label="Total" value={summary.total} className="text-foreground" />
          <SummaryCard label="OK" value={summary.ok} className="text-success" />
          <SummaryCard label="Legadas" value={summary.legacy} className="text-info" />
          <SummaryCard label="Não Impl." value={summary.not_implemented} className="text-muted-foreground" />
          <SummaryCard label="Falta FE" value={summary.missing_frontend} className="text-warning" />
          <SummaryCard label="Falta BE" value={summary.missing_backend} className="text-warning" />
          <SummaryCard label="S/ Origem" value={summary.missing_origin} className="text-destructive" />
          <SummaryCard label="Órfãs" value={summary.orphaned} className="text-destructive" />
          <SummaryCard label="Conflito" value={summary.conflicting} className="text-destructive" />
        </div>
      </div>

      {/* Filters */}
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
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <Filter className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLegacy} onValueChange={setFilterLegacy}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="legacy">Legadas</SelectItem>
            <SelectItem value="not_legacy">Não legadas</SelectItem>
            <SelectItem value="not_implemented">Não impl.</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 ml-auto">
          <Badge variant="outline" className="text-[10px]">
            {filteredRecords.length} de {summary.total}
          </Badge>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportJSON}>
            <Download className="w-3 h-3 mr-1" /> JSON
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCSV}>
            <Download className="w-3 h-3 mr-1" /> CSV
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={runAudit}>
            Reexecutar
          </Button>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1 min-h-0">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 z-10 backdrop-blur-sm">
            <tr className="text-[10px] uppercase text-muted-foreground">
              <th className="text-left py-2 px-3 font-medium">Variável</th>
              <th className="text-left py-2 px-3 font-medium">Grupo</th>
              <th className="text-left py-2 px-3 font-medium">Status</th>
              <th className="text-center py-2 px-3 font-medium">FE</th>
              <th className="text-center py-2 px-3 font-medium">BE</th>
              <th className="text-center py-2 px-3 font-medium">DOCX</th>
              <th className="text-left py-2 px-3 font-medium">Origem</th>
              <th className="text-left py-2 px-3 font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((r) => {
              const sc = STATUS_CONFIG[r.status];
              const Icon = sc.icon;
              return (
                <tr key={r.key} className="border-b border-border/10 hover:bg-muted/20 transition-colors">
                  <td className="py-2 px-3">
                    <div>
                      <code className="font-mono text-[10px] text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                        {`{{${r.key}}}`}
                      </code>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[220px]">{r.label}</p>
                    </div>
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
                  <td className="py-2 px-3 text-center">
                    <BoolBadge value={r.exists_in_frontend_resolver} />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <BoolBadge value={r.exists_in_backend_flatten} />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <BoolBadge value={r.exists_in_backend_template_preview} />
                  </td>
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
                </tr>
              );
            })}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                  Nenhuma variável encontrada com os filtros aplicados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
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
