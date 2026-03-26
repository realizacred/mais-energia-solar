import { Eye, Pencil, Zap, Globe, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { EnrichButton } from "../shared/EnrichButton";
import type { Modulo } from "./types";
import { STATUS_LABELS } from "./types";
import { calcCompletude } from "@/utils/calcCompletude";

interface Props {
  modulo: Modulo;
  isGlobal: boolean;
  onView: () => void;
  onEdit: () => void;
  onToggle: (ativo: boolean) => void;
  compareSelected?: boolean;
  onCompareToggle?: (checked: boolean) => void;
}

export function ModuloCard({ modulo: m, isGlobal, onView, onEdit, onToggle, compareSelected, onCompareToggle }: Props) {
  const statusInfo = STATUS_LABELS[m.status] || STATUS_LABELS.rascunho;
  const completude = calcCompletude(m);

  return (
    <Card className={`group relative border border-border hover:border-primary/30 hover:shadow-sm transition-all ${!m.ativo ? "opacity-50 grayscale" : ""}`}>
      {/* Action icons top-right */}
      <div className="absolute top-3 right-3 flex gap-1 z-10">
        <EnrichButton equipmentType="modulo" equipmentId={m.id} />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView} title="Visualizar">
          <Eye className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Editar">
          <Pencil className="w-4 h-4" />
        </Button>
      </div>

      {/* Compare checkbox */}
      {onCompareToggle && (
        <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <Checkbox
            checked={compareSelected}
            onCheckedChange={(v) => onCompareToggle(!!v)}
          />
        </div>
      )}

      <CardContent className="pt-4 pb-3 px-4 space-y-3">
        {/* Header */}
        <div className="pr-16">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{m.fabricante}</p>
            {isGlobal ? (
              <span title="Catálogo Global"><Globe className="w-3 h-3 text-muted-foreground" /></span>
            ) : (
              <span title="Personalizado"><Building2 className="w-3 h-3 text-primary" /></span>
            )}
          </div>
          <p className="font-semibold text-sm truncate" title={m.modelo}>{m.modelo}</p>
        </div>

        {/* Key specs */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1 font-mono text-xs bg-primary/10 text-primary border-primary/20">
            <Zap className="w-3 h-3" />{m.potencia_wp}W
          </Badge>
          {m.num_celulas && (
            <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">{m.num_celulas} cél.</Badge>
          )}
          {m.eficiencia_percent && (
            <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">{m.eficiencia_percent}%</Badge>
          )}
        </div>

        {/* Technology badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">{m.tipo_celula}</Badge>
          {m.bifacial && <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">Bifacial</Badge>}
          {m.tensao_sistema && (
            <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">{m.tensao_sistema}</Badge>
          )}
          <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
        </div>

        {/* Completude */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Completude</span>
            <span className={`text-xs font-medium ${completude === 100 ? "text-success" : completude >= 70 ? "text-warning" : "text-destructive"}`}>
              {completude}%
            </span>
          </div>
          <Progress
            value={completude}
            className="h-1.5"
          />
        </div>

        {/* Footer: active toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="text-xs text-muted-foreground">{m.ativo ? "Ativo" : "Inativo"}</span>
          <Switch
            checked={m.ativo}
            onCheckedChange={onToggle}
            className="scale-90"
          />
        </div>
      </CardContent>
    </Card>
  );
}
