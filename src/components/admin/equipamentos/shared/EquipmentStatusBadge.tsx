/**
 * Badge de status para equipamentos no catálogo.
 */
import { Badge } from "@/components/ui/badge";

interface EquipmentStatusBadgeProps {
  status: string;
  hasSpecs?: boolean;
}

export function EquipmentStatusBadge({ status, hasSpecs = false }: EquipmentStatusBadgeProps) {
  if (status === "publicado") {
    return (
      <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
        Publicado
      </Badge>
    );
  }

  if (status === "revisao") {
    return (
      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
        Aguardando revisão
      </Badge>
    );
  }

  // rascunho
  if (hasSpecs) {
    return (
      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
        Em revisão
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
      Sem specs
    </Badge>
  );
}
