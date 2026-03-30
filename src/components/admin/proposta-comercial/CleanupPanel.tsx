/**
 * Variable Cleanup Panel — Admin UI for controlled variable cleanup.
 * Shows safety classification, deprecation controls, and migration actions.
 * §20: SRP — UI only, logic in services/hooks
 * RB-01: Semantic colors only
 */

import { useState, useMemo } from "react";
import { Archive, ShieldCheck, AlertTriangle, Trash2, ArrowRightLeft, EyeOff, Eye, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CleanupRecord, CleanupSummary, CleanupSafety } from "@/services/variableCleanup/types";

interface CleanupPanelProps {
  records: CleanupRecord[];
  summary: CleanupSummary;
}

const SAFETY_CONFIG: Record<CleanupSafety, { label: string; icon: typeof ShieldCheck; color: string; badgeClass: string }> = {
  NOT_SAFE: { label: "Em uso", icon: ShieldCheck, color: "text-success", badgeClass: "bg-success/10 text-success border-success/20" },
  SAFE_TO_HIDE: { label: "Ocultar", icon: EyeOff, color: "text-muted-foreground", badgeClass: "bg-muted text-muted-foreground border-border" },
  SAFE_TO_ALIAS: { label: "Alias", icon: ArrowRightLeft, color: "text-warning", badgeClass: "bg-warning/10 text-warning border-warning/20" },
  SAFE_TO_REPLACE_IN_TEMPLATE: { label: "Substituir", icon: ArrowRightLeft, color: "text-info", badgeClass: "bg-info/10 text-info border-info/20" },
  SAFE_TO_DELETE_LATER: { label: "Deletável", icon: Trash2, color: "text-destructive", badgeClass: "bg-destructive/10 text-destructive border-destructive/20" },
};

function normalize(str: string) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function CleanupPanel({ records, summary }: CleanupPanelProps) {
  const [filter, setFilter] = useState<"all" | CleanupSafety>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let items = filter === "all" ? records : records.filter(r => r.safety === filter);
    if (search.trim()) {
      const q = normalize(search);
      items = items.filter(r =>
        normalize(r.key).includes(q) ||
        normalize(r.label).includes(q) ||
        normalize(r.safetyReason).includes(q)
      );
    }
    return items;
  }, [records, filter, search]);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total" value={summary.total} icon={Archive} />
        <KpiCard label="Em uso (seguro)" value={summary.notSafe} icon={ShieldCheck} color="success" />
        <KpiCard label="Ocultáveis" value={summary.safeToHide} icon={EyeOff} color="muted" />
        <KpiCard label="Substituíveis" value={summary.safeToReplace + summary.safeToAlias} icon={ArrowRightLeft} color="warning" />
        <KpiCard label="Deletáveis" value={summary.safeToDelete} icon={Trash2} color="destructive" />
        <KpiCard label="Deprecadas" value={summary.deprecated} icon={AlertTriangle} color="warning" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            placeholder="Buscar variável..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted/20 border-border focus:bg-card"
          />
          {search && (
            <Button variant="ghost" size="icon" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setSearch("")}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {([
          { key: "all" as const, label: "Todas", count: summary.total },
          { key: "NOT_SAFE" as CleanupSafety, label: "🟢 Em uso", count: summary.notSafe },
          { key: "SAFE_TO_HIDE" as CleanupSafety, label: "👁️ Ocultáveis", count: summary.safeToHide },
          { key: "SAFE_TO_ALIAS" as CleanupSafety, label: "🔗 Alias", count: summary.safeToAlias },
          { key: "SAFE_TO_REPLACE_IN_TEMPLATE" as CleanupSafety, label: "↔️ Substituíveis", count: summary.safeToReplace },
          { key: "SAFE_TO_DELETE_LATER" as CleanupSafety, label: "🗑️ Deletáveis", count: summary.safeToDelete },
        ] as const).map((f) => (
          <Button
            key={f.key}
            variant="ghost"
            size="sm"
            onClick={() => setFilter(f.key)}
            className={cn(
              "h-6 px-2 text-[10px] rounded-md",
              filter === f.key
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
            <span className="text-[8px] font-mono ml-0.5 opacity-60">{f.count}</span>
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <ScrollArea className="max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold text-foreground text-xs w-[180px]">Variável</TableHead>
                <TableHead className="font-semibold text-foreground text-xs w-[120px]">Segurança</TableHead>
                <TableHead className="font-semibold text-foreground text-xs">Razão</TableHead>
                <TableHead className="font-semibold text-foreground text-xs w-[100px]">Uso</TableHead>
                <TableHead className="font-semibold text-foreground text-xs w-[120px]">Substituição</TableHead>
                <TableHead className="font-semibold text-foreground text-xs w-[80px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                    Nenhuma variável encontrada para este filtro.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 200).map((rec) => {
                  const cfg = SAFETY_CONFIG[rec.safety];
                  return (
                    <TableRow key={rec.key} className="hover:bg-muted/20">
                      <TableCell className="py-1.5">
                        <div>
                          <span className="text-xs font-medium text-foreground">{rec.label}</span>
                          <span className="text-[10px] text-muted-foreground font-mono block">[{rec.key}]</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant="outline" className={cn("text-[10px]", cfg.badgeClass)}>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <span className="text-[11px] text-muted-foreground">{rec.safetyReason}</span>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <span className="text-[11px] font-mono text-foreground">{rec.usage.usageCount}×</span>
                        {rec.usage.usedInActiveTemplates && (
                          <Badge variant="outline" className="text-[8px] ml-1 bg-success/10 text-success border-success/20">ativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5">
                        {rec.replacementKey ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] font-mono text-info cursor-help">[{rec.replacementKey}]</span>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px]">Substituir [{rec.key}] por [{rec.replacementKey}]</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5">
                        {rec.deprecation.deprecated ? (
                          <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20">🏚️ Deprecada</Badge>
                        ) : rec.canDelete ? (
                          <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">Deletável</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        {filtered.length > 200 && (
          <div className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border bg-muted/20">
            Mostrando 200 de {filtered.length} variáveis
          </div>
        )}
      </div>

      {/* Info box */}
      <Card className="border-info/20 bg-info/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Regras de segurança</p>
            <p>• <strong>Em uso:</strong> variável ativa em templates e gerações — protegida</p>
            <p>• <strong>Ocultáveis:</strong> sem uso real — podem ser escondidas da lista padrão</p>
            <p>• <strong>Alias/Substituíveis:</strong> legado com equivalente moderno — migração automática possível</p>
            <p>• <strong>Deletáveis:</strong> fantasmas reais sem nenhum uso — candidatas a remoção futura</p>
            <p>• Nenhuma variável é deletada automaticamente. Todas as ações requerem confirmação.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Archive; color?: string }) {
  const borderColor = color ? `border-l-${color}` : "border-l-primary";
  const bgColor = color ? `bg-${color}/10` : "bg-primary/10";
  const textColor = color ? `text-${color}` : "text-primary";
  return (
    <Card className={cn("border-l-[3px] bg-card shadow-sm", borderColor)}>
      <CardContent className="flex items-center gap-3 p-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", bgColor, textColor)}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-lg font-bold tracking-tight text-foreground leading-none">{value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
