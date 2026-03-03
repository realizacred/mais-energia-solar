import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PlantWithHealth } from "@/services/monitoring/monitorTypes";
import { type PlantUiStatus, resolveHealthToUiStatus } from "@/services/monitoring/plantStatusEngine";

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

function createClusterIcon(count: number, worstStatus: PlantUiStatus) {
  const color = STATUS_COLORS[worstStatus];
  return L.divIcon({
    className: "monitor-cluster-pin",
    html: `
      <div style="
        width:36px;height:36px;border-radius:50%;
        background:${color};opacity:0.9;
        border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:12px;font-weight:700;font-family:Inter,sans-serif;
      ">${count}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
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

    // Inject pulse animation CSS
    const style = document.createElement("style");
    style.textContent = `@keyframes ping{0%{transform:scale(1);opacity:0.4}75%{transform:scale(1.8);opacity:0}100%{transform:scale(1.8);opacity:0}}`;
    document.head.appendChild(style);

    const markers: L.Marker[] = [];

    plants.forEach((plant) => {
      if (plant.lat == null || plant.lng == null) return;
      const status = resolveHealthToUiStatus(plant.health?.status);
      const energyToday = plant.health?.energy_today_kwh || 0;

      const marker = L.marker([plant.lat, plant.lng], { icon: createIcon(status) })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:12px;font-family:Inter,sans-serif;min-width:180px;line-height:1.6;">
            <strong style="font-size:13px;">${plant.name}</strong><br/>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${STATUS_COLORS[status]};margin-right:4px;vertical-align:middle;"></span>
            <span style="font-weight:600;">${status === "online" ? "Online" : status === "standby" ? "Standby" : "Offline"}</span><br/>
            ${plant.installed_power_kwp ? `⚡ ${plant.installed_power_kwp} kWp<br/>` : ""}
            🔋 Hoje: ${energyToday.toFixed(0)} kWh<br/>
            ${plant.city ? `📍 ${plant.city}${plant.state ? `/${plant.state}` : ""}<br/>` : ""}
            ${plant.health?.last_seen_at ? `🕐 ${new Date(plant.health.last_seen_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}` : ""}
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
      }
    };
  }, [plants, onSelectPlant]);

  return <div ref={mapRef} className="w-full h-full" style={{ minHeight: 450 }} />;
}
