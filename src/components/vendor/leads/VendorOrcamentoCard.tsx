import { Phone, Eye, Trash2, ShoppingCart, UserCheck, Calendar, MapPin, Zap } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { OrcamentoStatusSelector } from "@/components/vendor/OrcamentoStatusSelector";
import type { LeadStatus } from "@/types/lead";
import type { OrcamentoVendedor } from "@/hooks/useOrcamentosVendedor";

interface VendorOrcamentoCardProps {
  orcamento: OrcamentoVendedor;
  statuses: LeadStatus[];
  isConverted: boolean;
  onToggleVisto: () => void;
  onView: () => void;
  onStatusChange: (newStatusId: string | null) => void;
  onDelete?: () => void;
  onConvert?: () => void;
}

export function VendorOrcamentoCard({
  orcamento,
  statuses,
  isConverted,
  onToggleVisto,
  onView,
  onStatusChange,
  onDelete,
  onConvert,
}: VendorOrcamentoCardProps) {
  const cardBg = orcamento.visto 
    ? "bg-green-50/50 dark:bg-green-950/10 border-green-200/50" 
    : isConverted 
      ? "bg-primary/5 border-primary/20" 
      : "";

  return (
    <Card className={cardBg}>
      <CardContent className="p-4 space-y-3">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Checkbox
              checked={orcamento.visto}
              onCheckedChange={onToggleVisto}
              className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate">{orcamento.nome}</span>
                {!orcamento.visto && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-xs shrink-0">
                    Novo
                  </Badge>
                )}
                {isConverted && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs shrink-0">
                    <UserCheck className="w-3 h-3 mr-1" />
                    Cliente
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-secondary hover:text-secondary"
            onClick={onView}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>

        {/* Codes Row */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="default" className="font-mono text-xs bg-primary">
            {orcamento.orc_code || "-"}
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            {orcamento.lead_code || "-"}
          </Badge>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <a 
            href={`https://wa.me/55${orcamento.telefone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="truncate">{orcamento.telefone}</span>
          </a>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
            <span className="truncate font-medium text-primary">{orcamento.cidade}, {orcamento.estado}</span>
          </div>
          <div className="flex flex-col gap-0.5 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>{orcamento.media_consumo} kWh</span>
            </div>
            <span className="text-xs ml-5">Geração: {orcamento.consumo_previsto} kWh</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>{format(new Date(orcamento.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        </div>

        {/* Status Selector */}
        <div className="pt-1">
          <OrcamentoStatusSelector
            orcamentoId={orcamento.id}
            currentStatusId={orcamento.status_id}
            statuses={statuses}
            onStatusChange={onStatusChange}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {onConvert && !isConverted && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-primary border-primary/30 hover:bg-primary/10"
              onClick={onConvert}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Converter
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
