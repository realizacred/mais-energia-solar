/**
 * MeterLinkDialog — Link a meter to a UC (or switch linkage).
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { meterService, type MeterDevice } from "@/services/meterService";
import { useUnitsConsumidorasForLink, useActiveUnitMeterLinks } from "@/hooks/useUnitsConsumidoras";
import { Search, Zap } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  meter: MeterDevice;
}

export function MeterLinkDialog({ open, onOpenChange, meter }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUC, setSelectedUC] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: ucs = [] } = useUnitsConsumidorasForLink(search);
  const { data: linkedMeterIds = [] } = useActiveUnitMeterLinks();

  const linkedUCSet = new Set(linkedMeterIds);

  async function handleLink() {
    if (!selectedUC) return;
    setSaving(true);
    try {
      await meterService.linkToUnit(selectedUC, meter.id, "principal");
      toast({ title: "Medidor vinculado com sucesso" });
      qc.invalidateQueries({ queryKey: ["meter_devices"] });
      qc.invalidateQueries({ queryKey: ["unit_meter_links"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Vincular Medidor</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Vincule "{meter.name}" a uma Unidade Consumidora</p>
          </div>
        </DialogHeader>
        <div className="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar UC por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="max-h-[240px] overflow-y-auto border rounded-lg">
            {ucs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma UC encontrada</p>
            ) : (
              ucs.map(uc => {
                const hasLinkedMeter = linkedUCSet.has(uc.id);
                return (
                  <Button
                    key={uc.id}
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedUC(uc.id)}
                    className={`w-full justify-start text-left h-auto px-3 py-2.5 text-sm rounded-none border-b last:border-b-0 ${
                      selectedUC === uc.id ? "bg-primary/10 text-primary font-medium" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="font-medium">{uc.nome}</span>
                      <span className="text-xs text-muted-foreground font-mono">{uc.codigo_uc}</span>
                      {hasLinkedMeter && (
                        <span className="text-xs bg-warning/10 text-warning border border-warning/20 px-1.5 py-0.5 rounded ml-auto shrink-0">
                          Já tem medidor
                        </span>
                      )}
                    </div>
                  </Button>
                );
              })
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="default" onClick={handleLink} disabled={!selectedUC || saving}>
            <Zap className="w-4 h-4 mr-1" />
            {saving ? "Vinculando..." : "Vincular"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
