import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listPlantsByClientId } from "@/services/monitoring/monitorService";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sun, Zap, ChevronRight } from "lucide-react";

interface Props {
  clientId: string;
}

export function ClientLinkedPlants({ clientId }: Props) {
  const navigate = useNavigate();
  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["client-linked-plants", clientId],
    queryFn: () => listPlantsByClientId(clientId),
    staleTime: 1000 * 60 * 5,
    enabled: !!clientId,
  });

  if (isLoading) return null;
  if (plants.length === 0) return null;

  return (
    <SectionCard title={`Usinas Vinculadas (${plants.length})`} icon={Sun}>
      <div className="space-y-2">
        {plants.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate(`/admin/monitoramento/usinas/${p.id}`)}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors text-left"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {p.installed_power_kwp && (
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                    {p.installed_power_kwp} kWp
                  </Badge>
                )}
                {p.city && (
                  <span className="text-xs text-muted-foreground truncate">{p.city}</span>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
