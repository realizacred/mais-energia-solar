import { Eye, Pencil, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { Modulo } from "./types";
import { STATUS_LABELS } from "./types";

interface Props {
  modulo: Modulo;
  isGlobal: boolean;
  onView: () => void;
  onEdit: () => void;
  onToggle: (ativo: boolean) => void;
}

export function ModuloCard({ modulo: m, isGlobal, onView, onEdit, onToggle }: Props) {
  const statusInfo = STATUS_LABELS[m.status] || STATUS_LABELS.rascunho;

  return (
    <Card className="group relative hover:shadow-md transition-shadow">
      {/* Action icons top-right */}
      <div className="absolute top-3 right-3 flex gap-1 z-10">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView} title="Visualizar">
          <Eye className="w-4 h-4" />
        </Button>
        {!isGlobal && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Editar">
            <Pencil className="w-4 h-4" />
          </Button>
        )}
      </div>

      <CardContent className="pt-4 pb-3 px-4 space-y-3">
        {/* Header */}
        <div className="pr-16">
          <p className="text-xs text-muted-foreground">{m.fabricante}</p>
          <p className="font-semibold text-sm truncate" title={m.modelo}>{m.modelo}</p>
        </div>

        {/* Key specs */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1 font-mono text-xs">
            <Zap className="w-3 h-3" />{m.potencia_wp}W
          </Badge>
          {m.num_celulas && (
            <Badge variant="secondary" className="text-xs">{m.num_celulas} cells</Badge>
          )}
          {m.eficiencia_percent && (
            <Badge variant="secondary" className="text-xs">{m.eficiencia_percent}%</Badge>
          )}
        </div>

        {/* Technology badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-xs">{m.tipo_celula}</Badge>
          {m.bifacial && <Badge variant="outline" className="text-xs">Bifacial</Badge>}
          {m.tensao_sistema && (
            <Badge variant="outline" className="text-xs">{m.tensao_sistema}</Badge>
          )}
          <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
        </div>

        {/* Footer: active toggle */}
        <div className="flex items-center justify-between pt-1 border-t">
          <span className="text-xs text-muted-foreground">{m.ativo ? "Ativo" : "Inativo"}</span>
          <Switch
            checked={m.ativo}
            disabled={isGlobal}
            onCheckedChange={onToggle}
            className="scale-90"
          />
        </div>
      </CardContent>
    </Card>
  );
}
