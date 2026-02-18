import { useMemo, useState } from "react";
import { ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  VARIABLES_CATALOG,
} from "@/lib/variablesCatalog";

interface DbCustomVar {
  id: string;
  nome: string;
  label: string;
  expressao: string;
  tipo_resultado: string;
  categoria: string;
  precisao: number;
  ativo: boolean;
}

type AuditStatus = "ok" | "missing_catalog" | "missing_db";

interface AuditItem {
  key: string;
  label: string;
  status: AuditStatus;
  source: "catálogo" | "banco" | "ambos";
  detail: string;
  action: string;
}

const statusConfig: Record<AuditStatus, { icon: typeof CheckCircle2; color: string; bgColor: string; label: string }> = {
  ok: { icon: CheckCircle2, color: "text-success", bgColor: "bg-success/5", label: "Sincronizada" },
  missing_catalog: { icon: AlertTriangle, color: "text-warning", bgColor: "bg-warning/5", label: "Falta no catálogo" },
  missing_db: { icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/5", label: "Falta no banco" },
};

export function AuditTabContent({
  dbCustomVars,
  loadingCustom,
  onRefresh,
}: {
  dbCustomVars: DbCustomVar[];
  loadingCustom: boolean;
  onRefresh: () => void;
}) {
  const [showSynced, setShowSynced] = useState(false);

  const auditResults = useMemo(() => {
    const results: AuditItem[] = [];

    const catalogCustom = VARIABLES_CATALOG.filter((v) => v.category === "customizada");
    const catalogKeys = new Set(catalogCustom.map((v) => v.legacyKey.replace(/^\[|\]$/g, "")));
    const dbKeys = new Set(dbCustomVars.map((v) => v.nome));

    // Vars in catalog but NOT in DB
    for (const v of catalogCustom) {
      const key = v.legacyKey.replace(/^\[|\]$/g, "");
      if (!dbKeys.has(key)) {
        results.push({
          key,
          label: v.label,
          status: "missing_db",
          source: "catálogo",
          detail: "Definida no catálogo frontend mas não existe no banco de dados",
          action: "Criar no banco (aba Customizadas) ou remover do catálogo",
        });
      }
    }

    // Vars in DB but NOT in catalog
    for (const v of dbCustomVars) {
      if (!catalogKeys.has(v.nome)) {
        results.push({
          key: v.nome,
          label: v.label,
          status: "missing_catalog",
          source: "banco",
          detail: "Existe no banco mas não aparece no catálogo frontend",
          action: "Adicionar ao variablesCatalog.ts para aparecer na listagem",
        });
      }
    }

    // Vars present in both (OK)
    for (const v of dbCustomVars) {
      if (catalogKeys.has(v.nome)) {
        results.push({
          key: v.nome,
          label: v.label,
          status: "ok",
          source: "ambos",
          detail: "Sincronizada — presente no catálogo e no banco",
          action: "",
        });
      }
    }

    const missingCatalog = results.filter((r) => r.status === "missing_catalog");
    const missingDb = results.filter((r) => r.status === "missing_db");
    const synced = results.filter((r) => r.status === "ok");

    return {
      missingCatalog: missingCatalog.sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
      missingDb: missingDb.sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
      synced: synced.sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
      totalCatalog: VARIABLES_CATALOG.length,
      totalDb: dbCustomVars.length,
      totalNonCustom: VARIABLES_CATALOG.filter((v) => v.category !== "customizada").length,
    };
  }, [dbCustomVars]);

  if (loadingCustom) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Analisando variáveis...</span>
      </div>
    );
  }

  const totalDivergences = auditResults.missingCatalog.length + auditResults.missingDb.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-warning" />
          <span className="text-xs font-semibold text-foreground">Auditoria de Variáveis</span>
          <span className="text-[10px] text-muted-foreground">— Cruzamento catálogo × banco</span>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} className="h-7 text-xs gap-1.5">
          <RefreshCw className="h-3 w-3" /> Reanalisar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 border-b border-border">
        <div className="rounded-lg border border-border bg-card p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Catálogo Total</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{auditResults.totalCatalog}</p>
          <p className="text-[10px] text-muted-foreground">{auditResults.totalNonCustom} estáticas + customizadas</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Banco (custom)</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{auditResults.totalDb}</p>
          <p className="text-[10px] text-muted-foreground">proposta_variaveis_custom</p>
        </div>
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-1">
          <p className="text-[10px] text-success uppercase tracking-wider font-medium">Sincronizadas</p>
          <p className="text-xl font-bold text-success tabular-nums">{auditResults.synced.length}</p>
          <p className="text-[10px] text-muted-foreground">Catálogo ↔ Banco</p>
        </div>
        <div className={`rounded-lg border p-3 space-y-1 ${totalDivergences > 0 ? "border-warning/30 bg-warning/5" : "border-border bg-card"}`}>
          <p className="text-[10px] text-warning uppercase tracking-wider font-medium">Divergências</p>
          <p className="text-xl font-bold text-warning tabular-nums">{totalDivergences}</p>
          <p className="text-[10px] text-muted-foreground">
            {auditResults.missingCatalog.length > 0 && `${auditResults.missingCatalog.length} s/ catálogo`}
            {auditResults.missingCatalog.length > 0 && auditResults.missingDb.length > 0 && " · "}
            {auditResults.missingDb.length > 0 && `${auditResults.missingDb.length} s/ banco`}
            {totalDivergences === 0 && "Nenhuma"}
          </p>
        </div>
      </div>

      {/* Divergence Sections */}
      <div className="divide-y divide-border">
        {/* Missing in DB (defined in catalog but no DB record) */}
        {auditResults.missingDb.length > 0 && (
          <AuditSection
            title="Faltam no banco de dados"
            subtitle="Variáveis definidas no catálogo frontend que precisam ser criadas na aba Customizadas"
            icon={<XCircle className="h-4 w-4 text-destructive" />}
            count={auditResults.missingDb.length}
            badgeColor="bg-destructive/10 text-destructive border-destructive/20"
            items={auditResults.missingDb}
            defaultOpen
          />
        )}

        {/* Missing in Catalog (exists in DB but not in frontend catalog) */}
        {auditResults.missingCatalog.length > 0 && (
          <AuditSection
            title="Faltam no catálogo frontend"
            subtitle="Variáveis criadas no banco que precisam ser adicionadas ao variablesCatalog.ts"
            icon={<AlertTriangle className="h-4 w-4 text-warning" />}
            count={auditResults.missingCatalog.length}
            badgeColor="bg-warning/10 text-warning border-warning/20"
            items={auditResults.missingCatalog}
            defaultOpen
          />
        )}

        {/* Synced (collapsible) */}
        <div className="px-4 py-3">
          <button
            onClick={() => setShowSynced(!showSynced)}
            className="flex items-center gap-2 w-full text-left group"
          >
            {showSynced ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-xs font-semibold text-foreground">Sincronizadas</span>
            <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/20">{auditResults.synced.length}</Badge>
            <span className="text-[10px] text-muted-foreground">— presentes no catálogo e no banco</span>
          </button>
          {showSynced && auditResults.synced.length > 0 && (
            <div className="mt-2 ml-6">
              <div className="flex flex-wrap gap-1.5">
                {auditResults.synced.map((item) => (
                  <Badge key={item.key} variant="outline" className="text-[10px] font-mono bg-success/5 text-success/80 border-success/20">
                    [{item.key}]
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* All good state */}
        {totalDivergences === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto opacity-20 mb-2" />
            <p className="text-xs font-medium">Tudo sincronizado!</p>
            <p className="text-[10px]">Nenhuma divergência encontrada entre catálogo e banco.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Section component ────────────────────────────────── */
function AuditSection({
  title,
  subtitle,
  icon,
  count,
  badgeColor,
  items,
  defaultOpen = false,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  count: number;
  badgeColor: string;
  items: AuditItem[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        {icon}
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <Badge variant="outline" className={`text-[9px] ${badgeColor}`}>{count}</Badge>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">— {subtitle}</span>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[50px]">Status</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Variável</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Chave</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Fonte</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Ação sugerida</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const cfg = statusConfig[item.status];
                const Icon = cfg.icon;
                return (
                  <tr key={item.key} className={`border-b border-border/40 transition-colors ${idx % 2 === 0 ? "bg-card" : "bg-muted/10"} hover:bg-accent/5`}>
                    <td className="px-4 py-2.5">
                      <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-foreground text-[11px]">{item.label}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[10px]">[{item.key}]</code>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[9px] font-mono">{item.source}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                        {item.action}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
