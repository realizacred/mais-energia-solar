import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sun, Search, MapPin, List, Zap, Activity, Filter } from "lucide-react";
import { listPlantsWithHealth } from "@/services/monitoring/monitorService";
import type { PlantWithHealth, MonitorPlantStatus } from "@/services/monitoring/monitorTypes";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MonitorPlantsMap } from "./MonitorPlantsMap";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<MonitorPlantStatus, string> = {
  online: "Online",
  alert: "Alerta",
  offline: "Offline",
  unknown: "Sem dados",
};

const STATUS_DOT: Record<MonitorPlantStatus, string> = {
  online: "bg-success",
  alert: "bg-warning",
  offline: "bg-destructive",
  unknown: "bg-muted-foreground",
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
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get("status") || "all") as MonitorPlantStatus | "all";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MonitorPlantStatus | "all">(initialFilter);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"split" | "list" | "map">("split");

  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["monitor-plants-health"],
    queryFn: listPlantsWithHealth,
  });

  const brands = useMemo(() => {
    const set = new Set<string>();
    plants.forEach((p) => {
      if (p.provider_name) set.add(p.provider_name);
    });
    return Array.from(set).sort();
  }, [plants]);

  const filtered = useMemo(() => {
    return plants.filter((p) => {
      const matchSearch =
        !search ||
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.city?.toLowerCase().includes(search.toLowerCase()) ||
        p.state?.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" || (p.health?.status || "unknown") === statusFilter;
      const matchBrand =
        brandFilter === "all" || p.provider_name === brandFilter;
      return matchSearch && matchStatus && matchBrand;
    });
  }, [plants, search, statusFilter, brandFilter]);

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
          <div className="flex gap-1 p-0.5 rounded-lg bg-muted/50 border border-border/60">
            {([
              { mode: "split" as const, icon: MapPin, label: "Dividido" },
              { mode: "list" as const, icon: List, label: "Lista" },
              { mode: "map" as const, icon: MapPin, label: "Mapa" },
            ]).map(({ mode, icon: Icon, label }) => (
              <Button
                key={mode}
                size="sm"
                variant="ghost"
                onClick={() => setViewMode(mode)}
                className={cn(
                  "text-xs gap-1.5 h-7",
                  viewMode === mode && "bg-card shadow-sm text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
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
        {brands.length > 1 && (
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-auto min-w-[140px] h-9 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as marcas</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b} className="capitalize">
                  {b.charAt(0).toUpperCase() + b.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex gap-1 flex-wrap">
          {FILTER_CHIPS.map((chip) => (
            <Button
              key={chip.key}
              size="sm"
              variant="ghost"
              onClick={() => setStatusFilter(chip.key)}
              className={cn(
                "text-xs h-8 rounded-full border",
                statusFilter === chip.key
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              )}
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
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 scrollbar-thin">
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
            <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm" style={{ minHeight: 400 }}>
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
      className="w-full text-left p-3.5 rounded-xl border border-border/60 bg-card hover:shadow-md transition-all duration-200 space-y-2 group"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", STATUS_DOT[status])} />
          <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{plant.name}</span>
        </div>
        <StatusBadge status={STATUS_LABELS[status]} size="sm" />
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground pl-5">
        {plant.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {plant.city}/{plant.state}
          </span>
        )}
        {plant.provider_name && (
          <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
            {plant.provider_name}
          </span>
        )}
        {plant.installed_power_kwp && (
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 shrink-0" />
            {plant.installed_power_kwp} kWp
          </span>
        )}
      </div>
      {plant.health && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground pl-5">
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3 shrink-0" />
            Hoje: {plant.health.energy_today_kwh.toFixed(0)} kWh
          </span>
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
