/**
 * GDConsolidadoTab — Consolidated report of all GD groups.
 * §16: Queries in hooks. §23: staleTime. §26-S1: Header. §27-S1: KPIs.
 */
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatCard } from "@/components/ui-kit/StatCard";
import { GitBranch, Download, ChevronDown, ChevronRight, Sun, Users, Zap, TrendingUp, BarChart3 } from "lucide-react";
import { formatBRL, formatDecimalBR, formatIntegerBR } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const STALE_TIME = 1000 * 60 * 5;

interface GdGroupRow {
  id: string;
  nome: string;
  uc_geradora_id: string;
  status: string;
}

interface SnapshotRow {
  id: string;
  gd_group_id: string;
  reference_year: number;
  reference_month: number;
  generation_kwh: number | null;
  total_compensated_kwh: number | null;
  total_surplus_kwh: number | null;
}

interface AllocationRow {
  id: string;
  snapshot_id: string;
  gd_group_id: string;
  uc_beneficiaria_id: string;
  allocation_percent: number | null;
  allocated_kwh: number | null;
  compensated_kwh: number | null;
  estimated_savings_brl: number | null;
}

interface BeneficiaryInfo {
  id: string;
  uc_beneficiaria_id: string;
  allocation_percent: number;
  allocated_kwh: number;
  compensated_kwh: number;
  estimated_savings_brl: number;
  uc_nome?: string;
  uc_codigo?: string;
}

interface GroupConsolidated {
  group: GdGroupRow;
  snapshot: SnapshotRow | null;
  beneficiaries: BeneficiaryInfo[];
  generatorName?: string;
  generatorCode?: string;
  totalSavings: number;
}

function getMonthOptions() {
  const now = new Date();
  const options: { label: string; year: number; month: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  return options;
}

export function GDConsolidadoTab() {
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedPeriod, setSelectedPeriod] = useState("0");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { year, month } = monthOptions[Number(selectedPeriod)] || monthOptions[0];

  // Fetch active GD groups
  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["gd_groups_consolidado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gd_groups")
        .select("id, nome, uc_geradora_id, status")
        .eq("status", "active")
        .order("nome");
      if (error) throw error;
      return (data || []) as GdGroupRow[];
    },
    staleTime: STALE_TIME,
  });

  // Fetch snapshots for selected month
  const { data: snapshots = [], isLoading: loadingSnaps } = useQuery({
    queryKey: ["gd_snapshots_consolidado", year, month],
    queryFn: async () => {
      if (!groups.length) return [];
      const groupIds = groups.map(g => g.id);
      const { data, error } = await (supabase as any)
        .from("gd_monthly_snapshots")
        .select("id, gd_group_id, reference_year, reference_month, generation_kwh, total_compensated_kwh, total_surplus_kwh")
        .in("gd_group_id", groupIds)
        .eq("reference_year", year)
        .eq("reference_month", month);
      if (error) throw error;
      return (data || []) as SnapshotRow[];
    },
    staleTime: STALE_TIME,
    enabled: groups.length > 0,
  });

   // Fetch allocations for those snapshots
  const snapshotIds = useMemo(() => snapshots.map(s => s.id), [snapshots]);
  const { data: allocations = [], isLoading: loadingAllocs } = useQuery({
    queryKey: ["gd_allocations_consolidado", snapshotIds],
    queryFn: async () => {
      if (!snapshotIds.length) return [];
      const { data, error } = await (supabase as any)
        .from("gd_monthly_allocations")
        .select("id, snapshot_id, gd_group_id, uc_beneficiaria_id, allocation_percent, allocated_kwh, compensated_kwh, estimated_savings_brl")
        .in("snapshot_id", snapshotIds);
      if (error) throw error;
      return (data || []) as AllocationRow[];
    },
    staleTime: STALE_TIME,
    enabled: snapshotIds.length > 0,
  });

  // Fetch real beneficiaries from gd_group_beneficiaries (source of truth for count)
  const groupIds = useMemo(() => groups.map(g => g.id), [groups]);
  const { data: realBeneficiaries = [] } = useQuery({
    queryKey: ["gd_real_beneficiaries_consolidado", groupIds],
    queryFn: async () => {
      if (!groupIds.length) return [];
      const { data, error } = await (supabase as any)
        .from("gd_group_beneficiaries")
        .select("id, gd_group_id, uc_beneficiaria_id, allocation_percent, is_active")
        .in("gd_group_id", groupIds)
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as { id: string; gd_group_id: string; uc_beneficiaria_id: string; allocation_percent: number; is_active: boolean }[];
    },
    staleTime: STALE_TIME,
    enabled: groupIds.length > 0,
  });

  // Fetch UC names for generators + beneficiaries
  const allUcIds = useMemo(() => {
    const ids = new Set<string>();
    groups.forEach(g => ids.add(g.uc_geradora_id));
    allocations.forEach(a => ids.add(a.uc_beneficiaria_id));
    realBeneficiaries.forEach(b => ids.add(b.uc_beneficiaria_id));
    return [...ids];
  }, [groups, allocations, realBeneficiaries]);

  const { data: ucNames = [] } = useQuery({
    queryKey: ["uc_names_for_gd", allUcIds],
    queryFn: async () => {
      if (!allUcIds.length) return [];
      const { data, error } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc")
        .in("id", allUcIds);
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
    enabled: allUcIds.length > 0,
  });

  const ucMap = useMemo(() => {
    const m = new Map<string, { nome: string; codigo_uc: string }>();
    ucNames.forEach((u: any) => m.set(u.id, { nome: u.nome, codigo_uc: u.codigo_uc }));
    return m;
  }, [ucNames]);

  // Build consolidated data
  const consolidated: GroupConsolidated[] = useMemo(() => {
    return groups.map(group => {
      const snap = snapshots.find(s => s.gd_group_id === group.id) || null;
      const groupAllocs = allocations.filter(a => a.gd_group_id === group.id);
      const gen = ucMap.get(group.uc_geradora_id);

      // Use snapshot allocations if available, otherwise fallback to real beneficiaries
      let beneficiaries: BeneficiaryInfo[];
      if (groupAllocs.length > 0) {
        beneficiaries = groupAllocs.map(a => {
          const uc = ucMap.get(a.uc_beneficiaria_id);
          return {
            id: a.id,
            uc_beneficiaria_id: a.uc_beneficiaria_id,
            allocation_percent: Number(a.allocation_percent) || 0,
            allocated_kwh: Number(a.allocated_kwh) || 0,
            compensated_kwh: Number(a.compensated_kwh) || 0,
            estimated_savings_brl: Number(a.estimated_savings_brl) || 0,
            uc_nome: uc?.nome,
            uc_codigo: uc?.codigo_uc,
          };
        });
      } else {
        // Fallback: show real beneficiaries even without monthly snapshot
        const groupReal = realBeneficiaries.filter(b => b.gd_group_id === group.id);
        beneficiaries = groupReal.map(b => {
          const uc = ucMap.get(b.uc_beneficiaria_id);
          return {
            id: b.id,
            uc_beneficiaria_id: b.uc_beneficiaria_id,
            allocation_percent: Number(b.allocation_percent) || 0,
            allocated_kwh: 0,
            compensated_kwh: 0,
            estimated_savings_brl: 0,
            uc_nome: uc?.nome,
            uc_codigo: uc?.codigo_uc,
          };
        });
      }

      const totalSavings = beneficiaries.reduce((s, b) => s + b.estimated_savings_brl, 0);

      return {
        group,
        snapshot: snap,
        beneficiaries,
        generatorName: gen?.nome,
        generatorCode: gen?.codigo_uc,
        totalSavings,
      };
    });
  }, [groups, snapshots, allocations, realBeneficiaries, ucMap]);

  // KPIs
  const kpis = useMemo(() => {
    const totalGroups = consolidated.length;
    const totalGeneration = consolidated.reduce((s, c) => s + (Number(c.snapshot?.generation_kwh) || 0), 0);
    const totalCompensated = consolidated.reduce((s, c) => s + (Number(c.snapshot?.total_compensated_kwh) || 0), 0);
    const totalSavings = consolidated.reduce((s, c) => s + c.totalSavings, 0);
    return { totalGroups, totalGeneration, totalCompensated, totalSavings };
  }, [consolidated]);

  const isLoading = loadingGroups || loadingSnaps || loadingAllocs;

  function toggleGroup(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const exportCSV = useCallback(() => {
    const rows: string[] = [];
    rows.push("Grupo GD,UC Geradora,Código Geradora,Beneficiárias,Geração kWh,Compensado kWh,Saldo kWh,Economia R$,UC Beneficiária,Código UC,% Alocação,Alocado kWh,Compensado kWh,Economia R$");

    for (const c of consolidated) {
      if (c.beneficiaries.length === 0) {
        rows.push([
          c.group.nome,
          c.generatorName || "",
          c.generatorCode || "",
          "0",
          String(Number(c.snapshot?.generation_kwh) || 0),
          String(Number(c.snapshot?.total_compensated_kwh) || 0),
          String(Number(c.snapshot?.total_surplus_kwh) || 0),
          String(c.totalSavings.toFixed(2)),
          "", "", "", "", "", "",
        ].join(","));
      }
      for (const b of c.beneficiaries) {
        rows.push([
          c.group.nome,
          c.generatorName || "",
          c.generatorCode || "",
          String(c.beneficiaries.length),
          String(Number(c.snapshot?.generation_kwh) || 0),
          String(Number(c.snapshot?.total_compensated_kwh) || 0),
          String(Number(c.snapshot?.total_surplus_kwh) || 0),
          String(c.totalSavings.toFixed(2)),
          b.uc_nome || "",
          b.uc_codigo || "",
          String(b.allocation_percent),
          String(b.allocated_kwh),
          String(b.compensated_kwh),
          String(b.estimated_savings_brl.toFixed(2)),
        ].join(","));
      }
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gd-consolidado-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [consolidated, year, month]);

  return (
    <div className="space-y-4">
      {/* §26-S1 Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Geração Distribuída</h2>
            <p className="text-sm text-muted-foreground">Visão consolidada de todos os grupos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px] h-9 text-sm">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt, i) => (
                <SelectItem key={i} value={String(i)}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={isLoading || !consolidated.length}>
            <Download className="w-4 h-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* §27-S1 KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={GitBranch} label="Grupos GD Ativos" value={kpis.totalGroups} color="primary" />
          <StatCard icon={Zap} label="Geração Mês (kWh)" value={formatIntegerBR(kpis.totalGeneration)} color="success" />
          <StatCard icon={TrendingUp} label="Compensado Mês (kWh)" value={formatIntegerBR(kpis.totalCompensated)} color="info" />
          <StatCard icon={BarChart3} label="Economia Mês" value={formatBRL(kpis.totalSavings)} color="success" />
        </div>
      )}

      {/* Group cards */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : consolidated.length === 0 ? (
        <EmptyState icon={GitBranch} title="Nenhum grupo GD ativo" description="Crie um grupo de Geração Distribuída para visualizar dados consolidados." />
      ) : (
        <div className="space-y-3">
          {consolidated.map((c, i) => {
            const generation = Number(c.snapshot?.generation_kwh) || 0;
            const compensated = Number(c.snapshot?.total_compensated_kwh) || 0;
            const surplus = Number(c.snapshot?.total_surplus_kwh) || 0;
            const progressPct = generation > 0 ? Math.min(100, (compensated / generation) * 100) : 0;
            const isExpanded = expandedGroups.has(c.group.id);

            return (
              <motion.div
                key={c.group.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <Card className="border border-border">
                  {/* Group Header */}
                  <CardHeader
                    className="cursor-pointer select-none pb-3"
                    onClick={() => toggleGroup(c.group.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </Button>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-semibold text-foreground truncate">{c.group.nome}</CardTitle>
                          <p className="text-xs text-muted-foreground truncate">
                            <Sun className="w-3 h-3 inline mr-1" />
                            {c.generatorName || "Geradora não vinculada"}
                            {c.generatorCode && <span className="ml-1 font-mono">({c.generatorCode})</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <Badge variant="outline" className="text-xs">
                          <Users className="w-3 h-3 mr-1" /> {c.beneficiaries.length} beneficiárias
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3">
                    {/* Metrics row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Geração</p>
                        <p className="font-semibold text-foreground">{formatIntegerBR(generation)} kWh</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Compensado</p>
                        <p className="font-semibold text-foreground">{formatIntegerBR(compensated)} kWh</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Saldo Restante</p>
                        <p className="font-semibold text-foreground">{formatIntegerBR(surplus)} kWh</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Economia</p>
                        <p className="font-semibold text-success">{formatBRL(c.totalSavings)}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Compensado / Gerado</span>
                        <span className="font-mono">{formatDecimalBR(progressPct, 1)}%</span>
                      </div>
                      <Progress value={progressPct} className="h-2" />
                    </div>

                    {/* Expanded beneficiaries */}
                    <AnimatePresence>
                      {isExpanded && c.beneficiaries.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-lg border border-border overflow-hidden mt-2 overflow-x-auto">                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                  <TableHead className="font-semibold text-foreground text-xs">UC Beneficiária</TableHead>
                                  <TableHead className="font-semibold text-foreground text-xs text-right">% Alocação</TableHead>
                                  <TableHead className="font-semibold text-foreground text-xs text-right">Alocado kWh</TableHead>
                                  <TableHead className="font-semibold text-foreground text-xs text-right">Compensado kWh</TableHead>
                                  <TableHead className="font-semibold text-foreground text-xs text-right">Economia R$</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {c.beneficiaries.map(b => (
                                  <TableRow key={b.id} className="hover:bg-muted/30">
                                    <TableCell className="text-xs text-foreground">
                                      <div>
                                        <p className="font-medium">{b.uc_nome || "—"}</p>
                                        {b.uc_codigo && <p className="font-mono text-muted-foreground">{b.uc_codigo}</p>}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-right font-mono">{formatDecimalBR(b.allocation_percent, 2)}%</TableCell>
                                    <TableCell className="text-xs text-right font-mono">{formatIntegerBR(b.allocated_kwh)}</TableCell>
                                    <TableCell className="text-xs text-right font-mono">{formatIntegerBR(b.compensated_kwh)}</TableCell>
                                    <TableCell className="text-xs text-right font-mono text-success">{formatBRL(b.estimated_savings_brl)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </motion.div>
                      )}
                      {isExpanded && c.beneficiaries.length === 0 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-xs text-muted-foreground text-center py-3"
                        >
                          Nenhuma beneficiária com alocação neste período
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
