/**
 * PlantResizingDialog — Modal for adding a new plant resizing/expansion entry.
 * §25: Modal pattern w-[90vw]. §22: Button variants. §13: Inputs.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Maximize2 } from "lucide-react";
import { useCreatePlantResizing, type ResizingPayload } from "@/hooks/usePlantResizingHistory";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantId: string;
  tenantId: string;
}

export function PlantResizingDialog({ open, onOpenChange, plantId, tenantId }: Props) {
  const create = useCreatePlantResizing();
  const [form, setForm] = useState({
    potencia_kwp: "",
    data_ampliacao: "",
    valor_investido_total: "",
    geracao_anual_prevista_kwh: "",
    geracao_anual_acordada_kwh: "",
    comentario: "",
  });

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async () => {
    if (!form.potencia_kwp || !form.data_ampliacao) {
      toast.error("Potência e Data da Ampliação são obrigatórios.");
      return;
    }
    const payload: ResizingPayload = {
      plant_id: plantId,
      tenant_id: tenantId,
      potencia_kwp: parseFloat(form.potencia_kwp),
      data_ampliacao: form.data_ampliacao,
      valor_investido_total: form.valor_investido_total ? parseFloat(form.valor_investido_total) : null,
      geracao_anual_prevista_kwh: form.geracao_anual_prevista_kwh ? parseFloat(form.geracao_anual_prevista_kwh) : null,
      geracao_anual_acordada_kwh: form.geracao_anual_acordada_kwh ? parseFloat(form.geracao_anual_acordada_kwh) : null,
      comentario: form.comentario || null,
    };
    try {
      await create.mutateAsync(payload);
      toast.success("Redimensionamento registrado com sucesso!");
      setForm({ potencia_kwp: "", data_ampliacao: "", valor_investido_total: "", geracao_anual_prevista_kwh: "", geracao_anual_acordada_kwh: "", comentario: "" });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Maximize2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Redimensionamento de Usina
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Registre a ampliação somando os valores antigos + novos
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Potência Total (kWp) *</Label>
                <Input type="number" step="0.001" value={form.potencia_kwp} onChange={(e) => set("potencia_kwp", e.target.value)} placeholder="Ex: 130,139" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Data da Ampliação *</Label>
                <DateInput value={form.data_ampliacao} onChange={(v) => set("data_ampliacao", v)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Valor Investido Total (R$)</Label>
                <CurrencyInput value={Number(form.valor_investido_total) || 0} onChange={(v) => set("valor_investido_total", String(v))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Geração Anual Prevista (kWh)</Label>
                <Input type="number" step="0.01" value={form.geracao_anual_prevista_kwh} onChange={(e) => set("geracao_anual_prevista_kwh", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">Geração Anual Acordada Na Venda (kWh)</Label>
                <Input type="number" step="0.01" value={form.geracao_anual_acordada_kwh} onChange={(e) => set("geracao_anual_acordada_kwh", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Comentário (opcional)</Label>
              <Textarea rows={3} value={form.comentario} onChange={(e) => set("comentario", e.target.value)} placeholder="Motivo da ampliação..." />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "Salvando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
