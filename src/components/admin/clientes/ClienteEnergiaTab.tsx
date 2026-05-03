/**
 * ClienteEnergiaTab — Energy tab for client detail dialog.
 * Shows UCs, GD groups, and invoice summary.
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sun, Zap, Users, FileText, Building2, DollarSign, ArrowDownUp, TrendingUp, BarChart3 } from "lucide-react";
import { useClienteUCs, useClienteGdGroups, useClienteInvoiceSummary } from "@/hooks/useClienteEnergia";
import { useConcessionarias } from "@/hooks/useConcessionarias";
import { useClienteEnergiaResumo } from "@/hooks/useGdEnergyEngine";
import { useClienteCreditBalance } from "@/hooks/useGdEnergyReport";
import { useClienteReconciliationSummary } from "@/hooks/useGdReconciliation";
import { ReconciliationStatusBadge } from "@/components/admin/gd/GdReconciliationCard";
import { formatBRL } from "@/lib/formatters";

interface Props {
  clienteId: string;
}

const papelGdLabels: Record<string, string> = {
  none: "—",
  geradora: "Geradora",
  beneficiaria: "Beneficiária",
};

const tipoUcLabels: Record<string, string> = {
  consumo: "Consumo",
  geradora: "Geradora",
  mista: "Mista",
  gd_geradora: "GD Geradora",
};

export function ClienteEnergiaTab({ clienteId }: Props) {
  const { data: ucs = [], isLoading: loadingUCs } = useClienteUCs(clienteId);
  const { data: gdGroups = [], isLoading: loadingGD } = useClienteGdGroups(clienteId);
  const { data: concessionarias = [] } = useConcessionarias();
  const ucIds = ucs.map((u: any) => u.id);
  const { data: invoices = [] } = useClienteInvoiceSummary(ucIds);

  // GD Energy monthly summary
  const now = new Date();
  const brasilNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  let refMonth = brasilNow.getMonth();
  let refYear = brasilNow.getFullYear();
  if (refMonth === 0) { refMonth = 12; refYear--; }
  const { data: energiaResumo } = useClienteEnergiaResumo(clienteId, refYear, refMonth);
  const { data: creditData } = useClienteCreditBalance(clienteId);
  const { data: reconciliations = [] } = useClienteReconciliationSummary(clienteId, refYear, refMonth);
  const recMap = new Map<string, { status: "ok" | "warning" | "critical" }>(reconciliations.map((r: any) => [r.gd_group_id, { status: r.status }]));

  const concMap = new Map(concessionarias.map((c) => [c.id, c]));

  // Count invoices per UC
  const invoiceCountMap = new Map<string, number>();
  invoices.forEach((inv: any) => {
    invoiceCountMap.set(inv.unit_id, (invoiceCountMap.get(inv.unit_id) || 0) + 1);
  });

  const isLoading = loadingUCs || loadingGD;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const hasNoData = ucs.length === 0 && gdGroups.length === 0;

  if (hasNoData) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3">
          <Zap className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Nenhum dado de energia</p>
        <p className="text-xs text-muted-foreground mt-1">Este cliente não possui UCs ou grupos GD vinculados</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{ucs.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">UCs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{gdGroups.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Grupos GD</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{invoices.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Faturas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GD Energy Monthly Summary */}
      {energiaResumo && energiaResumo.totalCompensated > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
                <ArrowDownUp className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">
                  {energiaResumo.totalCompensated.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">kWh Compensados</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">
                  {formatBRL(energiaResumo.totalSavings)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Economia Est.</p>
              </div>
            </CardContent>
          </Card>
          {creditData && creditData.total_balance_kwh > 0 && (
            <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">
                    {creditData.total_balance_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">kWh Saldo Crédito</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {ucs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Zap className="w-3 h-3" /> Unidades Consumidoras ({ucs.length})
          </p>
          <div className="space-y-2">
            {ucs.map((uc: any) => {
              const conc = concMap.get(uc.concessionaria_id);
              const invCount = invoiceCountMap.get(uc.id) || 0;
              return (
                <div
                  key={uc.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {uc.codigo_uc} — {uc.nome}
                      </p>
                      {uc.papel_gd && uc.papel_gd !== "none" && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          {papelGdLabels[uc.papel_gd] || uc.papel_gd}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {conc && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {conc.nome}
                        </span>
                      )}
                      <span>{tipoUcLabels[uc.tipo_uc] || uc.tipo_uc}</span>
                      {invCount > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {invCount} fatura{invCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GD Groups List */}
      {gdGroups.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Sun className="w-3 h-3" /> Grupos GD ({gdGroups.length})
          </p>
          <div className="space-y-2">
            {gdGroups.map((g: any) => {
              const conc = concMap.get(g.concessionaria_id);
              const ucGeradora = ucs.find((u: any) => u.id === g.uc_geradora_id);
              return (
                <div
                  key={g.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{g.nome}</p>
                      <Badge variant={g.status === "active" ? "default" : "secondary"} className="text-[10px]">
                        {g.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                      {(() => {
                        const rec = recMap.get(g.id);
                        return rec ? <ReconciliationStatusBadge status={rec.status} /> : null;
                      })()}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {ucGeradora && (
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" /> {ucGeradora.codigo_uc}
                        </span>
                      )}
                      {conc && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {conc.nome}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
