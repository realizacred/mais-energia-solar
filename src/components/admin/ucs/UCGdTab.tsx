/**
 * UCGdTab — gestão de Geração Distribuída dentro da UC.
 * Linguagem natural, navegação simples, sem jargão técnico.
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, ArrowRight, Building2, GitBranch, Loader2, PieChart, Plus, Sun, Trash2, Users, Edit } from "lucide-react";
import { useGdGroupByGenerator, useGdBeneficiaries, useGdBeneficiariesByUC, useSaveGdBeneficiary, useDeleteGdBeneficiary, type GdBeneficiary } from "@/hooks/useGdBeneficiaries";
import { useSaveGdGroup, useDeleteGdGroup, type GdGroup } from "@/hooks/useGdGroups";
import { useUCsList, type UCOption } from "@/hooks/useFormSelects";
import { type UCRecord } from "@/services/unitService";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { buildUcDetailPath } from "./ucNavigation";
import { GdHelpCard } from "./GdHelpCard";
import { GdEnergyNetworkCard } from "./GdEnergyNetworkCard";
import { EditDistributionModal } from "./EditDistributionModal";

interface Props {
  uc: UCRecord;
}

const CATEGORIA_GD_LABELS: Record<string, string> = {
  gd1: "GD I",
  gd2: "GD II",
  gd3: "GD III",
};

type BeneficiaryWithGroup = GdBeneficiary & {
  gd_groups: { id: string; nome: string; uc_geradora_id: string; status: string; categoria_gd: string | null };
};

export function UCGdTab({ uc }: Props) {
  const navigate = useNavigate();
  const { data: allUcs = [] } = useUCsList();

  const { data: generatorGroups = [], isLoading: loadingGen } = useGdGroupByGenerator(uc.id);
  const { data: beneficiaryOf = [], isLoading: loadingBen } = useGdBeneficiariesByUC(uc.id);
  const activeGroup = generatorGroups[0] as GdGroup | undefined;
  const { data: beneficiaries = [], isLoading: loadingBenefs } = useGdBeneficiaries(activeGroup?.id ?? null);

  const isLoading = loadingGen || loadingBen;
  const isGenerator = uc.papel_gd === "geradora" || uc.tipo_uc === "gd_geradora" || uc.tipo_uc === "mista";
  const activeBeneficiariesCount = beneficiaries.filter((item) => item.is_active).length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── Role badges ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={isGenerator ? "text-xs bg-primary/10 text-primary border-primary/20" : "text-xs bg-muted text-muted-foreground border-border"}>
          <Sun className="w-3 h-3 mr-1" /> {isGenerator ? "Geradora" : "Sem papel de geradora"}
        </Badge>
        <Badge className={beneficiaryOf.length > 0 ? "text-xs bg-info/10 text-info border-info/20" : "text-xs bg-muted text-muted-foreground border-border"}>
          <Users className="w-3 h-3 mr-1" /> {beneficiaryOf.length > 0 ? `Recebe como beneficiária (${beneficiaryOf.length})` : "Esta UC não recebe como beneficiária"}
        </Badge>
        {activeGroup && !loadingBenefs && (
          <Badge variant="outline" className="text-xs border-info/20 text-info bg-info/10">
            <Users className="w-3 h-3 mr-1" />
            Grupo com {activeBeneficiariesCount} beneficiária{activeBeneficiariesCount === 1 ? "" : "s"}
          </Badge>
        )}
        {activeGroup && (
          <Badge variant="outline" className="text-xs">
            <GitBranch className="w-3 h-3 mr-1" /> {activeGroup.nome}
          </Badge>
        )}
      </div>

      {/* ─── Generator Section (unified card + modals) ─── */}
      {isGenerator && (
        <GeneratorSection
          uc={uc}
          group={activeGroup}
          beneficiaries={beneficiaries}
          loadingBenefs={loadingBenefs}
          allUcs={allUcs}
        />
      )}

      {/* ─── Beneficiary Section ─── */}
      {beneficiaryOf.length > 0 && (
        <BeneficiarySection
          currentUc={uc}
          beneficiaryOf={beneficiaryOf as BeneficiaryWithGroup[]}
          allUcs={allUcs}
        />
      )}

      {/* ─── Empty state ─── */}
      {!isGenerator && beneficiaryOf.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Sun className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Esta UC ainda não participa de Geração Distribuída</p>
            <p className="text-xs text-muted-foreground">Defina o papel GD no cadastro ou vincule esta UC a um grupo existente.</p>
          </CardContent>
        </Card>
      )}

      {/* ─── Help Card ─── */}
      <GdHelpCard
        isGenerator={isGenerator}
        isBeneficiary={beneficiaryOf.length > 0}
        hasGroup={!!activeGroup}
      />
    </div>
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
              <Users className="w-4 h-4 text-info" /> Grupos que fornecem créditos para esta UC
            </CardTitle>
            <CardDescription>
              Esta unidade recebe créditos de energia dos grupos abaixo. Navegue para a UC geradora ou veja a distribuição completa.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {beneficiaryOf.map((relation) => {
            const genUc = genMap.get(relation.gd_groups?.uc_geradora_id);
            const generatorPath = relation.gd_groups?.uc_geradora_id
              ? buildUcDetailPath(relation.gd_groups.uc_geradora_id, { tab: "overview" })
              : null;
            const groupPath = relation.gd_groups?.uc_geradora_id
              ? buildUcDetailPath(relation.gd_groups.uc_geradora_id, { tab: "gd" })
              : null;

            return (
              <div key={relation.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                {/* Group name + allocation */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Grupo "{relation.gd_groups?.nome}"
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recebe <span className="font-mono font-medium text-foreground">{Number(relation.allocation_percent).toFixed(1)}%</span> dos créditos deste grupo
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {relation.gd_groups?.categoria_gd && CATEGORIA_GD_LABELS[relation.gd_groups.categoria_gd] && (
                      <Badge variant="outline" className="text-[10px] border-primary/20 text-primary bg-primary/5">
                        {CATEGORIA_GD_LABELS[relation.gd_groups.categoria_gd]}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs border-info/20 text-info bg-info/10">
                      Beneficiária ativa
                    </Badge>
                  </div>
                </div>

                {/* Generator info */}
                {genUc && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-card border border-border">
                    <Sun className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs text-muted-foreground">UC geradora:</span>
                    <span className="text-xs font-medium text-foreground truncate">{genUc.nome}</span>
                    <span className="text-xs text-muted-foreground font-mono">({genUc.codigo_uc})</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {generatorPath && (
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate(generatorPath)}>
                      <Building2 className="w-3 h-3" /> Ir para UC geradora
                    </Button>
                  )}
                  {groupPath && (
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate(groupPath)}>
                      <Users className="w-3 h-3" /> Ver grupo e distribuição
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
  const deleteGroup = useDeleteGdGroup();
  const deleteBeneficiary = useDeleteGdBeneficiary();

  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState(uc.nome);
  const [addBenOpen, setAddBenOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editDistOpen, setEditDistOpen] = useState(false);

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

  const handleDeleteGroup = useCallback(async () => {
    if (!group) return;
    try {
      await deleteGroup.mutateAsync(group.id);
      qc.invalidateQueries({ queryKey: ["gd_groups", "by_generator", uc.id] });
      qc.invalidateQueries({ queryKey: ["gd_groups"] });
      toast({ title: "Grupo GD excluído" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir grupo", description: err?.message, variant: "destructive" });
    } finally {
      setDeleteGroupConfirm(false);
    }
  }, [group, deleteGroup, uc.id, qc, toast]);

  const handleEditGroup = useCallback(async () => {
    if (!group || !editGroupName.trim()) return;
    try {
      await saveGroup.mutateAsync({ id: group.id, nome: editGroupName });
      qc.invalidateQueries({ queryKey: ["gd_groups", "by_generator", uc.id] });
      qc.invalidateQueries({ queryKey: ["gd_groups"] });
      toast({ title: "Grupo atualizado" });
      setEditGroupOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  }, [group, editGroupName, saveGroup, uc.id, qc, toast]);

  const handleCreateNewGroup = useCallback(async () => {
    if (!newGroupName.trim()) return;
    try {
      // Deactivate current group (keep history)
      if (group) {
        await saveGroup.mutateAsync({ id: group.id, status: "inactive" });
      }
      // Create new active group
      await saveGroup.mutateAsync({
        nome: newGroupName,
        uc_geradora_id: uc.id,
        concessionaria_id: uc.concessionaria_id || "",
        cliente_id: uc.cliente_id,
        status: "active",
      });
      qc.invalidateQueries({ queryKey: ["gd_groups", "by_generator", uc.id] });
      qc.invalidateQueries({ queryKey: ["gd_groups"] });
      toast({ title: "Novo grupo GD criado!", description: group ? "O grupo anterior foi desativado." : undefined });
      setNewGroupOpen(false);
      setNewGroupName("");
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  }, [group, newGroupName, saveGroup, uc, qc, toast]);

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
      {/* Unified GD card — energy network + management */}
      <GdEnergyNetworkCard
        groupId={group.id}
        groupName={group.nome}
        generatorUcId={uc.id}
        generatorName={uc.nome}
        generatorCodigo={uc.codigo_uc}
        beneficiaries={beneficiaries}
        allUcs={allUcs}
        tarifaMedia={(uc as any).tarifa_media_kwh ?? null}
        categoriaGd={group.categoria_gd}
        onAddBeneficiary={() => setAddBenOpen(true)}
        onEditDistribution={() => setEditDistOpen(true)}
        onRenameGroup={() => { setEditGroupName(group.nome); setEditGroupOpen(true); }}
        onNewGroup={() => { setNewGroupName(""); setNewGroupOpen(true); }}
        onDeleteGroup={() => setDeleteGroupConfirm(true)}
        onDeleteBeneficiary={(id) => setDeleteTarget(id)}
      />

      <AddBeneficiaryDialog
        open={addBenOpen}
        onOpenChange={setAddBenOpen}
        groupId={group.id}
        availableUcs={availableUcs}
      />

      <EditDistributionModal
        open={editDistOpen}
        onOpenChange={setEditDistOpen}
        groupId={group.id}
        groupName={group.nome}
        generatorName={uc.nome}
        beneficiaries={beneficiaries}
        allUcs={allUcs}
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

      {/* Delete Group Confirmation */}
      <AlertDialog open={deleteGroupConfirm} onOpenChange={setDeleteGroupConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir grupo GD "{group.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {beneficiaries.length > 0
                ? `Este grupo possui ${beneficiaries.length} beneficiária(s) vinculada(s). Todas serão desvinculadas. Esta ação não pode ser desfeita.`
                : "Esta ação irá excluir o grupo GD permanentemente. Os dados históricos de compensação não serão afetados."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              className="border-destructive text-destructive bg-transparent hover:bg-destructive/10"
            >
              {deleteGroup.isPending ? "Excluindo..." : "Excluir Grupo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Group Name */}
      <Dialog open={editGroupOpen} onOpenChange={setEditGroupOpen}>
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Edit className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">Renomear Grupo GD</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Altere o nome do grupo</p>
            </div>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do grupo</Label>
              <Input value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} placeholder="Nome do grupo" />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => setEditGroupOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditGroup} disabled={saveGroup.isPending || !editGroupName.trim()}>
              {saveGroup.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Group (replace current) */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">Novo Grupo GD</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">O grupo atual será desativado e mantido no histórico</p>
            </div>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do novo grupo</Label>
              <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Ex: Grupo Residencial 2026" />
            </div>
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-warning" /> Grupo atual será desativado
              </p>
              <p>O grupo <span className="font-medium text-foreground">"{group.nome}"</span> com {beneficiaries.length} beneficiária(s) será marcado como inativo. Os dados históricos serão preservados.</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">UC Geradora:</span> {uc.nome} ({uc.codigo_uc})</p>
              <p><span className="font-medium text-foreground">Concessionária:</span> {uc.concessionaria_nome || "Não definida"}</p>
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => setNewGroupOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateNewGroup} disabled={saveGroup.isPending || !newGroupName.trim()}>
              {saveGroup.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Novo Grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
