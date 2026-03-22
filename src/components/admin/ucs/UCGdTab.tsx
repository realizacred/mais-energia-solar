/**
 * UCGdTab — GD group management tab inside UCDetailPage.
 * Allows creating a group (if UC is geradora) and managing beneficiaries.
 * §16: queries in hooks. §4: table pattern. §12: skeleton. §26: headers.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sun, Users, Plus, Trash2, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useGdGroupByGenerator, useGdBeneficiaries, useGdBeneficiariesByUC, useSaveGdBeneficiary, useDeleteGdBeneficiary, type GdBeneficiary } from "@/hooks/useGdBeneficiaries";
import { useSaveGdGroup, type GdGroup } from "@/hooks/useGdGroups";
import { unitService, type UCRecord } from "@/services/unitService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props {
  uc: UCRecord;
}

export function UCGdTab({ uc }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // This UC as generator
  const { data: generatorGroups = [], isLoading: loadingGen } = useGdGroupByGenerator(uc.id);
  // This UC as beneficiary
  const { data: beneficiaryOf = [], isLoading: loadingBen } = useGdBeneficiariesByUC(uc.id);

  const activeGroup = generatorGroups[0] as GdGroup | undefined;

  // Beneficiaries of the group this UC generates
  const { data: beneficiaries = [], isLoading: loadingBenefs } = useGdBeneficiaries(activeGroup?.id ?? null);

  const isLoading = loadingGen || loadingBen;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  const isGenerator = uc.papel_gd === "geradora" || uc.tipo_uc === "gd_geradora" || uc.tipo_uc === "mista";

  return (
    <div className="space-y-6">
      {/* Generator Section */}
      {isGenerator && (
        <GeneratorSection
          uc={uc}
          group={activeGroup}
          beneficiaries={beneficiaries}
          loadingBenefs={loadingBenefs}
        />
      )}

      {/* Beneficiary Section */}
      {beneficiaryOf.length > 0 && (
        <Card className="border-l-[3px] border-l-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" /> Esta UC como Beneficiária
            </CardTitle>
            <CardDescription>Grupos GD onde esta UC recebe créditos</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {beneficiaryOf.map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <Badge variant="outline" className="text-xs shrink-0">
                    <Users className="w-3 h-3 mr-1" /> Beneficiária
                  </Badge>
                  <span className="text-sm text-foreground">{b.gd_groups?.nome}</span>
                  <span className="text-xs text-muted-foreground font-mono ml-auto">
                    {Number(b.allocation_percent).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No GD participation */}
      {!isGenerator && beneficiaryOf.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Sun className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Esta UC não participa de nenhum grupo de Geração Distribuída</p>
            <p className="text-xs text-muted-foreground">Defina o papel GD como "Geradora" no cadastro para criar um grupo</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Generator Section ──
function GeneratorSection({
  uc, group, beneficiaries, loadingBenefs,
}: {
  uc: UCRecord;
  group: GdGroup | undefined;
  beneficiaries: GdBeneficiary[];
  loadingBenefs: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const saveGroup = useSaveGdGroup();
  const saveBeneficiary = useSaveGdBeneficiary();
  const deleteBeneficiary = useDeleteGdBeneficiary();

  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState(uc.nome);
  const [addBenOpen, setAddBenOpen] = useState(false);

  // UC list for beneficiary select
  const { data: allUcs = [] } = useQuery({
    queryKey: ["ucs_for_gd_select"],
    queryFn: () => unitService.list({ is_archived: false }),
    staleTime: 1000 * 60 * 5,
  });

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

  async function handleDeleteBeneficiary(id: string) {
    try {
      await deleteBeneficiary.mutateAsync(id);
      qc.invalidateQueries({ queryKey: ["gd_group_beneficiaries", group?.id] });
      toast({ title: "Beneficiária removida" });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  }

  // No group yet — show CTA
  if (!group) {
    return (
      <>
        <Card className="border-l-[3px] border-l-primary">
          <CardContent className="py-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Sun className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">UC Geradora sem grupo GD</p>
              <p className="text-xs text-muted-foreground mt-1">Crie um grupo para gerenciar créditos com UCs beneficiárias</p>
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

  // Group exists — show beneficiaries management
  const usedIds = new Set([uc.id, ...beneficiaries.map(b => b.uc_beneficiaria_id)]);
  const availableUcs = allUcs.filter(u => !usedIds.has(u.id));
  const totalAllocation = beneficiaries.reduce((s, b) => s + Number(b.allocation_percent), 0);

  return (
    <>
      {/* Group Info */}
      <Card className="border-l-[3px] border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="w-4 h-4 text-primary" /> Grupo GD: {group.nome}
            </CardTitle>
            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Geradora</Badge>
          </div>
          <CardDescription>Gerencie as UCs beneficiárias deste grupo</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* Allocation summary */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border">
            <div>
              <p className="text-xs text-muted-foreground">Alocação total</p>
              <p className={`text-lg font-bold ${totalAllocation > 100 ? 'text-destructive' : 'text-foreground'}`}>
                {totalAllocation.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Beneficiárias</p>
              <p className="text-lg font-bold text-foreground">{beneficiaries.length}</p>
            </div>
            {totalAllocation > 100 && (
              <div className="flex items-center gap-1 text-xs text-destructive ml-auto">
                <AlertCircle className="w-3.5 h-3.5" /> Excede 100%
              </div>
            )}
          </div>

          {/* Beneficiaries table */}
          {loadingBenefs ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : beneficiaries.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma UC beneficiária adicionada</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">UC Beneficiária</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Alocação (%)</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {beneficiaries.map((b) => {
                    const ucBen = allUcs.find(u => u.id === b.uc_beneficiaria_id);
                    return (
                      <TableRow key={b.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-sm text-foreground">
                          <div>
                            <p className="font-medium">{ucBen?.nome || "UC desconhecida"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{ucBen?.codigo_uc || "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Number(b.allocation_percent).toFixed(2)}%
                        </TableCell>
                        <TableCell>
                          <Badge variant={b.is_active ? "default" : "secondary"} className="text-xs">
                            {b.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDeleteBeneficiary(b.id)}
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

      {/* Add beneficiary dialog */}
      <AddBeneficiaryDialog
        open={addBenOpen}
        onOpenChange={setAddBenOpen}
        groupId={group.id}
        availableUcs={availableUcs}
      />
    </>
  );
}

// ── Add Beneficiary Dialog ──
function AddBeneficiaryDialog({
  open, onOpenChange, groupId, availableUcs,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  availableUcs: UCRecord[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const saveBen = useSaveGdBeneficiary();
  const [ucId, setUcId] = useState("");
  const [percent, setPercent] = useState("10");

  async function handleAdd() {
    if (!ucId) {
      toast({ title: "Selecione uma UC", variant: "destructive" });
      return;
    }
    const pct = parseFloat(percent);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast({ title: "Percentual inválido (1-100)", variant: "destructive" });
      return;
    }
    try {
      await saveBen.mutateAsync({
        gd_group_id: groupId,
        uc_beneficiaria_id: ucId,
        allocation_type: "percent",
        allocation_percent: pct,
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
                  {availableUcs.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} — {u.codigo_uc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableUcs.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma UC disponível para adicionar</p>
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
                onChange={(e) => setPercent(e.target.value)}
                placeholder="10"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={saveBen.isPending || !ucId}>
            {saveBen.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
