import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrationPlantsListProps {
  integrationId: string;
  provider: string;
}

export function IntegrationPlantsList({ integrationId, provider }: IntegrationPlantsListProps) {
  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["integration-plants", integrationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("solar_plants" as any)
        .select("id, name, external_id, capacity_kw, status, address")
        .eq("integration_id", integrationId)
        .order("name", { ascending: true });
      return (data as any[]) || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Carregando usinas...
      </div>
    );
  }

  if (plants.length === 0) {
    return (
      <p className="py-3 px-4 text-xs text-muted-foreground">
        Nenhuma usina importada ainda. Clique em Sincronizar para buscar usinas.
      </p>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    normal: "bg-success",
    offline: "bg-muted-foreground",
    alarm: "bg-destructive",
    no_communication: "bg-warning",
    unknown: "bg-muted-foreground/50",
  };

  return (
    <div className="border-t border-border/40 mt-2 pt-2">
      <p className="text-xs font-medium text-muted-foreground px-1 mb-2">
        {plants.length} usina{plants.length !== 1 ? "s" : ""} vinculada{plants.length !== 1 ? "s" : ""}
      </p>
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {plants.map((plant: any) => (
          <div
            key={plant.id}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors text-xs"
          >
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_COLORS[plant.status] || STATUS_COLORS.unknown)} />
            <span className="font-medium text-foreground truncate flex-1">{plant.name || "Sem nome"}</span>
            {plant.capacity_kw != null && plant.capacity_kw > 0 && (
              <span className="text-muted-foreground flex items-center gap-0.5 shrink-0">
                <Zap className="h-3 w-3" />
                {plant.capacity_kw} kWp
              </span>
            )}
            {plant.status && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full shrink-0",
                plant.status === "normal" ? "bg-success/10 text-success" :
                plant.status === "alarm" ? "bg-destructive/10 text-destructive" :
                "bg-muted text-muted-foreground"
              )}>
                {plant.status === "normal" ? "Online" :
                 plant.status === "offline" ? "Offline" :
                 plant.status === "alarm" ? "Alerta" :
                 plant.status === "no_communication" ? "Sem Com." : plant.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
