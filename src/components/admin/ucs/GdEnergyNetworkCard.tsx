/**
 * GdEnergyNetworkCard — "Rede de Energia deste Grupo" card.
 * Shows the full energy flow: generator → beneficiaries with real data.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sun, ArrowRight, Building2, Zap, TrendingUp, AlertTriangle } from "lucide-react";
import { type GdBeneficiary } from "@/hooks/useGdBeneficiaries";
import { type UCOption } from "@/hooks/useFormSelects";
import { buildUcDetailPath } from "./ucNavigation";
import { formatDecimalBR, formatBRL } from "@/lib/formatters";

interface Props {
  groupId: string;
  groupName: string;
  generatorUcId: string;
  generatorName: string;
  generatorCodigo: string;
  beneficiaries: GdBeneficiary[];
  allUcs: UCOption[];
}

const STALE = 1000 * 60 * 5;

export function GdEnergyNetworkCard({
  groupId,
  groupName,
  generatorUcId,
  generatorName,
  generatorCodigo,
  beneficiaries,
  allUcs,
}: Props) {
  const navigate = useNavigate();

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

  return (
    <Card className="border-l-[3px] border-l-success">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-success" /> Rede de Energia — {groupName}
            </CardTitle>
            <CardDescription>
              Visão completa do fluxo de energia: geração, distribuição e consumo das unidades.
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

              <div className="grid grid-cols-3 gap-3">
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

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-px w-8 bg-border" />
                <ArrowRight className="w-4 h-4" />
                <span className="text-xs font-medium">Distribuição</span>
                <ArrowRight className="w-4 h-4" />
                <div className="h-px w-8 bg-border" />
              </div>
            </div>

            {/* Beneficiaries list */}
            {beneficiaries.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Nenhuma beneficiária cadastrada</p>
                <p className="text-xs text-muted-foreground mt-1">Adicione unidades para distribuir os créditos de geração.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {beneficiaries.map((ben) => {
                  const ucInfo = ucMap.get(ben.uc_beneficiaria_id);
                  const avgConsumption = consumptionMap.get(ben.uc_beneficiaria_id);
                  const allocPercent = Number(ben.allocation_percent);
                  const estimatedReceived = generationKwh != null ? (generationKwh * allocPercent) / 100 : null;
                  const allocationData = allocations.find((a: any) => a.uc_beneficiaria_id === ben.uc_beneficiaria_id);
                  const actualReceived = allocationData?.compensated_kwh ?? estimatedReceived;

                  return (
                    <div
                      key={ben.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
                    >
                      <Building2 className="w-4 h-4 text-info shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {ucInfo?.nome || "UC desconhecida"}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="font-mono">{allocPercent.toFixed(1)}%</span>
                          <span>·</span>
                          <span>
                            Consumo médio: {avgConsumption != null ? `${formatDecimalBR(avgConsumption, 0)} kWh` : "sem dados"}
                          </span>
                          <span>·</span>
                          <span>
                            Recebe: {actualReceived != null ? (
                              <span className="font-medium text-foreground">{formatDecimalBR(actualReceived, 0)} kWh</span>
                            ) : (
                              <span className="italic">estimado</span>
                            )}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 shrink-0"
                        onClick={() => navigate(buildUcDetailPath(ben.uc_beneficiaria_id, { tab: "overview" }))}
                      >
                        Abrir <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
