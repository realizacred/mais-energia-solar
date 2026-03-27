/**
 * GdBeneficiaryFormModal — Add beneficiary UC to a GD Group.
 * Supports selecting existing UC or creating a new one inline.
 * §25-S1: w-[90vw] mandatory.
 */
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/EmailInput";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Users, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSaveGdBeneficiary, type GdBeneficiary } from "@/hooks/useGdBeneficiaries";
import { useUCsList } from "@/hooks/useFormSelects";
import { useConcessionarias } from "@/hooks/useConcessionarias";
import { gdService } from "@/services/gdService";
import { unitService } from "@/services/unitService";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  ucGeradoraId?: string;
  existingBeneficiaries: GdBeneficiary[];
}

export function GdBeneficiaryFormModal({ open, onOpenChange, groupId, ucGeradoraId, existingBeneficiaries }: Props) {
  const { toast } = useToast();
  const saveBen = useSaveGdBeneficiary();
  const { data: ucs = [] } = useUCsList();
  const { data: concessionarias = [] } = useConcessionarias();

  // Filter out the generator UC and already-linked active beneficiaries
  const existingUcIds = new Set(existingBeneficiaries.filter(b => b.is_active).map(b => b.uc_beneficiaria_id));
  const availableUcs = useMemo(() => 
    ucs.filter(u => u.id !== ucGeradoraId && !existingUcIds.has(u.id)),
    [ucs, ucGeradoraId, existingBeneficiaries]
  );
  const noAvailableUcs = availableUcs.length === 0;

  const [createNew, setCreateNew] = useState(false);
  // Auto-enable create mode when no UCs available
  const effectiveCreateNew = createNew || noAvailableUcs;

  const [form, setForm] = useState({
    uc_beneficiaria_id: "",
    allocation_percent: "",
    start_date: "",
    end_date: "",
    notes: "",
  });
  const [newUc, setNewUc] = useState({
    nome: "",
    codigo_uc: "",
    concessionaria_id: "",
    email_fatura: "",
  });

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setUc = (k: string) => (v: string) => setNewUc((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    let ucId = form.uc_beneficiaria_id;

    // Create new UC if toggle is on
    if (effectiveCreateNew) {
      if (!newUc.nome.trim() || !newUc.codigo_uc.trim()) {
        toast({ title: "Nome e Código da UC são obrigatórios", variant: "destructive" });
        return;
      }
      if (!newUc.concessionaria_id) {
        toast({ title: "Concessionária é obrigatória", variant: "destructive" });
        return;
      }
      try {
        const { tenantId } = await getCurrentTenantId();
        const conc = concessionarias.find(c => c.id === newUc.concessionaria_id);
        const created = await unitService.create({
          nome: newUc.nome.trim(),
          codigo_uc: newUc.codigo_uc.trim(),
          tipo_uc: "beneficiaria" as any,
          papel_gd: "beneficiaria" as any,
          concessionaria_id: newUc.concessionaria_id,
          concessionaria_nome: conc?.nome || null,
          email_fatura: newUc.email_fatura.trim() || null,
          status: "active",
          tenant_id: tenantId,
        } as any);
        ucId = created.id;
      } catch (err: any) {
        toast({ title: "Erro ao criar UC", description: err?.message, variant: "destructive" });
        return;
      }
    }

    if (!ucId) {
      toast({ title: "Selecione a UC beneficiária", variant: "destructive" });
      return;
    }

    const percent = parseFloat(form.allocation_percent);
    if (!gdService.isValidPercent(percent)) {
      toast({ title: "Percentual deve ser entre 0,01 e 100", variant: "destructive" });
      return;
    }

    if (gdService.hasDuplicateUC(existingBeneficiaries, ucId)) {
      toast({ title: "Esta UC já está vinculada como beneficiária neste grupo", variant: "destructive" });
      return;
    }

    try {
      await saveBen.mutateAsync({
        gd_group_id: groupId,
        uc_beneficiaria_id: ucId,
        allocation_percent: percent,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
        is_active: true,
      });
      toast({ title: effectiveCreateNew ? "UC criada e vinculada como beneficiária" : "Beneficiária adicionada" });
      setForm({ uc_beneficiaria_id: "", allocation_percent: "", start_date: "", end_date: "", notes: "" });
      setNewUc({ nome: "", codigo_uc: "", concessionaria_id: "", email_fatura: "" });
      setCreateNew(false);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao adicionar", description: err?.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Adicionar Beneficiária
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vincule uma UC existente ou crie uma nova como beneficiária
            </p>
            {noAvailableUcs && (
              <p className="text-xs text-warning mt-0.5">
                Nenhuma UC existente disponível — crie uma nova abaixo
              </p>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            {/* Toggle: Existing vs New UC — hidden when no UCs available */}
            {!noAvailableUcs && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  <Label className="text-xs font-medium">Criar nova UC</Label>
                </div>
                <Switch checked={createNew} onCheckedChange={setCreateNew} />
              </div>
            )}

            {effectiveCreateNew ? (
              /* New UC inline form */
              <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nova UC Beneficiária</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome <span className="text-destructive">*</span></Label>
                    <Input value={newUc.nome} onChange={(e) => setUc("nome")(e.target.value)} placeholder="Nome da UC" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Código UC <span className="text-destructive">*</span></Label>
                    <Input value={newUc.codigo_uc} onChange={(e) => setUc("codigo_uc")(e.target.value)} placeholder="Ex: 0012345678" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Concessionária <span className="text-destructive">*</span></Label>
                    <Select value={newUc.concessionaria_id} onValueChange={setUc("concessionaria_id")}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {concessionarias.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome} {c.estado ? `(${c.estado})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">E-mail da fatura</Label>
                    <EmailInput value={newUc.email_fatura || ""} onChange={setUc("email_fatura")} placeholder="Opcional" />
                  </div>
                </div>
              </div>
            ) : (
              /* Select existing UC */
              <div className="space-y-1.5">
                <Label className="text-xs">UC Beneficiária <span className="text-destructive">*</span></Label>
                <Select value={form.uc_beneficiaria_id} onValueChange={set("uc_beneficiaria_id")}>
                  <SelectTrigger><SelectValue placeholder="Selecione a UC..." /></SelectTrigger>
                  <SelectContent>
                    {availableUcs.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.codigo_uc} — {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Percentual de Compensação (%) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={form.allocation_percent}
                onChange={(e) => set("allocation_percent")(e.target.value)}
                placeholder="Ex: 20.00"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Vigência Início</Label>
                <DateInput value={form.start_date} onChange={set("start_date")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vigência Fim</Label>
                <DateInput value={form.end_date} onChange={set("end_date")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={2} placeholder="Notas opcionais..." />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveBen.isPending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saveBen.isPending}>
            {saveBen.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saveBen.isPending ? "Adicionando..." : effectiveCreateNew ? "Criar UC e Vincular" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
