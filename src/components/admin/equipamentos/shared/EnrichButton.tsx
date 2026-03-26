/**
 * Botão individual de enriquecimento via IA para um equipamento.
 * Usado em ModulosManager, InversoresManager, OtimizadoresManager.
 */
import { Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEnrichEquipment } from "@/hooks/useEnrichEquipment";

interface EnrichButtonProps {
  equipmentType: "modulo" | "inversor" | "otimizador";
  equipmentId: string;
  size?: "icon" | "sm";
}

export function EnrichButton({ equipmentType, equipmentId, size = "icon" }: EnrichButtonProps) {
  const enrichMutation = useEnrichEquipment();
  const isLoading = enrichMutation.isPending && enrichMutation.variables?.equipment_id === equipmentId;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isLoading}
            onClick={(e) => {
              e.stopPropagation();
              enrichMutation.mutate({ equipment_type: equipmentType, equipment_id: equipmentId });
            }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Wand2 className="w-4 h-4 text-primary" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Buscar specs via IA</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
