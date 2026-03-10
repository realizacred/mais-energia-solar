import React from "react";
import { WifiOff, Moon } from "lucide-react";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OfflineStandbySectionProps {
  plants: Array<{ id: string; name: string; health?: { status?: string; last_seen_at?: string | null } }>;
  navigate: (path: string) => void;
}

export function OfflineStandbySection({ plants, navigate }: OfflineStandbySectionProps) {
  const offlinePlants = plants.filter((p) => p.health?.status === "offline");
  const standbyPlants = plants.filter((p) => p.health?.status === "standby");

  if (offlinePlants.length === 0 && standbyPlants.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {offlinePlants.length > 0 && (
        <SectionCard title={`Offline (${offlinePlants.length})`} icon={WifiOff} variant="warning">
          <div className="space-y-1 max-h-[240px] overflow-y-auto">
            {offlinePlants.slice(0, 20).map((p) => (
              <Button
                key={p.id}
                variant="ghost"
                onClick={() => navigate(`/admin/monitoramento/usinas/${p.id}`)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg h-auto text-left"
              >
                <span className="text-sm text-foreground truncate">{p.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-xs text-muted-foreground font-normal">
                    {p.health?.last_seen_at
                      ? formatDistanceToNow(new Date(p.health.last_seen_at), { addSuffix: true, locale: ptBR })
                      : "sem dados"}
                  </span>
                </div>
              </Button>
            ))}
            {offlinePlants.length > 20 && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin/monitoramento/usinas?status=offline")} className="w-full text-xs text-primary font-medium">
                Ver todas ({offlinePlants.length})
              </Button>
            )}
          </div>
        </SectionCard>
      )}
      {standbyPlants.length > 0 && (
        <SectionCard title={`Standby (${standbyPlants.length})`} icon={Moon}>
          <div className="space-y-1 max-h-[240px] overflow-y-auto">
            {standbyPlants.slice(0, 20).map((p) => (
              <Button
                key={p.id}
                variant="ghost"
                onClick={() => navigate(`/admin/monitoramento/usinas/${p.id}`)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg h-auto text-left"
              >
                <span className="text-sm text-foreground truncate">{p.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-warning" />
                  <span className="text-xs text-muted-foreground font-normal">standby</span>
                </div>
              </Button>
            ))}
            {standbyPlants.length > 20 && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin/monitoramento/usinas?status=standby")} className="w-full text-xs text-primary font-medium">
                Ver todas ({standbyPlants.length})
              </Button>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
