/**
 * UCGdTab — gestão contextual de GD dentro da UC.
 * Foco em clareza visual, distinção geradora/beneficiária e navegação ida e volta.
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, ArrowLeft, Building2, GitBranch, Loader2, MoveRight, Plus, Sun, Trash2, Users, Edit } from "lucide-react";
import { useGdGroupByGenerator, useGdBeneficiaries, useGdBeneficiariesByUC, useSaveGdBeneficiary, useDeleteGdBeneficiary, type GdBeneficiary } from "@/hooks/useGdBeneficiaries";
import { useSaveGdGroup, useDeleteGdGroup, type GdGroup } from "@/hooks/useGdGroups";
import { useUCsList, type UCOption } from "@/hooks/useFormSelects";
import { type UCRecord } from "@/services/unitService";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { buildUcDetailPath, readUcNavigationContext, type UcNavigationContext } from "./ucNavigation";

interface Props {
  uc: UCRecord;
}

type BeneficiaryWithGroup = GdBeneficiary & {
  gd_groups: { id: string; nome: string; uc_geradora_id: string; status: string };
};

export function UCGdTab({ uc }: Props) {
  const [searchParams] = useSearchParams();
  const navigationContext = readUcNavigationContext(searchParams);
  const { data: allUcs = [] } = useUCsList();

  const { data: generatorGroups = [], isLoading: loadingGen } = useGdGroupByGenerator(uc.id);
  const { data: beneficiaryOf = [], isLoading: loadingBen } = useGdBeneficiariesByUC(uc.id);
  const activeGroup = generatorGroups[0] as GdGroup | undefined;
  const { data: beneficiaries = [], isLoading: loadingBenefs } = useGdBeneficiaries(activeGroup?.id ?? null);

  const isLoading = loadingGen || loadingBen;
  const isGenerator = uc.papel_gd === "geradora" || uc.tipo_uc === "gd_geradora" || uc.tipo_uc === "mista";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GdSummaryCard
        uc={uc}
        isGenerator={isGenerator}
        activeGroup={activeGroup}
        beneficiaries={beneficiaries}
        beneficiaryOf={beneficiaryOf as BeneficiaryWithGroup[]}
        navigationContext={navigationContext}
      />

      {isGenerator && (
        <GeneratorSection
          uc={uc}
          group={activeGroup}
          beneficiaries={beneficiaries}
          loadingBenefs={loadingBenefs}
          allUcs={allUcs}
        />
      )}

      {beneficiaryOf.length > 0 && (
        <BeneficiarySection
          currentUc={uc}
          beneficiaryOf={beneficiaryOf as BeneficiaryWithGroup[]}
          allUcs={allUcs}
        />
      )}

      {!isGenerator && beneficiaryOf.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Sun className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Esta UC ainda não participa de Geração Distribuída</p>
            <p className="text-xs text-muted-foreground">Defina o papel GD no cadastro ou vincule esta UC a um grupo existente para habilitar a navegação contextual.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GdSummaryCard({
  uc,
  isGenerator,
  activeGroup,
  beneficiaries,
  beneficiaryOf,
  navigationContext,
}: {
  uc: UCRecord;
  isGenerator: boolean;
  activeGroup?: GdGroup;
  beneficiaries: GdBeneficiary[];
  beneficiaryOf: BeneficiaryWithGroup[];
  navigationContext: UcNavigationContext;
}) {
  const navigate = useNavigate();
  const hasContext = !!navigationContext.fromUcId && navigationContext.fromUcId !== uc.id;

  return (
    <Card className="border-l-[3px] border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" /> Mapa GD desta UC
            </CardTitle>
            <CardDescription>
              Aqui fica claro se <span className="font-medium text-foreground">{uc.nome}</span> gera créditos, recebe créditos e para onde você pode navegar sem perder contexto.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={isGenerator ? "text-xs bg-primary/10 text-primary border-primary/20" : "text-xs bg-muted text-muted-foreground border-border"}>
              <Sun className="w-3 h-3 mr-1" /> {isGenerator ? "Atua como geradora" : "Sem papel de geradora"}
            </Badge>
            <Badge className={beneficiaryOf.length > 0 ? "text-xs bg-info/10 text-info border-info/20" : "text-xs bg-muted text-muted-foreground border-border"}>
              <Users className="w-3 h-3 mr-1" /> {beneficiaryOf.length > 0 ? "Recebe créditos" : "Sem vínculo como beneficiária"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">Como Geradora</p>
            <p className="text-sm text-muted-foreground">
              {activeGroup
                ? `Grupo ${activeGroup.nome} com ${beneficiaries.length} beneficiária${beneficiaries.length === 1 ? "" : "s"} vinculada${beneficiaries.length === 1 ? "" : "s"}.`
                : isGenerator
                  ? "UC configurada para gerar créditos, mas ainda sem grupo GD criado."
                  : "Esta UC não distribui créditos para outras unidades."}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">Como Beneficiária</p>
            <p className="text-sm text-muted-foreground">
              {beneficiaryOf.length > 0
                ? `${beneficiaryOf.length} vínculo${beneficiaryOf.length === 1 ? "" : "s"} ativo${beneficiaryOf.length === 1 ? "" : "s"} em grupos GD.`
                : "Esta UC não recebe créditos de outro grupo GD neste momento."}
            </p>
          </div>
        </div>

        {hasContext && navigationContext.fromUcId && (
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contexto preservado</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground truncate">{navigationContext.fromUcName || "UC relacionada"}</span>
                {navigationContext.gdGroupName && (
                  <>
                    <MoveRight className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground truncate">{navigationContext.gdGroupName}</span>
                  </>
                )}
                <MoveRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-foreground truncate">{uc.nome}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {navigationContext.origin === "gd-generator"
                  ? "Você abriu esta UC a partir da visão da geradora; o retorno para o grupo GD foi preservado."
                  : navigationContext.origin === "gd-beneficiary"
                    ? "Você abriu esta UC a partir de uma beneficiária; o caminho de volta para a UC e para o grupo foi mantido."
                    : "A navegação contextual entre UCs relacionadas está ativa nesta tela."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() =>
                  navigate(
                    buildUcDetailPath(navigationContext.fromUcId!, {
                      tab: navigationContext.returnTab || "overview",
                      subtab: navigationContext.returnSubtab || null,
                      origin: "gd-return",
                      fromUcId: uc.id,
                      fromUcName: uc.nome,
                      fromUcCode: uc.codigo_uc,
                      gdGroupId: navigationContext.gdGroupId,
                      gdGroupName: navigationContext.gdGroupName,
                      relatedUcId: uc.id,
                      relatedUcName: uc.nome,
                      relatedUcCode: uc.codigo_uc,
                      beneficiaryId: navigationContext.beneficiaryId,
                      beneficiaryName: navigationContext.beneficiaryName,
                    }),
                  )
                }
              >
                <ArrowLeft className="w-3 h-3" /> Voltar para UC
              </Button>
              <Button
                variant="soft"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() =>
                  navigate(
                    buildUcDetailPath(navigationContext.fromUcId!, {
                      tab: "gd",
                      origin: "gd-return",
                      fromUcId: uc.id,
                      fromUcName: uc.nome,
                      fromUcCode: uc.codigo_uc,
                      gdGroupId: navigationContext.gdGroupId,
                      gdGroupName: navigationContext.gdGroupName,
                      relatedUcId: uc.id,
                      relatedUcName: uc.nome,
                      relatedUcCode: uc.codigo_uc,
                      beneficiaryId: navigationContext.beneficiaryId,
                      beneficiaryName: navigationContext.beneficiaryName,
                    }),
                  )
                }
              >
                <GitBranch className="w-3 h-3" /> Voltar para GD
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BeneficiarySection({
  currentUc,
  beneficiaryOf,
  allUcs,
}: {
  currentUc: UCRecord;
  beneficiaryOf: BeneficiaryWithGroup[];
  allUcs: UCOption[];
}) {
  const navigate = useNavigate();
  const genMap = useMemo(() => new Map(allUcs.map((u) => [u.id, u])), [allUcs]);

  return (
    <Card className="border-l-[3px] border-l-info">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-info" /> Como Beneficiária
            </CardTitle>
            <CardDescription>
              Esta UC recebe créditos dos grupos abaixo. Use os atalhos para abrir a UC geradora ou voltar direto para a gestão do grupo.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs border-info/20 text-info bg-info/10">
            {beneficiaryOf.length} vínculo{beneficiaryOf.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {beneficiaryOf.map((relation) => {
            const genUc = genMap.get(relation.gd_groups?.uc_geradora_id);
            const generatorOverviewPath = relation.gd_groups?.uc_geradora_id
              ? buildUcDetailPath(relation.gd_groups.uc_geradora_id, {
                  tab: "overview",
                  origin: "gd-beneficiary",
                  fromUcId: currentUc.id,
                  fromUcName: currentUc.nome,
                  fromUcCode: currentUc.codigo_uc,
                  gdGroupId: relation.gd_groups.id,
                  gdGroupName: relation.gd_groups.nome,
                  relatedUcId: currentUc.id,
                  relatedUcName: currentUc.nome,
                  relatedUcCode: currentUc.codigo_uc,
                  returnTab: "gd",
                })
              : null;
            const generatorGroupPath = relation.gd_groups?.uc_geradora_id
              ? buildUcDetailPath(relation.gd_groups.uc_geradora_id, {
                  tab: "gd",
                  origin: "gd-beneficiary",
                  fromUcId: currentUc.id,
                  fromUcName: currentUc.nome,
                  fromUcCode: currentUc.codigo_uc,
                  gdGroupId: relation.gd_groups.id,
                  gdGroupName: relation.gd_groups.nome,
                  relatedUcId: currentUc.id,
                  relatedUcName: currentUc.nome,
                  relatedUcCode: currentUc.codigo_uc,
                  returnTab: "gd",
                })
              : null;

            return (
              <div key={relation.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{relation.gd_groups?.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      Esta UC recebe <span className="font-mono text-foreground">{Number(relation.allocation_percent).toFixed(2)}%</span> deste grupo.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Users className="w-3 h-3 mr-1" /> Beneficiária ativa
                  </Badge>
                </div>

                <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
                  <FlowCard label="UC atual" title={currentUc.nome} subtitle={currentUc.codigo_uc} />
                  <MoveRight className="w-4 h-4 text-muted-foreground hidden lg:block" />
                  <FlowCard label="Grupo GD" title={relation.gd_groups?.nome} subtitle={`Alocação ${Number(relation.allocation_percent).toFixed(2)}%`} />
                  <MoveRight className="w-4 h-4 text-muted-foreground hidden lg:block" />
                  <FlowCard label="UC geradora" title={genUc?.nome || "UC geradora"} subtitle={genUc?.codigo_uc || "—"} />
                </div>

                <div className="flex flex-wrap gap-2">
                  {generatorOverviewPath && (
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate(generatorOverviewPath)}>
                      <Building2 className="w-3 h-3" /> Abrir UC geradora
                    </Button>
                  )}
                  {generatorGroupPath && (
                    <Button variant="soft" size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate(generatorGroupPath)}>
                      <GitBranch className="w-3 h-3" /> Abrir grupo GD
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function GeneratorSection({
  uc,
  group,
  beneficiaries,
  loadingBenefs,
  allUcs,
}: {
  uc: UCRecord;
  group: GdGroup | undefined;
  beneficiaries: GdBeneficiary[];
  loadingBenefs: boolean;
  allUcs: UCOption[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const saveGroup = useSaveGdGroup();
  const deleteBeneficiary = useDeleteGdBeneficiary();

  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState(uc.nome);
  const [addBenOpen, setAddBenOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function handleCreateGroup() {
    try {
      await saveGroup.mutateAsync({
        nome: groupName,
        uc_geradora_id: uc.id,
        concessionaria_id: uc.concessionaria_id || "",
        cliente_id: uc.cliente_id,
        status: "active",
      });
      qc.invalidateQueries({ queryKey: ["gd_groups", "by_generator", uc.id] });
      toast({ title: "Grupo GD criado!" });
      setCreateGroupOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  }

  const confirmDeleteBeneficiary = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteBeneficiary.mutateAsync(deleteTarget);
      qc.invalidateQueries({ queryKey: ["gd_group_beneficiaries", group?.id] });
      toast({ title: "Beneficiária removida" });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteBeneficiary, group?.id, qc, toast]);

  if (!group) {
    return (
      <>
        <Card className="border-l-[3px] border-l-primary">
          <CardContent className="py-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Sun className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">UC geradora sem grupo GD configurado</p>
              <p className="text-xs text-muted-foreground mt-1">Crie o grupo para conectar beneficiárias e dar contexto de navegação para a operação.</p>
            </div>
            <Button onClick={() => setCreateGroupOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Criar Grupo GD
            </Button>
          </CardContent>
        </Card>

        <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
          <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
            <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sun className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-base font-semibold text-foreground">Criar Grupo GD</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Esta UC será a geradora do grupo</p>
              </div>
            </DialogHeader>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do grupo</Label>
                <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex: Grupo Residencial" />
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground space-y-1">
                <p><span className="font-medium text-foreground">UC Geradora:</span> {uc.nome} ({uc.codigo_uc})</p>
                <p><span className="font-medium text-foreground">Concessionária:</span> {uc.concessionaria_nome || "Não definida"}</p>
              </div>
            </div>
            <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
              <Button variant="outline" onClick={() => setCreateGroupOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateGroup} disabled={saveGroup.isPending || !groupName.trim()}>
                {saveGroup.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar Grupo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const usedIds = new Set([uc.id, ...beneficiaries.map((item) => item.uc_beneficiaria_id)]);
  const availableUcs = allUcs.filter((item) => !usedIds.has(item.id));
  const totalAllocation = beneficiaries.reduce((sum, item) => sum + Number(item.allocation_percent), 0);

  return (
    <>
      <Card className="border-l-[3px] border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Sun className="w-4 h-4 text-primary" /> Como Geradora
              </CardTitle>
              <CardDescription>
                Esta UC é a origem do grupo <span className="font-medium text-foreground">{group.nome}</span>. Abra cada beneficiária sem perder o caminho de volta para o grupo.
              </CardDescription>
            </div>
            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Grupo ativo</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Grupo GD" value={group.nome} />
            <MetricCard label="UC geradora" value={uc.nome} subtitle={uc.codigo_uc} />
            <MetricCard label="Beneficiárias" value={String(beneficiaries.length)} />
            <MetricCard
              label="Alocação total"
              value={`${totalAllocation.toFixed(2)}%`}
              tone={totalAllocation > 100 ? "destructive" : "default"}
              subtitle={totalAllocation > 100 ? "Ajuste necessário: soma acima de 100%." : undefined}
            />
          </div>

          {loadingBenefs ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : beneficiaries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Nenhuma beneficiária conectada</p>
              <p className="text-xs text-muted-foreground">Adicione beneficiárias para este grupo ficar operacional e navegável.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">UC Beneficiária</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Alocação (%)</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground">Navegação</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {beneficiaries.map((item) => {
                    const beneficiaryUc = allUcs.find((candidate) => candidate.id === item.uc_beneficiaria_id);
                    const beneficiaryOverviewPath = buildUcDetailPath(item.uc_beneficiaria_id, {
                      tab: "overview",
                      origin: "gd-generator",
                      fromUcId: uc.id,
                      fromUcName: uc.nome,
                      fromUcCode: uc.codigo_uc,
                      gdGroupId: group.id,
                      gdGroupName: group.nome,
                      relatedUcId: uc.id,
                      relatedUcName: uc.nome,
                      relatedUcCode: uc.codigo_uc,
                      beneficiaryId: item.uc_beneficiaria_id,
                      beneficiaryName: beneficiaryUc?.nome || null,
                      returnTab: "gd",
                    });
                    const beneficiaryGdPath = buildUcDetailPath(item.uc_beneficiaria_id, {
                      tab: "gd",
                      origin: "gd-generator",
                      fromUcId: uc.id,
                      fromUcName: uc.nome,
                      fromUcCode: uc.codigo_uc,
                      gdGroupId: group.id,
                      gdGroupName: group.nome,
                      relatedUcId: uc.id,
                      relatedUcName: uc.nome,
                      relatedUcCode: uc.codigo_uc,
                      beneficiaryId: item.uc_beneficiaria_id,
                      beneficiaryName: beneficiaryUc?.nome || null,
                      returnTab: "gd",
                    });

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="align-middle">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{beneficiaryUc?.nome || "UC desconhecida"}</p>
                            <p className="text-xs font-mono text-muted-foreground">{beneficiaryUc?.codigo_uc || "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm align-middle">
                          {Number(item.allocation_percent).toFixed(2)}%
                        </TableCell>
                        <TableCell className="align-middle">
                          <Badge variant={item.is_active ? "default" : "secondary"} className="text-xs">
                            {item.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-middle">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate(beneficiaryOverviewPath)}>
                              <Building2 className="w-3 h-3" /> Abrir UC
                            </Button>
                            <Button variant="soft" size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate(beneficiaryGdPath)}>
                              <Users className="w-3 h-3" /> Ver como beneficiária
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(item.id);
                            }}
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

          <Button variant="outline" size="sm" onClick={() => setAddBenOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Beneficiária
          </Button>
        </CardContent>
      </Card>

      <AddBeneficiaryDialog
        open={addBenOpen}
        onOpenChange={setAddBenOpen}
        groupId={group.id}
        availableUcs={availableUcs}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover beneficiária?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá desvincular a UC do grupo GD. Os créditos já compensados não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteBeneficiary}
              className="border-destructive text-destructive bg-transparent hover:bg-destructive/10"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FlowCard({ label, title, subtitle }: { label: string; title: string; subtitle: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground font-mono">{subtitle}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  tone = "default",
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone?: "default" | "destructive";
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={tone === "destructive" ? "text-2xl font-bold text-destructive mt-1" : "text-2xl font-bold text-foreground mt-1"}>{value}</p>
      {subtitle && <p className={tone === "destructive" ? "text-xs text-destructive mt-1" : "text-xs text-muted-foreground mt-1"}>{subtitle}</p>}
    </div>
  );
}

function AddBeneficiaryDialog({
  open,
  onOpenChange,
  groupId,
  availableUcs,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  groupId: string;
  availableUcs: UCOption[];
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const saveBeneficiary = useSaveGdBeneficiary();
  const [ucId, setUcId] = useState("");
  const [percent, setPercent] = useState("10");

  async function handleAdd() {
    if (!ucId) {
      toast({ title: "Selecione uma UC", variant: "destructive" });
      return;
    }

    const parsedPercent = parseFloat(percent);
    if (Number.isNaN(parsedPercent) || parsedPercent <= 0 || parsedPercent > 100) {
      toast({ title: "Percentual inválido (1-100)", variant: "destructive" });
      return;
    }

    try {
      await saveBeneficiary.mutateAsync({
        gd_group_id: groupId,
        uc_beneficiaria_id: ucId,
        allocation_type: "percent",
        allocation_percent: parsedPercent,
        is_active: true,
      });
      qc.invalidateQueries({ queryKey: ["gd_group_beneficiaries", groupId] });
      toast({ title: "Beneficiária adicionada!" });
      onOpenChange(false);
      setUcId("");
      setPercent("10");
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Adicionar Beneficiária</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Selecione a UC e defina o percentual de créditos</p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">UC Beneficiária</Label>
              <Select value={ucId} onValueChange={setUcId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma UC..." /></SelectTrigger>
                <SelectContent>
                  {availableUcs.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nome} — {item.codigo_uc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableUcs.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Nenhuma UC disponível para adicionar</p>
                  <p className="text-xs text-muted-foreground">Cadastre novas UCs primeiro para adicioná-las como beneficiárias</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/admin/ucs");
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Ir para cadastro de UCs
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Percentual de alocação (%)</Label>
              <Input
                type="number"
                min={0.01}
                max={100}
                step="0.01"
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
                placeholder="10"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={saveBeneficiary.isPending || !ucId}>
            {saveBeneficiary.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
