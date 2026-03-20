/**
 * UCPlantLinksTab — Manage links between UC and Plants (usinas).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { Link2, Plus, Trash2, Sun, ArrowRight, Zap, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface Props {
  unitId: string;
  ucTipo: string;
}

interface PlantLink {
  id: string;
  unit_id: string;
  plant_id: string;
  relation_type: string;
  allocation_percent: number | null;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
}

const RELATION_LABELS: Record<string, string> = {
  geradora: "Geradora",
  beneficiaria: "Beneficiária",
  compensacao: "Compensação",
};

export function UCPlantLinksTab({ unitId, ucTipo }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ plant_id: "", relation_type: "beneficiaria", allocation_percent: "" });

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["unit_plant_links", unitId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("unit_plant_links")
        .select("id, unit_id, plant_id, relation_type, allocation_percent, is_active, started_at, ended_at")
        .eq("unit_id", unitId)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PlantLink[];
    },
  });

  // Get monitoring plants as the "usinas" source
  const { data: plants = [] } = useQuery({
    queryKey: ["plants_for_uc_link"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("monitor_plants")
        .select("id, name, installed_power_kwp, status, last_communication_at, lat, lng")
        .order("name")
        .limit(100);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch today's generation for linked plants
  const activePlantIds = links.filter(l => l.is_active).map(l => l.plant_id);
  const { data: todayMetrics = [] } = useQuery({
    queryKey: ["plant_today_metrics_uc", activePlantIds],
    queryFn: async () => {
      if (activePlantIds.length === 0) return [];
      // Get legacy_plant_id mapping
      const { data: plantRows } = await (supabase as any)
        .from("monitor_plants")
        .select("id, legacy_plant_id")
        .in("id", activePlantIds);
      const legacyIds = (plantRows || []).map((p: any) => p.legacy_plant_id).filter(Boolean);
      if (legacyIds.length === 0) return [];
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("solar_plant_metrics_daily")
        .select("plant_id, energy_kwh, date")
        .in("plant_id", legacyIds)
        .eq("date", today);
      // Map back to monitor_plants.id
      return (data || []).map((m: any) => {
        const mp = (plantRows || []).find((p: any) => p.legacy_plant_id === m.plant_id);
        return { ...m, monitor_plant_id: mp?.id };
      });
    },
    enabled: activePlantIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.plant_id) throw new Error("Selecione uma usina");
      const { error } = await (supabase as any)
        .from("unit_plant_links")
        .insert({
          unit_id: unitId,
          plant_id: form.plant_id,
          relation_type: form.relation_type,
          allocation_percent: form.allocation_percent ? parseFloat(form.allocation_percent) : null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unit_plant_links", unitId] });
      setDialogOpen(false);
      toast({ title: "Vínculo criado" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message, variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await (supabase as any)
        .from("unit_plant_links")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unit_plant_links", unitId] });
      toast({ title: "Vínculo removido" });
    },
  });

  const activeLinks = links.filter(l => l.is_active);
  const inactiveLinks = links.filter(l => !l.is_active);

  // Default relation type based on UC type
  const defaultRelation = ucTipo === "gd_geradora" ? "geradora" : "beneficiaria";

  if (isLoading) return <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Vínculos com Usinas</h3>
        <Button size="sm" onClick={() => { setForm({ plant_id: "", relation_type: defaultRelation, allocation_percent: "" }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Vincular Usina
        </Button>
      </div>

      {activeLinks.length === 0 ? (
        <EmptyState
          icon={Sun}
          title="Nenhuma usina vinculada"
          description={ucTipo === "gd_geradora"
            ? "Esta UC é do tipo GD Geradora. Vincule à usina correspondente."
            : "Vincule esta UC a uma usina geradora para controle de compensação."
          }
          action={{ label: "Vincular Usina", onClick: () => { setForm({ plant_id: "", relation_type: defaultRelation, allocation_percent: "" }); setDialogOpen(true); }, icon: Link2 }}
        />
      ) : (
        <div className="space-y-3">
          {activeLinks.map(link => {
            const plant = plants.find((p: any) => p.id === link.plant_id);
            const todayGen = todayMetrics.find((m: any) => m.monitor_plant_id === link.plant_id);
            const isOnline = plant?.status === "online";
            return (
              <Card key={link.id} className="border-l-[3px] border-l-warning">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                        <Sun className="h-5 w-5 text-warning" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{plant?.name || link.plant_id.slice(0, 8) + "..."}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs">{RELATION_LABELS[link.relation_type] || link.relation_type}</Badge>
                          <Badge variant="outline" className={`text-xs ${isOnline ? "border-success text-success" : "border-destructive text-destructive"}`}>
                            {isOnline ? "Online" : "Offline"}
                          </Badge>
                          {link.allocation_percent != null && (
                            <span className="text-xs text-muted-foreground">Rateio: {link.allocation_percent}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMut.mutate(link.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Capacidade</p>
                      <p className="font-medium">{plant?.installed_power_kwp ? `${plant.installed_power_kwp} kWp` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Geração hoje</p>
                      <p className="font-medium text-warning">
                        {todayGen ? `${Number(todayGen.energy_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kWh` : "0,0 kWh"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Última comunicação</p>
                      <p className="font-mono text-xs">
                        {plant?.last_communication_at ? format(new Date(plant.last_communication_at), "dd/MM HH:mm") : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vinculada em</p>
                      <p className="font-mono text-xs">{format(new Date(link.started_at), "dd/MM/yyyy")}</p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1"
                    onClick={() => navigate(`/admin/monitoramento/usinas/${link.plant_id}`)}
                  >
                    Ver detalhes da usina <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {inactiveLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Histórico de vínculos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {inactiveLinks.map(link => (
              <div key={link.id} className="flex items-center justify-between text-xs text-muted-foreground border-b pb-1.5">
                <span>{RELATION_LABELS[link.relation_type] || link.relation_type}</span>
                <span>{new Date(link.started_at).toLocaleDateString("pt-BR")} → {link.ended_at ? new Date(link.ended_at).toLocaleDateString("pt-BR") : "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader><DialogTitle>Vincular Usina</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Usina</Label>
              {plants.length > 0 ? (
                <Select value={form.plant_id} onValueChange={(v) => setForm(f => ({ ...f, plant_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {plants.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground py-2">Nenhuma usina cadastrada no monitoramento. Cadastre uma usina primeiro.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Relação</Label>
              <Select value={form.relation_type} onValueChange={(v) => setForm(f => ({ ...f, relation_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="geradora">Geradora</SelectItem>
                  <SelectItem value="beneficiaria">Beneficiária</SelectItem>
                  <SelectItem value="compensacao">Compensação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Percentual de rateio (%)</Label>
              <Input type="number" min={0} max={100} step="0.01" value={form.allocation_percent} onChange={(e) => setForm(f => ({ ...f, allocation_percent: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button variant="default" onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.plant_id}>
              {createMut.isPending ? "Vinculando..." : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
