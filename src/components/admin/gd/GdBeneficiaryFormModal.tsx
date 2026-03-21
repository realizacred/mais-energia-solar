/**
 * GdBeneficiaryFormModal — Add beneficiary UC to a GD Group.
 * §25-S1: w-[90vw] mandatory.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSaveGdBeneficiary, type GdBeneficiary } from "@/hooks/useGdBeneficiaries";
import { gdService } from "@/services/gdService";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  existingBeneficiaries: GdBeneficiary[];
}

export function GdBeneficiaryFormModal({ open, onOpenChange, groupId, existingBeneficiaries }: Props) {
  const { toast } = useToast();
  const saveBen = useSaveGdBeneficiary();

  const { data: ucs = [] } = useQuery({
    queryKey: ["ucs_for_ben_select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc")
        .eq("is_archived", false)
        .order("nome");
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const [form, setForm] = useState({
    uc_beneficiaria_id: "",
    allocation_percent: "",
    start_date: "",
    end_date: "",
    notes: "",
  });

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.uc_beneficiaria_id) {
      toast({ title: "Selecione a UC beneficiária", variant: "destructive" });
      return;
    }

    const percent = parseFloat(form.allocation_percent);
    if (!gdService.isValidPercent(percent)) {
      toast({ title: "Percentual deve ser entre 0,01 e 100", variant: "destructive" });
      return;
    }

    if (gdService.hasDuplicateUC(existingBeneficiaries, form.uc_beneficiaria_id)) {
      toast({ title: "Esta UC já está vinculada como beneficiária neste grupo", variant: "destructive" });
      return;
    }

    try {
      await saveBen.mutateAsync({
        gd_group_id: groupId,
        uc_beneficiaria_id: form.uc_beneficiaria_id,
        allocation_percent: percent,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
        is_active: true,
      });
      toast({ title: "Beneficiária adicionada" });
      setForm({ uc_beneficiaria_id: "", allocation_percent: "", start_date: "", end_date: "", notes: "" });
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
              Vincule uma UC existente como beneficiária de créditos
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">UC Beneficiária <span className="text-destructive">*</span></Label>
              <Select value={form.uc_beneficiaria_id} onValueChange={set("uc_beneficiaria_id")}>
                <SelectTrigger><SelectValue placeholder="Selecione a UC..." /></SelectTrigger>
                <SelectContent>
                  {ucs.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.codigo_uc} — {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                <Input type="date" value={form.start_date} onChange={(e) => set("start_date")(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vigência Fim</Label>
                <Input type="date" value={form.end_date} onChange={(e) => set("end_date")(e.target.value)} />
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
            {saveBen.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
