/**
 * GdEnergyNetworkCard — Card unificado de GD.
 * Mostra: fluxo de energia, beneficiárias com ações, distribuição, economia
 * e ações de gerenciamento do grupo.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sun, ArrowRight, Building2, Zap, TrendingUp, AlertTriangle, DollarSign, Crown, ArrowDown, Plus, PieChart, Edit, Trash2, Users } from "lucide-react";
import { type GdBeneficiary } from "@/hooks/useGdBeneficiaries";
import { type UCOption } from "@/hooks/useFormSelects";
import { buildUcDetailPath } from "./ucNavigation";
import { formatDecimalBR, formatBRL } from "@/lib/formatters";

const CATEGORIA_GD_LABELS: Record<string, string> = {
  gd1: "GD I — Autoconsumo Local",
  gd2: "GD II — Autoconsumo Remoto",
  gd3: "GD III — Compartilhado",
};

interface Props {
  groupId: string;
  groupName: string;
  generatorUcId: string;
  generatorName: string;
  generatorCodigo: string;
  beneficiaries: GdBeneficiary[];
  allUcs: UCOption[];
  tarifaMedia?: number | null;
  categoriaGd?: string | null;
  /** Management callbacks — when provided, action buttons appear */
  onAddBeneficiary?: () => void;
  onEditDistribution?: () => void;
  onRenameGroup?: () => void;
  onNewGroup?: () => void;
  onDeleteGroup?: () => void;
  onDeleteBeneficiary?: (beneficiaryId: string) => void;
}

const STALE = 1000 * 60 * 5;
const DEFAULT_TARIFA = 0.85; // R$/kWh fallback

export function GdEnergyNetworkCard({
  groupId,
  groupName,
  generatorUcId,
  generatorName,
  generatorCodigo,
  beneficiaries,
  allUcs,
  tarifaMedia,
  categoriaGd,
  onAddBeneficiary,
  onEditDistribution,
  onRenameGroup,
  onNewGroup,
  onDeleteGroup,
  onDeleteBeneficiary,
}: Props) {
  const navigate = useNavigate();
  const tarifa = tarifaMedia ?? DEFAULT_TARIFA;

  const ucMap = useMemo(() => new Map(allUcs.map((u) => [u.id, u])), [allUcs]);

  // Fetch latest GD monthly calc for the group
  const { data: monthlyCalc, isLoading: loadingCalc } = useQuery({
    queryKey: ["gd_monthly_calc_latest", groupId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("gd_monthly_calculations")
        .select("*")
        .eq("gd_group_id", groupId)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    staleTime: STALE,
    enabled: !!groupId,
  });

  // Fetch beneficiary allocations from monthly calc
  const { data: allocations = [] } = useQuery({
    queryKey: ["gd_monthly_alloc", monthlyCalc?.id],
    queryFn: async () => {
      if (!monthlyCalc?.id) return [];
      const { data } = await (supabase as any)
        .from("gd_monthly_allocations")
        .select("*")
        .eq("calculation_id", monthlyCalc.id);
      return (data ?? []) as any[];
    },
    staleTime: STALE,
    enabled: !!monthlyCalc?.id,
  });

  // Fetch average consumption for beneficiaries from last 3 invoices
  const benUcIds = beneficiaries.map((b) => b.uc_beneficiaria_id);
  const { data: consumptionMap = new Map() } = useQuery({
    queryKey: ["gd_ben_avg_consumption", ...benUcIds],
    queryFn: async () => {
      if (benUcIds.length === 0) return new Map<string, number>();
      const { data } = await supabase
        .from("unit_invoices")
        .select("unit_id, energy_consumed_kwh")
        .in("unit_id", benUcIds)
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false })
        .limit(benUcIds.length * 3);

      const map = new Map<string, number[]>();
      for (const row of data ?? []) {
        const id = row.unit_id;
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(Number(row.energy_consumed_kwh ?? 0));
      }

      const result = new Map<string, number>();
      for (const [id, vals] of map) {
        result.set(id, vals.reduce((a, b) => a + b, 0) / vals.length);
      }
      return result;
    },
    staleTime: STALE,
    enabled: benUcIds.length > 0,
  });

  const generationKwh = monthlyCalc?.total_generation_kwh ?? null;
  const totalDistributed = monthlyCalc?.total_compensated_kwh ?? null;
  const totalAllocationPercent = beneficiaries.reduce((s, b) => s + Number(b.allocation_percent), 0);
  const undistributedPercent = Math.max(100 - totalAllocationPercent, 0);

  const hasData = generationKwh !== null;

  // Build enriched beneficiary data for sorting and highlights
  const enrichedBeneficiaries = useMemo(() => {
    return beneficiaries.map((ben) => {
      const ucInfo = ucMap.get(ben.uc_beneficiaria_id);
      const avgConsumption = consumptionMap.get(ben.uc_beneficiaria_id);
      const allocPercent = Number(ben.allocation_percent);
      const estimatedReceived = generationKwh != null ? (generationKwh * allocPercent) / 100 : null;
      const allocationData = allocations.find((a: any) => a.uc_beneficiaria_id === ben.uc_beneficiaria_id);
      const actualReceived = allocationData?.compensated_kwh ?? estimatedReceived;
      const economyR$ = actualReceived != null ? actualReceived * tarifa : null;

      return {
        ...ben,
        ucInfo,
        avgConsumption,
        allocPercent,
        actualReceived,
        economyR$,
      };
    }).sort((a, b) => b.allocPercent - a.allocPercent);
  }, [beneficiaries, ucMap, consumptionMap, generationKwh, allocations, tarifa]);

  const maxBen = enrichedBeneficiaries.length > 1 ? enrichedBeneficiaries[0] : null;
  const minBen = enrichedBeneficiaries.length > 1 ? enrichedBeneficiaries[enrichedBeneficiaries.length - 1] : null;

  const totalEconomy = enrichedBeneficiaries.reduce((s, b) => s + (b.economyR$ ?? 0), 0);
  const generatorRetainedKwh = generationKwh != null && totalDistributed != null ? generationKwh - totalDistributed : null;
  const generatorEconomy = generatorRetainedKwh != null ? generatorRetainedKwh * tarifa : null;
  const totalGroupEconomy = totalEconomy + (generatorEconomy ?? 0);

  const isFallbackTarifa = !tarifaMedia;

  return (
    <Card className="border-l-[3px] border-l-success">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-success" /> Rede de Energia — {groupName}
            </CardTitle>
            <CardDescription>
              Fluxo de energia, distribuição e economia estimada do grupo.
              {categoriaGd && CATEGORIA_GD_LABELS[categoriaGd] && (
                <Badge variant="outline" className="ml-2 text-[10px] border-primary/20 text-primary bg-primary/5">
                  {CATEGORIA_GD_LABELS[categoriaGd]}
                </Badge>
              )}
            </CardDescription>
          </div>
          {hasData && (
            <Badge variant="outline" className="text-xs border-success/30 text-success bg-success/10">
              Dados disponíveis
            </Badge>
          )}
          {!hasData && !loadingCalc && (
            <Badge variant="outline" className="text-xs border-warning/30 text-warning bg-warning/10">
              <AlertTriangle className="w-3 h-3 mr-1" /> Estimativas
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingCalc ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : (
          <>
            {/* Generator summary */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sun className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{generatorName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{generatorCodigo}</p>
                </div>
                <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Geradora</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">
                    {generationKwh != null ? formatDecimalBR(generationKwh, 0) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">kWh gerados</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">
                    {totalDistributed != null ? formatDecimalBR(totalDistributed, 0) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">kWh distribuídos</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">
                    {formatDecimalBR(undistributedPercent, 1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Saldo geradora</p>
                </div>
              </div>
            </div>

            {/* Distribution bar */}
            {beneficiaries.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Distribuição do grupo</p>
                <div className="h-3 rounded-full overflow-hidden flex bg-muted/50 border border-border">
                  {enrichedBeneficiaries.map((ben) => (
                    <div
                      key={ben.id}
                      className="h-full bg-info/70 border-r border-background last:border-r-0 transition-all"
                      style={{ width: `${ben.allocPercent}%` }}
                      title={`${ucMap.get(ben.uc_beneficiaria_id)?.nome || "UC"}: ${ben.allocPercent.toFixed(1)}%`}
                    />
                  ))}
                  {undistributedPercent > 0 && (
                    <div
                      className="h-full bg-primary/30"
                      style={{ width: `${undistributedPercent}%` }}
                      title={`Saldo geradora: ${undistributedPercent.toFixed(1)}%`}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-info/70 shrink-0" />
                    Beneficiárias ({formatDecimalBR(totalAllocationPercent, 1)}%)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-primary/30 shrink-0" />
                    Saldo geradora ({formatDecimalBR(undistributedPercent, 1)}%)
                  </div>
                </div>
              </div>
            )}

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-px w-8 bg-border" />
                <ArrowRight className="w-4 h-4" />
                <span className="text-xs font-medium">Unidades beneficiárias</span>
                <ArrowRight className="w-4 h-4" />
                <div className="h-px w-8 bg-border" />
              </div>
            </div>

            {/* Beneficiaries list — unified with actions */}
            {beneficiaries.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Nenhuma beneficiária cadastrada</p>
                <p className="text-xs text-muted-foreground mt-1">Adicione unidades para distribuir os créditos de geração.</p>
                {onAddBeneficiary && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={onAddBeneficiary}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar Beneficiária
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {enrichedBeneficiaries.map((ben) => {
                  const isMax = maxBen?.id === ben.id;
                  const isMin = minBen?.id === ben.id;
                  const ucCode = ben.ucInfo?.codigo_uc;
                  const fullName = ben.ucInfo?.nome || "UC desconhecida";

                  return (
                    <div
                      key={ben.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors hover:bg-muted/50 ${
                        isMax ? "bg-success/5 border-success/20" : isMin ? "bg-warning/5 border-warning/20" : "bg-muted/30 border-border"
                      }`}
                    >
                      <Building2 className="w-4 h-4 text-info shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm font-medium text-foreground truncate max-w-[180px] sm:max-w-[260px]">
                                {fullName}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>{fullName}</p></TooltipContent>
                          </Tooltip>
                          {isMax && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 border-success/30 text-success bg-success/10">
                              <Crown className="w-2.5 h-2.5 mr-0.5" /> Maior
                            </Badge>
                          )}
                          {isMin && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 border-warning/30 text-warning bg-warning/10">
                              <ArrowDown className="w-2.5 h-2.5 mr-0.5" /> Menor
                            </Badge>
                          )}
                        </div>
                        {ucCode && (
                          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{ucCode}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                          <span className="font-mono font-semibold text-foreground">{ben.allocPercent.toFixed(1)}%</span>
                          <span className="text-border">·</span>
                          <span>
                            {ben.actualReceived != null ? (
                              <span className="font-medium text-foreground">{formatDecimalBR(ben.actualReceived, 0)} kWh</span>
                            ) : (
                              <span className="italic">sem dados</span>
                            )}
                          </span>
                          {ben.economyR$ != null && (
                            <>
                              <span className="text-border">·</span>
                              <span className="font-medium text-success">
                                {formatBRL(ben.economyR$)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => navigate(buildUcDetailPath(ben.uc_beneficiaria_id, { tab: "overview" }))}
                            >
                              <Building2 className="w-3.5 h-3.5 text-primary" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Abrir UC</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => navigate(buildUcDetailPath(ben.uc_beneficiaria_id, { tab: "gd" }))}
                            >
                              <Users className="w-3.5 h-3.5 text-info" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver energia GD</TooltipContent>
                        </Tooltip>
                        {onDeleteBeneficiary && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); onDeleteBeneficiary(ben.id); }}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remover</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Economy summary */}
            {totalGroupEconomy > 0 && (
              <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-success shrink-0" />
                  <p className="text-sm font-semibold text-foreground">
                    Economia estimada do grupo: <span className="text-success">{formatBRL(totalGroupEconomy)}</span>/mês
                  </p>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Beneficiárias: {formatBRL(totalEconomy)}
                  {generatorEconomy != null && generatorEconomy > 0 && ` · Geradora: ${formatBRL(generatorEconomy)}`}
                  {isFallbackTarifa && (
                    <span className="ml-1 italic">(tarifa estimada: {formatBRL(DEFAULT_TARIFA)}/kWh)</span>
                  )}
                </p>
              </div>
            )}

            {/* Efficiency indicator */}
            {hasData && totalDistributed != null && generationKwh > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/5 border border-success/20">
                <TrendingUp className="w-4 h-4 text-success shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Eficiência do grupo:{" "}
                  <span className="font-semibold text-foreground">
                    {formatDecimalBR((totalDistributed / generationKwh) * 100, 1)}%
                  </span>
                  {" da energia gerada está sendo aproveitada pelas beneficiárias."}
                </p>
              </div>
            )}

            {/* ─── Group management footer ─── */}
            {(onAddBeneficiary || onEditDistribution || onRenameGroup || onNewGroup || onDeleteGroup) && (
              <>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {onAddBeneficiary && (
                    <Button variant="outline" size="sm" onClick={onAddBeneficiary}>
                      <Plus className="w-4 h-4 mr-1" /> Adicionar Beneficiária
                    </Button>
                  )}
                  {beneficiaries.length > 0 && onEditDistribution && (
                    <Button variant="outline" size="sm" onClick={onEditDistribution}>
                      <PieChart className="w-4 h-4 mr-1" /> Ajustar distribuição
                    </Button>
                  )}
                  {onRenameGroup && (
                    <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={onRenameGroup}>
                      <Edit className="w-3 h-3" /> Renomear
                    </Button>
                  )}
                  {onNewGroup && (
                    <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={onNewGroup}>
                      <Plus className="w-3 h-3" /> Novo Grupo
                    </Button>
                  )}
                  {onDeleteGroup && (
                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDeleteGroup}>
                      <Trash2 className="w-3 h-3" /> Excluir Grupo
                    </Button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
