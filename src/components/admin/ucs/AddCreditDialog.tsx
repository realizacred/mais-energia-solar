/**
 * AddCreditDialog — Modal to manually add GD credits to a UC.
 * §25-S1: Modal template. RB-07: w-[90vw].
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateUnitCredit, type CreateCreditPayload } from "@/hooks/useUnitCredits";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  tenantId: string;
}

const POSTOS_TARIFARIOS = [
  { value: "fora_ponta", label: "Fora Ponta" },
  { value: "ponta", label: "Ponta" },
  { value: "intermediario", label: "Intermediário" },
];

export function AddCreditDialog({ open, onOpenChange, unitId, tenantId }: Props) {
  const { toast } = useToast();
  const createCredit = useCreateUnitCredit();

  const [quantidade, setQuantidade] = useState("");
  const [dataVigencia, setDataVigencia] = useState("");
  const [postoTarifario, setPostoTarifario] = useState("fora_ponta");
  const [plantId, setPlantId] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState("");

  // Fetch linked plants for "Usina de origem" dropdown
  const { data: linkedPlants } = useQuery({
    queryKey: ["uc_plant_links_for_credit", unitId],
    queryFn: async () => {
      const { data: links, error: linksErr } = await supabase
        .from("unit_plant_links")
        .select("plant_id")
        .eq("unit_id", unitId)
        .eq("is_active", true);
      if (linksErr) throw linksErr;
      if (!links?.length) return [];
      const plantIds = links.map((l) => l.plant_id);
      const { data: plants, error: plantsErr } = await supabase
        .from("monitor_plants")
        .select("id, name")
        .in("id", plantIds);
      if (plantsErr) throw plantsErr;
      return (plants ?? []) as Array<{ id: string; name: string }>;
    },
    staleTime: 1000 * 60 * 5,
    enabled: open && !!unitId,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setQuantidade("");
      setDataVigencia("");
      setPostoTarifario("fora_ponta");
      setPlantId(null);
      setObservacoes("");
    }
  }, [open]);

  const handleSave = async () => {
    const qty = parseFloat(quantidade);
    if (!qty || qty <= 0) {
      toast({ title: "Quantidade inválida", description: "Informe um valor em kWh maior que zero.", variant: "destructive" });
      return;
    }
    if (!dataVigencia) {
      toast({ title: "Data obrigatória", description: "Informe a data de vigência.", variant: "destructive" });
      return;
    }

    const payload: CreateCreditPayload = {
      unit_id: unitId,
      tenant_id: tenantId,
      plant_id: plantId,
      quantidade_kwh: qty,
      data_vigencia: `${dataVigencia}-01`, // Input is YYYY-MM, store as first of month
      posto_tarifario: postoTarifario,
      observacoes: observacoes.trim() || null,
    };

    try {
      await createCredit.mutateAsync(payload);
      toast({ title: "Crédito adicionado com sucesso" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao adicionar crédito", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* RB-07: w-[90vw] obrigatório */}
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Adicionar Crédito
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Adicione créditos GD manualmente à unidade consumidora
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            {/* Quantidade */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Quantidade (kWh) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 300"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>

            {/* Data de vigência + Posto tarifário */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Data de vigência <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="month"
                  value={dataVigencia}
                  onChange={(e) => setDataVigencia(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Posto tarifário <span className="text-destructive">*</span>
                </Label>
                <Select value={postoTarifario} onValueChange={setPostoTarifario}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSTOS_TARIFARIOS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Usina de origem */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Usina de origem</Label>
              <Select value={plantId ?? "__none__"} onValueChange={(v) => setPlantId(v === "__none__" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {linkedPlants?.map((lp) => (
                    <SelectItem key={lp.plant_id} value={lp.plant_id}>
                      {lp.monitor_plants?.name || lp.plant_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Observações (opcional)</Label>
              <Textarea
                placeholder="Ex: crédito de mês anterior"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createCredit.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={createCredit.isPending}>
            {createCredit.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
