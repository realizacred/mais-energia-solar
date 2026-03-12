/**
 * MeterLinkDialog — Link a meter to a UC (or switch linkage).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { meterService, type MeterDevice } from "@/services/meterService";
import { supabase } from "@/integrations/supabase/client";
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

  const { data: ucs = [] } = useQuery({
    queryKey: ["ucs_for_link", search],
    queryFn: async () => {
      let q = supabase.from("units_consumidoras").select("id, nome, codigo_uc").eq("is_archived", false).order("nome").limit(20);
      if (search) q = q.or(`nome.ilike.%${search}%,codigo_uc.ilike.%${search}%`);
      const { data } = await q;
      return data || [];
    },
  });

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
              ucs.map(uc => (
                <button
                  key={uc.id}
                  type="button"
                  onClick={() => setSelectedUC(uc.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm border-b last:border-b-0 transition-colors ${
                    selectedUC === uc.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                  }`}
                >
                  <span className="font-medium">{uc.nome}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">{uc.codigo_uc}</span>
                </button>
              ))
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
