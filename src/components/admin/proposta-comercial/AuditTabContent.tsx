import { useMemo, useState } from "react";
import {
  ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronRight, Info, Database, Filter, TableProperties, PlusCircle, FileWarning, Ghost
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useVariablesAudit,
  SORTED_TABLES,
  FLOW_GROUPS,
  type DbCustomVar,
  type AuditItem,
  type AuditStatus,
} from "@/hooks/useVariablesAudit";

// ── Status config ──────────────────────────────────────────
const statusConfig: Record<AuditStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  ok: { icon: CheckCircle2, color: "text-success", label: "Sincronizada" },
  missing_catalog: { icon: AlertTriangle, color: "text-warning", label: "Falta no catálogo" },
  missing_db: { icon: XCircle, color: "text-destructive", label: "Falta no banco" },
};

// ── Main Component ──────────────────────────────────────────
export function AuditTabContent({
  dbCustomVars,
  loadingCustom,
  onRefresh,
  onRequestCreateVariable,
}: {
  dbCustomVars: DbCustomVar[];
  loadingCustom: boolean;
  onRefresh: () => void;
  onRequestCreateVariable?: (suggested: { nome: string; label: string; table: string; column: string }) => void;
}) {
  const [showSynced, setShowSynced] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "missing" | "mapped">("all");
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [showDescIssues, setShowDescIssues] = useState(false);

  const { customAudit, schemaAudit, descriptionAudit, ghostVariables, totalCustomDivergences } = useVariablesAudit(dbCustomVars);

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
          <span className="text-[10px] text-muted-foreground">— Cruzamento catálogo × banco × schema</span>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} className="h-7 text-xs gap-1.5">
          <RefreshCw className="h-3 w-3" /> Reanalisar
        </Button>
      </div>

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
                            onClick={() => onRequestCreateVariable({
                              nome: suggestedKey,
                              label: field.label,
                              table: field.table,
                              column: field.column,
                            })}
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
