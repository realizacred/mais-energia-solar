/**
 * GdGroupFormModal — Create/Edit GD Group.
 * §25-S1: w-[90vw] mandatory.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sun, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSaveGdGroup, type GdGroup } from "@/hooks/useGdGroups";
import { useConcessionarias } from "@/hooks/useConcessionarias";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editingGroup: GdGroup | null;
}

export function GdGroupFormModal({ open, onOpenChange, editingGroup }: Props) {
  const { toast } = useToast();
  const saveGd = useSaveGdGroup();
  const { data: concessionarias = [] } = useConcessionarias();

  const { data: ucsGeradoras = [] } = useQuery({
    queryKey: ["ucs_geradoras_select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc, tipo_uc, concessionaria_id")
        .eq("is_archived", false)
        .in("tipo_uc", ["gd_geradora"] as any)
        .order("nome");
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes_for_gd_form"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const [form, setForm] = useState({
    nome: "", concessionaria_id: "", uc_geradora_id: "", cliente_id: "", notes: "", status: "active",
  });

  useEffect(() => {
    if (!open) return;
    if (editingGroup) {
      setForm({
        nome: editingGroup.nome,
        concessionaria_id: editingGroup.concessionaria_id,
        uc_geradora_id: editingGroup.uc_geradora_id,
        cliente_id: editingGroup.cliente_id || "",
        notes: editingGroup.notes || "",
        status: editingGroup.status,
      });
    } else {
      setForm({ nome: "", concessionaria_id: "", uc_geradora_id: "", cliente_id: "", notes: "", status: "active" });
    }
  }, [editingGroup, open]);

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.nome.trim()) {
      toast({ title: "Nome do grupo é obrigatório", variant: "destructive" });
      return;
    }
    if (!form.concessionaria_id) {
      toast({ title: "Selecione a concessionária", variant: "destructive" });
      return;
    }
    if (!form.uc_geradora_id) {
      toast({ title: "Selecione a UC geradora", variant: "destructive" });
      return;
    }

    try {
      await saveGd.mutateAsync({
        ...(editingGroup ? { id: editingGroup.id } : {}),
        nome: form.nome.trim(),
        concessionaria_id: form.concessionaria_id,
        uc_geradora_id: form.uc_geradora_id,
        cliente_id: form.cliente_id || null,
        notes: form.notes || null,
        status: form.status,
      });
      toast({ title: editingGroup ? "Grupo atualizado" : "Grupo criado com sucesso" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sun className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {editingGroup ? "Editar Grupo GD" : "Novo Grupo GD"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure a UC geradora e vincule ao cliente e concessionária
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Grupo <span className="text-destructive">*</span></Label>
              <Input value={form.nome} onChange={(e) => set("nome")(e.target.value)} placeholder="Ex: GD Residencial Centro" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Concessionária <span className="text-destructive">*</span></Label>
                <Select value={form.concessionaria_id} onValueChange={set("concessionaria_id")}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {concessionarias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome} {c.estado ? `(${c.estado})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">UC Geradora <span className="text-destructive">*</span></Label>
                <Select value={form.uc_geradora_id} onValueChange={set("uc_geradora_id")}>
                  <SelectTrigger><SelectValue placeholder="Selecione UC geradora..." /></SelectTrigger>
                  <SelectContent>
                    {ucsGeradoras.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.codigo_uc} — {u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente</Label>
                <Select value={form.cliente_id} onValueChange={set("cliente_id")}>
                  <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={set("status")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={3} placeholder="Notas sobre este grupo..." />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveGd.isPending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saveGd.isPending}>
            {saveGd.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saveGd.isPending ? "Salvando..." : editingGroup ? "Salvar" : "Criar Grupo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
