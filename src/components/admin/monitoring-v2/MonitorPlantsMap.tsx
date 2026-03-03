import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PlantWithHealth } from "@/services/monitoring/monitorTypes";
import { type PlantUiStatus, resolveHealthToUiStatus, formatRelativeSeenAt } from "@/services/monitoring/plantStatusEngine";
import { cn } from "@/lib/utils";
import { Map, Satellite } from "lucide-react";

interface Props {
  plants: PlantWithHealth[];
  onSelectPlant: (id: string) => void;
}

const STATUS_COLORS: Record<PlantUiStatus, string> = {
  online: "hsl(152, 82%, 30%)",
  standby: "hsl(35, 95%, 48%)",
  offline: "hsl(0, 84%, 40%)",
};

function createIcon(status: PlantUiStatus) {
  const color = STATUS_COLORS[status];
  const pulse = status === "offline"
    ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ${color};opacity:0.4;animation:ping 2s infinite;"></div>`
    : "";
  return L.divIcon({
    className: "monitor-map-pin",
    html: `
      <div style="position:relative;width:18px;height:18px;">
        ${pulse}
        <div style="width:18px;height:18px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);position:relative;z-index:1;"></div>
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const TILE_LAYERS = {
  street: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    options: { maxZoom: 19, attribution: "© OpenStreetMap, © CARTO", subdomains: "abcd" },
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: { maxZoom: 19, attribution: "© Esri" },
  },
} as const;

type TileMode = keyof typeof TILE_LAYERS;

export function MonitorPlantsMap({ plants, onSelectPlant }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>("street");

  // Switch tile layer without recreating map
  useEffect(() => {
    if (!mapInstance.current) return;
    if (tileLayerRef.current) {
      mapInstance.current.removeLayer(tileLayerRef.current);
    }
    const cfg = TILE_LAYERS[tileMode];
    tileLayerRef.current = L.tileLayer(cfg.url, cfg.options).addTo(mapInstance.current);
  }, [tileMode]);

  useEffect(() => {
    if (!mapRef.current || plants.length === 0) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
      tileLayerRef.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    });

    const cfg = TILE_LAYERS[tileMode];
    tileLayerRef.current = L.tileLayer(cfg.url, cfg.options).addTo(map);

    // Inject pulse animation CSS
    const style = document.createElement("style");
    style.textContent = `@keyframes ping{0%{transform:scale(1);opacity:0.4}75%{transform:scale(1.8);opacity:0}100%{transform:scale(1.8);opacity:0}}`;
    document.head.appendChild(style);

    const markers: L.Marker[] = [];

    plants.forEach((plant) => {
      if (plant.lat == null || plant.lng == null) return;
      const status = resolveHealthToUiStatus(plant.health?.status);
      const energyToday = plant.health?.energy_today_kwh || 0;
      const seenLabel = formatRelativeSeenAt(plant.health?.last_seen_at, { addSuffix: true });

      const marker = L.marker([plant.lat, plant.lng], { icon: createIcon(status) })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:12px;font-family:Inter,sans-serif;min-width:180px;line-height:1.6;">
            <strong style="font-size:13px;">${plant.name}</strong><br/>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${STATUS_COLORS[status]};margin-right:4px;vertical-align:middle;"></span>
            <span style="font-weight:600;">${status === "online" ? "Online" : status === "standby" ? "Standby" : "Offline"}</span><br/>
            ${plant.installed_power_kwp ? `⚡ ${plant.installed_power_kwp.toFixed(1)} kWp<br/>` : ""}
            🔋 Hoje: ${energyToday.toFixed(0)} kWh<br/>
            ${plant.city ? `📍 ${plant.city}${plant.state ? `/${plant.state}` : ""}<br/>` : ""}
            ${plant.health?.last_seen_at ? `🕐 Visto ${seenLabel}` : ""}
          </div>`,
          { closeButton: false, className: "monitor-popup" }
        )
        .on("click", () => onSelectPlant(plant.id));
      markers.push(marker);
    });

    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    mapInstance.current = map;

    return () => {
      style.remove();
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        tileLayerRef.current = null;
      }
    };
  }, [plants, onSelectPlant]);

  return (
    <div className="relative w-full h-full" style={{ minHeight: 450 }}>
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: 450 }} />
      {/* Tile mode toggle */}
      <div className="absolute top-3 right-3 z-[1000] flex gap-1 p-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border/60 shadow-md">
        <button
          onClick={() => setTileMode("street")}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            tileMode === "street" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="Mapa"
        >
          <Map className="h-4 w-4" />
        </button>
        <button
          onClick={() => setTileMode("satellite")}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            tileMode === "satellite" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="Satélite"
        >
          <Satellite className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
