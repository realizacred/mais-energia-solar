import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PlantWithHealth } from "@/services/monitoring/monitorTypes";
import type { PlantUiStatus } from "@/services/monitoring/plantStatusEngine";

interface Props {
  plants: PlantWithHealth[];
  onSelectPlant: (id: string) => void;
}

/* Use semantic CSS variable colors for map pins */
const STATUS_COLORS: Record<PlantUiStatus, string> = {
  online: "hsl(152, 82%, 30%)",
  standby: "hsl(35, 95%, 48%)",
  offline: "hsl(0, 84%, 40%)",
};

function resolveUiStatus(raw: string | undefined): PlantUiStatus {
  if (raw === "online") return "online";
  if (raw === "standby") return "standby";
  return "offline";
}

function createIcon(status: PlantUiStatus) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;
  return L.divIcon({
    className: "monitor-map-pin",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid hsl(0,0%,100%);box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function MonitorPlantsMap({ plants, onSelectPlant }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || plants.length === 0) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(map);

    const markers: L.Marker[] = [];

    plants.forEach((plant) => {
      if (plant.lat == null || plant.lng == null) return;
      const status = resolveUiStatus(plant.health?.status);
      const marker = L.marker([plant.lat, plant.lng], { icon: createIcon(status) })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:12px;font-family:Inter,sans-serif;">
            <strong>${plant.name}</strong><br/>
            ${plant.city || ""}${plant.state ? ` - ${plant.state}` : ""}<br/>
            ${plant.installed_power_kwp ? `${plant.installed_power_kwp} kWp` : ""}
          </div>`
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
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [plants, onSelectPlant]);

  return <div ref={mapRef} className="w-full h-full" style={{ minHeight: 400 }} />;
}
