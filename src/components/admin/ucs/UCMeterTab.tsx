/**
 * UCMeterTab — Shows linked meter and allows linking/unlinking.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { meterService } from "@/services/meterService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Gauge, Link2, Link2Off, ArrowLeftRight, History } from "lucide-react";
import { MeterLinkDialog } from "../meters/MeterLinkDialog";
import { useState } from "react";

interface Props {
  unitId: string;
}

export function UCMeterTab({ unitId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["unit_meter_links", unitId],
    queryFn: () => meterService.getLinksForUnit(unitId),
  });

  const activeLink = links.find(l => l.is_active);
  const historyLinks = links.filter(l => !l.is_active);

  const { data: activeMeter } = useQuery({
    queryKey: ["meter_device", activeLink?.meter_device_id],
    queryFn: () => meterService.getById(activeLink!.meter_device_id),
    enabled: !!activeLink,
  });

  const { data: latestStatus } = useQuery({
    queryKey: ["meter_status_latest", activeLink?.meter_device_id],
    queryFn: () => meterService.getStatusLatest(activeLink!.meter_device_id),
    enabled: !!activeLink,
  });

  const unlinkMut = useMutation({
    mutationFn: (linkId: string) => meterService.unlinkFromUnit(linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unit_meter_links", unitId] });
      toast({ title: "Medidor desvinculado" });
    },
  });

  if (isLoading) return <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      {activeMeter ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Gauge className="w-4 h-4" /> Medidor Vinculado</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(true)}>
                  <ArrowLeftRight className="w-3 h-3 mr-1" /> Trocar
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => activeLink && unlinkMut.mutate(activeLink.id)}>
                  <Link2Off className="w-3 h-3 mr-1" /> Desvincular
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Nome</p>
                <p className="text-sm font-medium">{activeMeter.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Modelo</p>
                <p className="text-sm">{activeMeter.model || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Provider</p>
                <Badge variant="outline" className="text-xs capitalize">{activeMeter.provider}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge variant={activeMeter.online_status === "online" ? "success" : "destructive"} dot>
                  {activeMeter.online_status === "online" ? "Online" : "Offline"}
                </StatusBadge>
              </div>
              {activeMeter.bidirectional_supported && (
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <Badge variant="outline" className="text-xs"><ArrowLeftRight className="w-3 h-3 mr-0.5" /> Bidirecional</Badge>
                </div>
              )}
              {latestStatus && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Potência</p>
                    <p className="text-sm font-medium">{latestStatus.power_w != null ? `${latestStatus.power_w} W` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Energia Importada</p>
                    <p className="text-sm">{latestStatus.energy_import_kwh != null ? `${latestStatus.energy_import_kwh} kWh` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Energia Exportada</p>
                    <p className="text-sm">{latestStatus.energy_export_kwh != null ? `${latestStatus.energy_export_kwh} kWh` : "—"}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Gauge}
          title="Nenhum medidor vinculado"
          description="Vincule um medidor IoT para acompanhar consumo e geração em tempo real."
          action={{ label: "Vincular Medidor", onClick: () => setLinkDialogOpen(true), icon: Link2 }}
        />
      )}

      {historyLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4" /> Histórico de Vínculos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {historyLinks.map(link => (
                <div key={link.id} className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
                  <span className="font-mono">{link.meter_device_id.slice(0, 8)}...</span>
                  <span>{new Date(link.started_at).toLocaleDateString("pt-BR")} → {link.ended_at ? new Date(link.ended_at).toLocaleDateString("pt-BR") : "—"}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {linkDialogOpen && activeMeter && (
        <MeterLinkDialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen} meter={activeMeter} />
      )}
    </div>
  );
}
