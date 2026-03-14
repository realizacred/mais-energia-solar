import React, { useState } from "react";
import { WifiOff, Moon, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OfflineStandbySectionProps {
  plants: Array<{ id: string; name: string; health?: { status?: string; last_seen_at?: string | null } }>;
  navigate: (path: string) => void;
}

function PlantList({
  plants,
  navigate,
  isOffline,
}: {
  plants: Array<{ id: string; name: string; health?: { status?: string; last_seen_at?: string | null } }>;
  navigate: (path: string) => void;
  isOffline: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = plants.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const icon = isOffline ? WifiOff : Moon;
  const Icon = icon;
  const colorBg = isOffline ? "bg-destructive/10" : "bg-warning/10";
  const colorText = isOffline ? "text-destructive" : "text-warning";
  const borderColor = isOffline ? "border-l-destructive" : "border-l-warning";
  const badgeClass = isOffline
    ? "bg-destructive/5 text-destructive border-destructive/20"
    : "bg-warning/5 text-warning border-warning/20";
  const dotColor = isOffline ? "bg-destructive" : "bg-warning";
  const label = isOffline ? "Offline" : "Standby";

  return (
    <Card className={cn("border-l-[3px] bg-card shadow-sm", borderColor)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", colorBg)}>
              <Icon className={cn("w-3.5 h-3.5", colorText)} />
            </div>
            <span className="text-sm font-semibold text-foreground">
              {label} ({plants.length})
            </span>
          </div>
          <Badge variant="outline" className={cn("text-xs", badgeClass)}>
            {plants.length} usinas
          </Badge>
        </div>

        {/* Search */}
        <Input
          placeholder="Buscar usina..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs mb-2"
        />

        {/* List */}
        <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
          {filtered.slice(0, 30).map((p) => {
            const lastSeen = p.health?.last_seen_at;
            const timeLabel = lastSeen
              ? formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: ptBR })
              : "sem dados";
            const daysAgo = lastSeen
              ? (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24)
              : 999;

            return (
              <div
                key={p.id}
                onClick={() => navigate(`/admin/monitoramento/usinas/${p.id}`)}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
                  <span className="text-sm text-foreground truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("text-xs",
                    isOffline && daysAgo > 7 ? "text-destructive font-medium" : "text-muted-foreground"
                  )}>
                    {isOffline ? timeLabel : "standby"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/admin/monitoramento/usinas/${p.id}`);
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
          {filtered.length > 30 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/admin/monitoramento/usinas?status=${isOffline ? "offline" : "standby"}`)}
              className="w-full text-xs text-primary font-medium mt-1"
            >
              Ver todas ({filtered.length})
            </Button>
          )}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma usina encontrada</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function OfflineStandbySection({ plants, navigate }: OfflineStandbySectionProps) {
  const offlinePlants = plants.filter((p) => p.health?.status === "offline");
  const standbyPlants = plants.filter((p) => p.health?.status === "standby");

  if (offlinePlants.length === 0 && standbyPlants.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {offlinePlants.length > 0 && (
        <PlantList plants={offlinePlants} navigate={navigate} isOffline />
      )}
      {standbyPlants.length > 0 && (
        <PlantList plants={standbyPlants} navigate={navigate} isOffline={false} />
      )}
    </div>
  );
}
