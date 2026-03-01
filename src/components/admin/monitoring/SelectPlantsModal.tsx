import React, { useState } from "react";
import { FormModalTemplate } from "@/components/ui-kit/FormModalTemplate";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Sun, MapPin, Zap } from "lucide-react";
import type { DiscoveredPlant } from "@/services/monitoring/monitorService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plants: DiscoveredPlant[];
  providerLabel: string;
  saving: boolean;
  onConfirm: (selectedIds: string[]) => void;
}

export function SelectPlantsModal({ open, onOpenChange, plants, providerLabel, saving, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(plants.map((p) => p.external_id)));

  const toggleAll = () => {
    if (selected.size === plants.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(plants.map((p) => p.external_id)));
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "normal": return "Online";
      case "offline": return "Offline";
      case "alarm": return "Alarme";
      default: return s;
    }
  };

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={onOpenChange}
      title={`Selecionar Usinas — ${providerLabel}`}
      submitLabel={`Importar ${selected.size} usina${selected.size !== 1 ? "s" : ""}`}
      onSubmit={() => onConfirm(Array.from(selected))}
      disabled={selected.size === 0}
      saving={saving}
      className="max-w-lg"
    >
      <p className="text-sm text-muted-foreground">
        Selecione quais usinas deseja monitorar. Nas próximas sincronizações, apenas as selecionadas serão atualizadas.
      </p>

      {/* Select all toggle */}
      <div className="flex items-center gap-2 pb-1 border-b border-border">
        <Checkbox
          checked={selected.size === plants.length}
          onCheckedChange={toggleAll}
          id="select-all"
        />
        <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
          {selected.size === plants.length ? "Desmarcar todas" : "Selecionar todas"} ({plants.length})
        </label>
      </div>

      {/* Plant list */}
      <div className="max-h-80 overflow-y-auto space-y-1">
        {plants.map((plant) => (
          <label
            key={plant.external_id}
            className="flex items-start gap-3 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <Checkbox
              checked={selected.has(plant.external_id)}
              onCheckedChange={() => toggle(plant.external_id)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Sun className="h-3.5 w-3.5 text-warning shrink-0" />
                <span className="text-sm font-medium truncate">{plant.name}</span>
                <Badge
                  variant={plant.status === "normal" ? "default" : "secondary"}
                  className="text-2xs ml-auto shrink-0"
                >
                  {statusLabel(plant.status)}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-2xs text-muted-foreground">
                {plant.capacity_kw != null && (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {plant.capacity_kw.toFixed(1)} kW
                  </span>
                )}
                {plant.address && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3" />
                    {plant.address}
                  </span>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>

      {plants.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma usina encontrada nesta conta.
        </p>
      )}
    </FormModalTemplate>
  );
}
