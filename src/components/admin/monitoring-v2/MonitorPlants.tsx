import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Sun, Search, MapPin, List, Zap, Activity, Filter, AlertTriangle,
  WifiOff, Gauge, BatteryCharging, ArrowUpDown, Radio, Moon,
  SortAsc, ChevronRight,
} from "lucide-react";
import { listPlantsWithHealth } from "@/services/monitoring/monitorService";
import type { PlantWithHealth } from "@/services/monitoring/monitorTypes";
import type { PlantUiStatus } from "@/services/monitoring/plantStatusEngine";
import { UI_STATUS_LABELS, UI_STATUS_DOT, PLANT_FILTER_CHIPS } from "@/services/monitoring/plantStatusEngine";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MonitorPlantsMap } from "./MonitorPlantsMap";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Sort Options ─── */
type SortKey = "alert" | "energy" | "power" | "updated" | "name";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "alert", label: "Com alerta primeiro" },
  { key: "energy", label: "Maior geração hoje" },
  { key: "power", label: "Maior potência" },
  { key: "updated", label: "Última atualização" },
  { key: "name", label: "Ordem alfabética" },
];

function resolveUiStatus(plant: PlantWithHealth): PlantUiStatus {
  const raw = plant.health?.status;
  if (raw === "standby") return "standby";
  if (raw === "online") return "online";
  return "offline";
}

export default function MonitorPlants() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get("status") || "all") as PlantUiStatus | "all";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlantUiStatus | "all">(initialFilter);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"split" | "list" | "map">("split");
  const [sortBy, setSortBy] = useState<SortKey>("alert");
  const [monitoringMode, setMonitoringMode] = useState(false);

  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["monitor-plants-health"],
    queryFn: listPlantsWithHealth,
    refetchInterval: monitoringMode ? 30_000 : undefined,
  });

  const brands = useMemo(() => {
    const set = new Set<string>();
    plants.forEach((p) => { if (p.provider_name) set.add(p.provider_name); });
    return Array.from(set).sort();
  }, [plants]);

  const filtered = useMemo(() => {
    return plants
      .filter((p) => {
        const matchSearch = !search ||
          p.name?.toLowerCase().includes(search.toLowerCase()) ||
          p.city?.toLowerCase().includes(search.toLowerCase()) ||
          p.state?.toLowerCase().includes(search.toLowerCase());
        const plantStatus = resolveUiStatus(p);
        const matchStatus = statusFilter === "all" || plantStatus === statusFilter;
        const matchBrand = brandFilter === "all" || p.provider_name === brandFilter;
        return matchSearch && matchStatus && matchBrand;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "alert": {
            const aOff = resolveUiStatus(a) === "offline" ? 0 : resolveUiStatus(a) === "standby" ? 1 : 2;
            const bOff = resolveUiStatus(b) === "offline" ? 0 : resolveUiStatus(b) === "standby" ? 1 : 2;
            return aOff - bOff;
          }
          case "energy":
            return (b.health?.energy_today_kwh || 0) - (a.health?.energy_today_kwh || 0);
          case "power":
            return (b.installed_power_kwp || 0) - (a.installed_power_kwp || 0);
          case "updated":
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          case "name":
            return (a.name || "").localeCompare(b.name || "");
          default:
            return 0;
        }
      });
  }, [plants, search, statusFilter, brandFilter, sortBy]);

  const plantsWithCoords = useMemo(
    () => filtered.filter((p) => p.lat != null && p.lng != null),
    [filtered]
  );

  // ─── KPI Summary (reacts to filters) ───
  const kpiData = useMemo(() => {
    const online = filtered.filter((p) => resolveUiStatus(p) === "online").length;
    const standby = filtered.filter((p) => resolveUiStatus(p) === "standby").length;
    const offline = filtered.filter((p) => resolveUiStatus(p) === "offline").length;
    const totalPowerKwp = filtered.reduce((s, p) => s + (p.installed_power_kwp || 0), 0);
    const energyTodayKwh = filtered.reduce((s, p) => s + (p.health?.energy_today_kwh || 0), 0);
    return { total: filtered.length, online, standby, offline, totalPowerKwp, energyTodayKwh };
  }, [filtered]);

  const handleSelectPlant = useCallback((id: string) => {
    navigate(`/admin/monitoramento/usinas/${id}`);
  }, [navigate]);

  if (isLoading) return <LoadingState message="Carregando usinas..." />;

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <PageHeader
        title="Usinas"
        description={`${plants.length} usinas cadastradas`}
        icon={Sun}
        actions={
          <div className="flex items-center gap-2">
            {/* Monitoring mode toggle */}
            <Button
              size="sm"
              variant={monitoringMode ? "default" : "outline"}
              onClick={() => setMonitoringMode(!monitoringMode)}
              className={cn("text-xs gap-1.5 h-8", monitoringMode && "animate-pulse")}
            >
              <Radio className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{monitoringMode ? "Monitorando" : "Monitorar"}</span>
            </Button>
            {/* View mode toggle */}
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted/50 border border-border/60">
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
          </div>
        }
      />

      {/* ═══════════════════════════════════════════════
          📊 RESUMO OPERACIONAL (reacts to filters)
      ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <MiniKpi label="Total" value={kpiData.total} icon={Sun} />
        <MiniKpi label="Online" value={kpiData.online} icon={Activity} color="success" />
        <MiniKpi label="Standby" value={kpiData.standby} icon={Moon} color="warning" />
        <MiniKpi label="Offline" value={kpiData.offline} icon={WifiOff} color={kpiData.offline > 0 ? "destructive" : "muted"} />
        <MiniKpi
          label="Potência"
          value={kpiData.totalPowerKwp >= 1000
            ? `${(kpiData.totalPowerKwp / 1000).toFixed(1)} MWp`
            : `${kpiData.totalPowerKwp.toFixed(0)} kWp`
          }
          icon={Gauge}
        />
        <MiniKpi
          label="Energia Hoje"
          value={kpiData.energyTodayKwh >= 1000
            ? `${(kpiData.energyTodayKwh / 1000).toFixed(1)} MWh`
            : `${kpiData.energyTodayKwh.toFixed(0)} kWh`
          }
          icon={Zap}
          color="primary"
        />
      </div>

      {/* ═══════════════════════════════════════════════
          🔍 FILTROS + ORDENAÇÃO
      ═══════════════════════════════════════════════ */}
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
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-auto min-w-[180px] h-9 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 flex-wrap">
          {PLANT_FILTER_CHIPS.map((chip) => (
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

      {/* ═══════════════════════════════════════════════
          CONTENT: LIST + MAP
      ═══════════════════════════════════════════════ */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Sun}
          title="Nenhuma usina encontrada"
          description="Ajuste os filtros ou conecte um provedor para importar usinas."
        />
      ) : (
        <div className={viewMode === "split" ? "grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4" : ""}>
          {/* Plant list */}
          {(viewMode === "split" || viewMode === "list") && (
            <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto pr-1 scrollbar-thin">
              <AnimatePresence mode="popLayout">
                {filtered.map((plant, i) => (
                  <motion.div
                    key={plant.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                  >
                    <PlantOperationalCard
                      plant={plant}
                      onClick={() => handleSelectPlant(plant.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Map */}
          {(viewMode === "split" || viewMode === "map") && plantsWithCoords.length > 0 && (
            <div className="rounded-2xl border border-border/50 overflow-hidden shadow-sm" style={{ minHeight: 450 }}>
              <MonitorPlantsMap
                plants={plantsWithCoords}
                onSelectPlant={handleSelectPlant}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MINI KPI CARD
═══════════════════════════════════════════════════════════════ */

type KpiColor = "primary" | "success" | "warning" | "destructive" | "muted";

const KPI_COLORS: Record<KpiColor | "default", { iconBg: string; iconText: string }> = {
  primary:     { iconBg: "bg-primary/15",     iconText: "text-primary" },
  success:     { iconBg: "bg-success/15",     iconText: "text-success" },
  warning:     { iconBg: "bg-warning/15",     iconText: "text-warning" },
  destructive: { iconBg: "bg-destructive/15", iconText: "text-destructive" },
  muted:       { iconBg: "bg-muted",          iconText: "text-muted-foreground" },
  default:     { iconBg: "bg-muted/60",       iconText: "text-foreground" },
};

function MiniKpi({ label, value, icon: Icon, color }: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: KpiColor;
}) {
  const c = KPI_COLORS[color || "default"];
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border/50 bg-card px-3 py-2.5 hover:shadow-sm transition-shadow">
      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", c.iconBg)}>
        <Icon className={cn("h-3.5 w-3.5", c.iconText)} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-foreground leading-tight truncate">{value}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PLANT OPERATIONAL CARD
═══════════════════════════════════════════════════════════════ */

function PlantOperationalCard({ plant, onClick }: { plant: PlantWithHealth; onClick: () => void }) {
  const uiStatus = resolveUiStatus(plant);
  const energyToday = plant.health?.energy_today_kwh || 0;
  const powerKwp = plant.installed_power_kwp || 0;
  const isOffline = uiStatus === "offline";
  const isStandby = uiStatus === "standby";

  const expectedDaily = powerKwp * 4.5;
  const perfPercent = expectedDaily > 0 ? Math.min(100, Math.round((energyToday / expectedDaily) * 100)) : 0;

  // Format power nicely
  const powerDisplay = powerKwp > 0
    ? powerKwp >= 1000
      ? `${(powerKwp / 1000).toFixed(1)} MWp`
      : `${Number(powerKwp.toFixed(2))} kWp`
    : "—";

  // Format energy nicely
  const energyDisplay = energyToday > 0
    ? energyToday >= 1000
      ? `${(energyToday / 1000).toFixed(1)} MWh`
      : `${Number(energyToday.toFixed(1))} kWh`
    : "0 kWh";

  // Format last seen
  const lastSeen = plant.health?.last_seen_at
    ? formatDistanceToNow(new Date(plant.health.last_seen_at), { addSuffix: false, locale: ptBR })
    : "—";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl border bg-card transition-all duration-200 group",
        "hover:shadow-md hover:-translate-y-0.5",
        isOffline && "border-l-[3px] border-l-destructive border-border/50",
        isStandby && "border-l-[3px] border-l-warning border-border/50",
        !isOffline && !isStandby && "border-border/50",
      )}
    >
      <div className="p-3.5 space-y-2.5">
        {/* Top: name + status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={cn("h-2 w-2 rounded-full shrink-0", UI_STATUS_DOT[uiStatus])} />
            <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {plant.name}
            </span>
            {isOffline && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
          </div>
          <StatusBadge status={UI_STATUS_LABELS[uiStatus]} size="sm" />
        </div>

        {/* Stats: clean grid */}
        <div className="grid grid-cols-3 gap-2">
          <StatCell label="Potência" value={powerDisplay} />
          <StatCell label="Hoje" value={energyDisplay} />
          <StatCell label="Atualização" value={lastSeen} />
        </div>

        {/* Performance bar */}
        {uiStatus === "online" && expectedDaily > 0 && (
          <div className="flex items-center gap-2">
            <Progress value={perfPercent} className="h-1.5 flex-1" />
            <span className={cn(
              "text-[11px] font-semibold tabular-nums w-8 text-right",
              perfPercent >= 70 ? "text-success" : perfPercent >= 40 ? "text-warning" : "text-destructive"
            )}>
              {perfPercent}%
            </span>
          </div>
        )}

        {/* Location + brand */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {plant.city && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              {plant.city}{plant.state ? `, ${plant.state}` : ""}
            </span>
          )}
          {plant.provider_name && (
            <span className="ml-auto px-1.5 py-0.5 rounded-md bg-muted text-[10px] capitalize shrink-0">
              {plant.provider_name}
            </span>
          )}
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 ml-auto shrink-0 group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  );
}

/* Small stat cell for plant card */
function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-lg px-2 py-1.5 text-center">
      <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
      <p className="text-xs font-bold text-foreground leading-tight truncate">{value}</p>
    </div>
  );
}
