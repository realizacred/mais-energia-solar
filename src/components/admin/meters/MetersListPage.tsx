/**
 * MetersListPage — Card-based list for Medidores with KPIs.
 */
import { useState, useMemo } from "react";
import { type MeterDevice } from "@/services/meterService";
import { useMetersListData } from "@/hooks/useMetersListData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { Search, Gauge, Wifi, WifiOff, Zap, BarChart3, Activity, AlertTriangle, ArrowRight, Link2 } from "lucide-react";
import { MeterLinkDialog } from "./MeterLinkDialog";

export default function MetersListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [linkDialogMeter, setLinkDialogMeter] = useState<MeterDevice | null>(null);

  const { meters, isLoading, error, getLinkedUC } = useMetersListData({
    online_status: statusFilter,
    search,
  });

  // Get latest status for all meters
  const meterIds = meters.map(m => m.id);
  const { data: statusMap = {} } = useQuery({
    queryKey: ["meter_status_latest_all", meterIds.join(",")],
    queryFn: async () => {
      if (!meterIds.length) return {};
      const { data } = await supabase
        .from("meter_status_latest")
        .select("meter_device_id, power_w, voltage_v, current_a, energy_import_kwh")
        .in("meter_device_id", meterIds);
      const map: Record<string, any> = {};
      for (const s of data || []) map[s.meter_device_id] = s;
      return map;
    },
    staleTime: 1000 * 60,
    enabled: meterIds.length > 0,
  });

  const kpis = useMemo(() => {
    const total = meters.length;
    const online = meters.filter(m => m.online_status === "online").length;
    const offline = meters.filter(m => m.online_status === "offline").length;
    const totalEnergy = Object.values(statusMap).reduce((sum: number, s: any) => sum + (s?.energy_import_kwh || 0), 0);
    return { total, online, offline, totalEnergy };
  }, [meters, statusMap]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        icon={Gauge}
        title="Medidores"
        description="Dispositivos de medição IoT sincronizados via API"
      />

      {/* KPI Cards §27 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Gauge} label="Total Medidores" value={kpis.total} color="primary" />
        <StatCard icon={Wifi} label="Online" value={kpis.online} color="success" />
        <StatCard icon={WifiOff} label="Offline" value={kpis.offline} color="destructive" />
        <StatCard icon={BarChart3} label="Energia Total (kWh)" value={kpis.totalEnergy.toFixed(2)} color="info" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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
          </SelectContent>
        </Select>
      </div>

      {/* Loading / Error / Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {meters.map((m) => {
            const linkedUC = getLinkedUC(m.id);
            const status = statusMap[m.id];
            const power = status?.power_w ?? null;
            const voltage = status?.voltage_v ?? null;
            const current = status?.current_a ?? null;
            const energy = status?.energy_import_kwh ?? null;
            // Progress: assume max 10kW nominal
            const powerPercent = power != null ? Math.min((power / 10000) * 100, 100) : 0;

            return (
              <Card
                key={m.id}
                className="bg-card border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => navigate(`/admin/medidores/${m.id}`)}
              >
                <CardContent className="p-5 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                        <Gauge className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{m.external_device_id}</p>
                      </div>
                    </div>
                    <StatusBadge variant={m.online_status === "online" ? "success" : "destructive"} dot>
                      {m.online_status === "online" ? "On" : "Off"}
                    </StatusBadge>
                  </div>

                  {/* Power highlight */}
                  <div className="text-center py-2">
                    <p className="text-3xl font-bold tracking-tight text-foreground">
                      {power != null ? (power >= 1000 ? `${(power / 1000).toFixed(2)} kW` : `${power} W`) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Potência atual</p>
                  </div>

                  {/* Power bar */}
                  {power != null && (
                    <Progress value={powerPercent} className="h-1.5" />
                  )}

                  {/* Secondary metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs font-mono text-foreground">{voltage != null ? `${voltage.toFixed(1)}V` : "—"}</p>
                      <p className="text-[10px] text-muted-foreground">Tensão</p>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-foreground">{current != null ? `${current.toFixed(2)}A` : "—"}</p>
                      <p className="text-[10px] text-muted-foreground">Corrente</p>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-foreground">{energy != null ? `${energy.toFixed(1)}` : "—"}</p>
                      <p className="text-[10px] text-muted-foreground">kWh</p>
                    </div>
                  </div>

                  {/* UC linked + action */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    {linkedUC ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                        <Link2 className="w-3 h-3 shrink-0" />
                        <span className="truncate">{linkedUC.nome}</span>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={(e) => { e.stopPropagation(); setLinkDialogMeter(m); }}
                      >
                        Vincular UC
                      </Button>
                    )}
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
