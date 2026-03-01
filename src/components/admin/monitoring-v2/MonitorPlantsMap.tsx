import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PlantWithHealth, MonitorPlantStatus } from "@/services/monitoring/monitorTypes";

interface Props {
  plants: PlantWithHealth[];
  onSelectPlant: (id: string) => void;
}

const STATUS_COLORS: Record<MonitorPlantStatus, string> = {
  online: "#22c55e",
  alert: "#f59e0b",
  offline: "#ef4444",
  unknown: "#9ca3af",
};

function createIcon(status: MonitorPlantStatus) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;
  return L.divIcon({
    className: "monitor-map-pin",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function MonitorPlantsMap({ plants, onSelectPlant }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || plants.length === 0) return;

    // Clean up previous map
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
      const status = plant.health?.status || "unknown";
      const marker = L.marker([plant.lat, plant.lng], { icon: createIcon(status) })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:12px;">
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
