/**
 * GdGroupDetailModal — Detail view of a GD Group with beneficiaries.
 * §25-S1: w-[90vw] mandatory.
 */
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sun, Building2, Users, Plus, Trash2, AlertTriangle, CheckCircle2, Zap, User, FileText } from "lucide-react";
import { useGdGroupById } from "@/hooks/useGdGroups";
import { useGdBeneficiaries, useDeleteGdBeneficiary, useSaveGdBeneficiary, type GdBeneficiary } from "@/hooks/useGdBeneficiaries";
import { useConcessionarias } from "@/hooks/useConcessionarias";
import { useClientesList, useUCsList } from "@/hooks/useFormSelects";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { gdService } from "@/services/gdService";
import { GdBeneficiaryFormModal } from "./GdBeneficiaryFormModal";
import { formatDate } from "@/lib/dateUtils";
import { GdEnergyMonthly } from "./GdEnergyMonthly";
import { GdEnergyReport } from "./GdEnergyReport";
import { GdDecisionDashboard } from "./GdDecisionDashboard";
import { useGdDashboardData } from "@/hooks/useGdDashboardData";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
}

export function GdGroupDetailModal({ open, onOpenChange, groupId }: Props) {
  const { toast } = useToast();
  const { data: group, isLoading: loadingGroup } = useGdGroupById(groupId);
  const { data: beneficiaries = [], isLoading: loadingBen } = useGdBeneficiaries(groupId);
  const { data: concessionarias = [] } = useConcessionarias();
  const { data: ucs = [] } = useUCsList();
  const { data: clientes = [] } = useClientesList();
  const deleteBen = useDeleteGdBeneficiary();
  const saveBen = useSaveGdBeneficiary();
  const [addBenOpen, setAddBenOpen] = useState(false);

  // Fetch invoice counts per beneficiary UC
  const benUcIds = beneficiaries.map((b) => b.uc_beneficiaria_id);
  const { data: invoiceCounts = [] } = useQuery({
    queryKey: ["gd_ben_invoice_counts", benUcIds],
    queryFn: async () => {
      if (benUcIds.length === 0) return [];
      const { data } = await supabase
        .from("unit_invoices")
        .select("unit_id")
        .in("unit_id", benUcIds);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: benUcIds.length > 0,
  });

  const invoiceCountMap = new Map<string, number>();
  invoiceCounts.forEach((inv: any) => {
    invoiceCountMap.set(inv.unit_id, (invoiceCountMap.get(inv.unit_id) || 0) + 1);
  });

  const ucMap = new Map(ucs.map((u) => [u.id, u]));
  const concMap = new Map(concessionarias.map((c) => [c.id, c]));
  const clienteMap = new Map(clientes.map((c) => [c.id, c]));

  const activeBens = beneficiaries.filter((b) => b.is_active);
  const { valid: allocationValid, totalPercent } = gdService.validateAllocationSum(
    beneficiaries.map((b) => ({ allocation_percent: b.allocation_percent, is_active: b.is_active }))
  );

  async function handleDeleteBen(id: string) {
    try {
      await deleteBen.mutateAsync(id);
      toast({ title: "Beneficiária removida" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err?.message, variant: "destructive" });
    }
  }

  async function handleToggleActive(b: GdBeneficiary) {
    try {
      await saveBen.mutateAsync({ id: b.id, gd_group_id: b.gd_group_id, uc_beneficiaria_id: b.uc_beneficiaria_id, allocation_percent: b.allocation_percent, is_active: !b.is_active });
      toast({ title: b.is_active ? "Beneficiária desativada" : "Beneficiária ativada" });
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err?.message, variant: "destructive" });
    }
  }

  const ucGeradora = group ? ucMap.get(group.uc_geradora_id) : null;
  const conc = group ? concMap.get(group.concessionaria_id) : null;
  const cliente = group?.cliente_id ? clienteMap.get(group.cliente_id) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sun className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold text-foreground">
                {loadingGroup ? <Skeleton className="h-5 w-40" /> : group?.nome || "Grupo GD"}
              </DialogTitle>
              {group && (
                <Badge variant={group.status === "active" ? "default" : "secondary"} className="text-xs">
                  {group.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Detalhes do grupo de geração distribuída</p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            {loadingGroup ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <>
                {/* Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">UC Geradora</p>
                        <p className="text-sm font-medium text-foreground truncate">
                          {ucGeradora ? `${ucGeradora.codigo_uc} — ${ucGeradora.nome}` : "—"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Concessionária</p>
                        <p className="text-sm font-medium text-foreground truncate">{conc?.nome || "—"}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Cliente</p>
                        <p className="text-sm font-medium text-foreground truncate">{cliente?.nome || "Não vinculado"}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Allocation Summary Bar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">Beneficiárias</span>
                      <Badge variant="outline" className="text-xs">{activeBens.length} ativas</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {beneficiaries.length === 0 ? (
                        <Badge variant="outline" className="text-xs border-warning text-warning">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Sem beneficiárias
                        </Badge>
                      ) : allocationValid ? (
                        <Badge className="text-xs bg-success/10 text-success border-success/20">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> {totalPercent}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-warning text-warning">
                          <AlertTriangle className="w-3 h-3 mr-1" /> {totalPercent}% (deve ser 100%)
                        </Badge>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setAddBenOpen(true)}>
                        <Plus className="w-4 h-4 mr-1" /> Adicionar
                      </Button>
                    </div>
                  </div>

                  {/* Visual progress bar for allocation */}
                  {activeBens.length > 0 && (
                    <div className="space-y-1.5">
                      <Progress value={Math.min(totalPercent, 100)} className="h-2" />
                      <div className="flex flex-wrap gap-2">
                        {activeBens.map((b) => {
                          const uc = ucMap.get(b.uc_beneficiaria_id);
                          return (
                            <div key={b.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="truncate max-w-[120px]">{uc?.codigo_uc || "UC"}</span>
                              <span className="font-mono font-medium text-foreground">{Number(b.allocation_percent).toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Beneficiaries Table */}
                {loadingBen ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : beneficiaries.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
                      <Users className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Nenhuma beneficiária vinculada</p>
                    <p className="text-xs text-muted-foreground">Adicione UCs existentes ou crie novas como beneficiárias</p>
                    <Button size="sm" variant="outline" onClick={() => setAddBenOpen(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Adicionar beneficiária
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="font-semibold text-foreground">UC Beneficiária</TableHead>
                          <TableHead className="font-semibold text-foreground text-right">Percentual</TableHead>
                          <TableHead className="font-semibold text-foreground">Vigência</TableHead>
                          <TableHead className="font-semibold text-foreground text-center">Faturas</TableHead>
                          <TableHead className="font-semibold text-foreground text-center">Ativo</TableHead>
                          <TableHead className="w-[50px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {beneficiaries.map((b) => {
                          const uc = ucMap.get(b.uc_beneficiaria_id);
                          const invCount = invoiceCountMap.get(b.uc_beneficiaria_id) || 0;
                          return (
                            <TableRow key={b.id} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="font-medium text-foreground">
                                {uc ? `${uc.codigo_uc} — ${uc.nome}` : b.uc_beneficiaria_id}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {Number(b.allocation_percent).toFixed(2)}%
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {b.start_date ? formatDate(b.start_date) : "—"}
                                {b.end_date ? ` até ${formatDate(b.end_date)}` : ""}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-xs">
                                  <FileText className="w-3 h-3 mr-1" />
                                  {invCount}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={b.is_active}
                                  onCheckedChange={() => handleToggleActive(b)}
                                  disabled={saveBen.isPending}
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleDeleteBen(b.id)}
                                  disabled={deleteBen.isPending}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {group?.notes && (
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm text-foreground">{group.notes}</p>
                  </div>
                )}

                {/* GD Decision Dashboard — wired with real data */}
                {group && activeBens.length > 0 && (
                  <GdDashboardWithData
                    groupId={group.id}
                    ucGeradoraId={group.uc_geradora_id}
                    ucGeradoraLabel={ucGeradora ? `${ucGeradora.codigo_uc} — ${ucGeradora.nome}` : "Geradora"}
                    activeBens={activeBens}
                    ucMap={ucMap}
                  />
                )}

                {/* Energy Monthly Section */}
                {group && (
                  <GdEnergyMonthly groupId={group.id} />
                )}

                {/* Energy Report / History */}
                {group && (
                  <GdEnergyReport groupId={group.id} />
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>

      <GdBeneficiaryFormModal
        open={addBenOpen}
        onOpenChange={setAddBenOpen}
        groupId={groupId}
        ucGeradoraId={group?.uc_geradora_id}
        existingBeneficiaries={beneficiaries}
      />
    </Dialog>
  );
}

// ─── Sub-component: Dashboard with real data ────────────────────

function GdDashboardWithData({
  groupId,
  ucGeradoraId,
  ucGeradoraLabel,
  activeBens,
  ucMap,
}: {
  groupId: string;
  ucGeradoraId: string;
  ucGeradoraLabel: string;
  activeBens: GdBeneficiary[];
  ucMap: Map<string, any>;
}) {
  const now = new Date();
  // Use Brasília time for current month
  const brNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const year = brNow.getFullYear();
  const month = brNow.getMonth() + 1;

  const benUcIds = useMemo(() => activeBens.map((b) => b.uc_beneficiaria_id), [activeBens]);

  const { data: dashData, isLoading } = useGdDashboardData({
    groupId,
    ucGeradoraId,
    beneficiaryUcIds: benUcIds,
    year,
    month,
  });

  const generationKwh = dashData?.generation.value ?? 0;
  const generatorConsumption = dashData?.generatorConsumption.value ?? 0;

  const beneficiaries = useMemo(() => {
    return activeBens.map((b) => {
      const uc = ucMap.get(b.uc_beneficiaria_id);
      const benData = dashData?.beneficiaryConsumption.find((bc) => bc.ucId === b.uc_beneficiaria_id);
      return {
        ucId: b.uc_beneficiaria_id,
        label: uc ? `${uc.codigo_uc} — ${uc.nome}` : b.uc_beneficiaria_id.slice(0, 8),
        allocationPercent: Number(b.allocation_percent),
        consumedKwh: benData?.resolved.value ?? 0,
      };
    });
  }, [activeBens, ucMap, dashData]);

  return (
    <GdDecisionDashboard
      generationKwh={generationKwh}
      generatorUc={{
        ucId: ucGeradoraId,
        label: ucGeradoraLabel,
        consumedKwh: generatorConsumption,
      }}
      beneficiaries={beneficiaries}
      dataSources={dashData ? {
        generation: dashData.generation,
        generatorConsumption: dashData.generatorConsumption,
        beneficiaryConsumption: dashData.beneficiaryConsumption,
      } : null}
      isLoadingData={isLoading}
    />
  );
}
