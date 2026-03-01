import React from "react";
import type { SolarPlant } from "@/services/monitoring/types";

interface Props {
  plants: SolarPlant[];
}

/**
 * Simple map showing plant locations using static pins.
 * Uses an iframe with OpenStreetMap for zero-dependency mapping.
 */
export function PlantsMap({ plants }: Props) {
  if (plants.length === 0) return null;

  // Calculate center and bounds
  const lats = plants.map((p) => Number(p.latitude));
  const lngs = plants.map((p) => Number(p.longitude));
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  // Simple list-based map view (no external dependency)
  return (
    <div className="space-y-3">
      <div className="rounded-lg overflow-hidden border border-border">
        <iframe
          title="Mapa de usinas"
          width="100%"
          height="350"
          style={{ border: 0 }}
          loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(...lngs) - 0.5}%2C${Math.min(...lats) - 0.5}%2C${Math.max(...lngs) + 0.5}%2C${Math.max(...lats) + 0.5}&layer=mapnik&marker=${centerLat}%2C${centerLng}`}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {plants.map((plant) => (
          <div
            key={plant.id}
            className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30 text-xs"
          >
            <div className="h-2 w-2 rounded-full bg-success shrink-0" />
            <span className="font-medium truncate">{plant.name || "Sem nome"}</span>
            <span className="text-muted-foreground ml-auto shrink-0">
              {Number(plant.latitude).toFixed(4)}, {Number(plant.longitude).toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
