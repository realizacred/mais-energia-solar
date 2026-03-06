/**
 * MetersListPage — Main list page for Medidores.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { meterService, type MeterDevice } from "@/services/meterService";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Search, Gauge, Wifi, WifiOff, ArrowLeftRight, Eye, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MeterLinkDialog } from "./MeterLinkDialog";

export default function MetersListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [linkDialogMeter, setLinkDialogMeter] = useState<MeterDevice | null>(null);

  const { data: meters = [], isLoading, error } = useQuery({
    queryKey: ["meter_devices", statusFilter, search],
    queryFn: () => meterService.list({
      online_status: statusFilter !== "all" ? statusFilter : undefined,
      search: search || undefined,
    }),
  });

  // Get active links to show which UC each meter is connected to
  const { data: activeLinks = [] } = useQuery({
    queryKey: ["unit_meter_links_active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("unit_meter_links")
        .select("meter_device_id, unit_id")
        .eq("is_active", true);
      return data || [];
    },
  });

  const { data: ucs = [] } = useQuery({
    queryKey: ["ucs_for_meters"],
    queryFn: async () => {
      const { data } = await supabase.from("units_consumidoras").select("id, nome, codigo_uc").eq("is_archived", false);
      return data || [];
    },
  });

  const linkMap = new Map(activeLinks.map(l => [l.meter_device_id, l.unit_id]));
  const ucMap = new Map(ucs.map(u => [u.id, u]));

  function getLinkedUC(meterId: string) {
    const unitId = linkMap.get(meterId);
    if (!unitId) return null;
    return ucMap.get(unitId) || null;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Medidores"
        description="Dispositivos de medição IoT sincronizados via API"
      />

      <SectionCard>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou device ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="unknown">Desconhecido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Erro ao carregar" description={String(error)} />
        ) : meters.length === 0 ? (
          <EmptyState
            icon={Gauge}
            title="Nenhum medidor encontrado"
            description="Medidores serão importados automaticamente ao configurar uma integração de API (ex: Tuya) em Integrações > APIs."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>UC Vinculada</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Leitura</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meters.map((m) => {
                  const linkedUC = getLinkedUC(m.id);
                  return (
                    <TableRow key={m.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/medidores/${m.id}`)}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.model || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{m.provider}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">{m.external_device_id}</TableCell>
                      <TableCell>
                        {linkedUC ? (
                          <span className="text-xs font-medium text-primary">{linkedUC.nome}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Não vinculado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {m.bidirectional_supported && (
                            <Badge variant="outline" className="text-xs"><ArrowLeftRight className="w-3 h-3 mr-0.5" />Bidirecional</Badge>
                          )}
                          {!m.bidirectional_supported && (
                            <Badge variant="outline" className="text-xs">Unidirecional</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={m.online_status === "online" ? "success" : m.online_status === "offline" ? "destructive" : "muted"} dot>
                          {m.online_status === "online" ? "Online" : m.online_status === "offline" ? "Offline" : "—"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.last_reading_at ? new Date(m.last_reading_at).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setLinkDialogMeter(m)}>
                            {linkedUC ? "Trocar UC" : "Vincular UC"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {linkDialogMeter && (
        <MeterLinkDialog
          open={!!linkDialogMeter}
          onOpenChange={() => setLinkDialogMeter(null)}
          meter={linkDialogMeter}
        />
      )}
    </div>
  );
}
