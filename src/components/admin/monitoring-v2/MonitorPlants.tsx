import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sun, Search, MapPin, List, Zap } from "lucide-react";
import { listPlantsWithHealth } from "@/services/monitoring/monitorService";
import type { PlantWithHealth, MonitorPlantStatus } from "@/services/monitoring/monitorTypes";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MonitorPlantsMap } from "./MonitorPlantsMap";

const STATUS_LABELS: Record<MonitorPlantStatus, string> = {
  online: "Online",
  alert: "Alerta",
  offline: "Offline",
  unknown: "Sem dados",
};

const FILTER_CHIPS: { key: MonitorPlantStatus | "all"; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "online", label: "Online" },
  { key: "alert", label: "Alerta" },
  { key: "offline", label: "Offline" },
  { key: "unknown", label: "Sem dados" },
];

export default function MonitorPlants() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MonitorPlantStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"split" | "list" | "map">("split");

  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["monitor-plants-health"],
    queryFn: listPlantsWithHealth,
  });

  const filtered = useMemo(() => {
    return plants.filter((p) => {
      const matchSearch =
        !search ||
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.city?.toLowerCase().includes(search.toLowerCase()) ||
        p.state?.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" || (p.health?.status || "unknown") === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [plants, search, statusFilter]);

  const plantsWithCoords = useMemo(
    () => filtered.filter((p) => p.lat != null && p.lng != null),
    [filtered]
  );

  if (isLoading) return <LoadingState message="Carregando usinas..." />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Usinas"
        description={`${plants.length} usinas cadastradas`}
        icon={Sun}
        actions={
          <div className="flex gap-1">
            <Button size="sm" variant={viewMode === "split" ? "default" : "outline"} onClick={() => setViewMode("split")}>
              <MapPin className="h-3.5 w-3.5 mr-1" />
              Split
            </Button>
            <Button size="sm" variant={viewMode === "list" ? "default" : "outline"} onClick={() => setViewMode("list")}>
              <List className="h-3.5 w-3.5 mr-1" />
              Lista
            </Button>
            <Button size="sm" variant={viewMode === "map" ? "default" : "outline"} onClick={() => setViewMode("map")}>
              <MapPin className="h-3.5 w-3.5 mr-1" />
              Mapa
            </Button>
          </div>
        }
      />

      {/* Search + filter chips */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usina, cidade, estado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTER_CHIPS.map((chip) => (
            <Button
              key={chip.key}
              size="sm"
              variant={statusFilter === chip.key ? "default" : "outline"}
              onClick={() => setStatusFilter(chip.key)}
              className="text-xs"
            >
              {chip.label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Sun}
          title="Nenhuma usina encontrada"
          description="Ajuste os filtros ou conecte um provedor para importar usinas."
        />
      ) : (
        <div className={viewMode === "split" ? "grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4" : ""}>
          {/* Plant list */}
          {(viewMode === "split" || viewMode === "list") && (
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filtered.map((plant) => (
                <PlantListItem
                  key={plant.id}
                  plant={plant}
                  onClick={() => navigate(`/admin/monitoramento/usinas/${plant.id}`)}
                />
              ))}
            </div>
          )}

          {/* Map */}
          {(viewMode === "split" || viewMode === "map") && plantsWithCoords.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden" style={{ minHeight: 400 }}>
              <MonitorPlantsMap
                plants={plantsWithCoords}
                onSelectPlant={(id) => navigate(`/admin/monitoramento/usinas/${id}`)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlantListItem({ plant, onClick }: { plant: PlantWithHealth; onClick: () => void }) {
  const status = plant.health?.status || "unknown";

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors space-y-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground truncate">{plant.name}</span>
        <StatusBadge status={STATUS_LABELS[status]} size="sm" />
      </div>
      <div className="flex items-center gap-3 text-2xs text-muted-foreground">
        {plant.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {plant.city}/{plant.state}
          </span>
        )}
        {plant.installed_power_kwp && (
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {plant.installed_power_kwp} kWp
          </span>
        )}
      </div>
      {plant.health && (
        <div className="flex items-center gap-4 text-2xs text-muted-foreground">
          <span>Hoje: {plant.health.energy_today_kwh.toFixed(0)} kWh</span>
          {plant.health.last_seen_at && (
            <span>
              Visto {formatDistanceToNow(new Date(plant.health.last_seen_at), { addSuffix: true, locale: ptBR })}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
