import { useMemo } from "react";
import { ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
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
}

const statusConfig: Record<AuditStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  ok: { icon: CheckCircle2, color: "text-success", label: "Sincronizada" },
  missing_catalog: { icon: AlertTriangle, color: "text-warning", label: "Falta no catálogo" },
  missing_db: { icon: XCircle, color: "text-destructive", label: "Falta no banco" },
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
  const auditResults = useMemo(() => {
    const results: AuditItem[] = [];

    // Catalog customizada vars (static)
    const catalogCustom = VARIABLES_CATALOG.filter((v) => v.category === "customizada");
    const catalogKeys = new Set(catalogCustom.map((v) => v.legacyKey.replace(/^\[|\]$/g, "")));

    // DB custom vars
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
          detail: "Presente no catálogo frontend mas não existe no banco de dados",
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
          detail: "Presente no banco mas não listada no catálogo frontend",
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
        });
      }
    }

    const allNonCustom = VARIABLES_CATALOG.filter((v) => v.category !== "customizada");

    return {
      items: results.sort((a, b) => {
        const order: Record<AuditStatus, number> = { missing_catalog: 0, missing_db: 1, ok: 2 };
        return order[a.status] - order[b.status] || a.label.localeCompare(b.label, "pt-BR");
      }),
      totalCatalog: VARIABLES_CATALOG.length,
      totalDb: dbCustomVars.length,
      totalNonCustom: allNonCustom.length,
      missingCatalog: results.filter((r) => r.status === "missing_catalog").length,
      missingDb: results.filter((r) => r.status === "missing_db").length,
      synced: results.filter((r) => r.status === "ok").length,
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
          <p className="text-xl font-bold text-success tabular-nums">{auditResults.synced}</p>
          <p className="text-[10px] text-muted-foreground">Catálogo ↔ Banco</p>
        </div>
        <div className={`rounded-lg border p-3 space-y-1 ${auditResults.missingCatalog + auditResults.missingDb > 0 ? "border-warning/30 bg-warning/5" : "border-border bg-card"}`}>
          <p className="text-[10px] text-warning uppercase tracking-wider font-medium">Divergências</p>
          <p className="text-xl font-bold text-warning tabular-nums">{auditResults.missingCatalog + auditResults.missingDb}</p>
          <p className="text-[10px] text-muted-foreground">
            {auditResults.missingCatalog > 0 && `${auditResults.missingCatalog} s/ catálogo`}
            {auditResults.missingCatalog > 0 && auditResults.missingDb > 0 && " · "}
            {auditResults.missingDb > 0 && `${auditResults.missingDb} s/ banco`}
            {auditResults.missingCatalog + auditResults.missingDb === 0 && "Nenhuma"}
          </p>
        </div>
      </div>

      {/* Results table */}
      {auditResults.items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[60px]">Status</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Variável</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Chave</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Fonte</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {auditResults.items.map((item, idx) => {
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
                      <span className="text-[10px] text-muted-foreground">{item.detail}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto opacity-20 mb-2" />
          <p className="text-xs font-medium">Tudo sincronizado!</p>
          <p className="text-[10px]">Nenhuma divergência encontrada entre catálogo e banco.</p>
        </div>
      )}
    </div>
  );
}
