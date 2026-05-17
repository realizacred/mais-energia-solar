import { Phone, Eye, Trash2, ShoppingCart, UserCheck, Calendar, MapPin, Zap, ExternalLink, FileText, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhoneBR } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { OrcamentoStatusSelector } from "@/components/vendor/OrcamentoStatusSelector";
import { classifyOrcamentoOperationalStatus, getTerminalStatusIds } from "@/modules/orcamentos/utils/operationalFilters";
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
  onQuickProposal?: () => void;
  quickLoading?: boolean;
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
  onQuickProposal,
  quickLoading,
}: VendorOrcamentoCardProps) {
  const cardBg = orcamento.visto 
    ? "bg-success/5 border-success/20" 
    : isConverted 
      ? "bg-primary/5 border-primary/20" 
      : "";

  const opStatus = classifyOrcamentoOperationalStatus(orcamento, getTerminalStatusIds(statuses));
  
  const statusBadge = (() => {
    switch (opStatus) {
      case "urgente":
        return <Badge variant="destructive" className="text-[10px] h-4 px-1 gap-1"><AlertTriangle className="w-2.5 h-2.5" /> Urgente</Badge>;
      case "atencao":
        return <Badge variant="outline" className="text-[10px] h-4 px-1 gap-1 border-warning text-warning bg-warning/5"><Clock className="w-2.5 h-2.5" /> Pendente</Badge>;
      case "em_dia":
        return <Badge variant="outline" className="text-[10px] h-4 px-1 gap-1 border-success text-success bg-success/5"><CheckCircle className="w-2.5 h-2.5" /> Em dia</Badge>;
      default:
        return null;
    }
  })();

  return (
    <Card className={cardBg}>
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Checkbox
              checked={orcamento.visto}
              onCheckedChange={onToggleVisto}
              className="data-[state=checked]:bg-success data-[state=checked]:border-success shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col">
                <span className="font-bold text-sm sm:text-base truncate leading-tight">{orcamento.nome}</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {!orcamento.visto && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] h-4 px-1.5 shrink-0">
                      Novo
                    </Badge>
                  )}
                  {isConverted && (
                    <Badge variant="secondary" className="bg-success/10 text-success text-[10px] h-4 px-1.5 shrink-0">
                      <UserCheck className="w-2.5 h-2.5 mr-1" />
                      Cliente
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono opacity-70">
                    {orcamento.orc_code || "-"}
                  </Badge>
                  {statusBadge}
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={onView}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>

        {/* Info Grid - More compact on mobile */}
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <a 
            href={`https://wa.me/55${orcamento.telefone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary min-w-0"
          >
            <Phone className="w-3.5 h-3.5 shrink-0 text-success" />
            <span className="truncate">{formatPhoneBR(orcamento.telefone)}</span>
          </a>
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
            <span className="truncate font-medium">{orcamento.cidade}, {orcamento.estado}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span className="font-semibold">{orcamento.media_consumo} kWh</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{format(new Date(orcamento.created_at), "dd/MM/yy", { locale: ptBR })}</span>
          </div>
        </div>

        {/* Status + Proposta Status */}
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1">
            <OrcamentoStatusSelector
              orcamentoId={orcamento.id}
              currentStatusId={orcamento.status_id}
              statuses={statuses}
              onStatusChange={onStatusChange}
            />
          </div>
          {orcamento.proposta_token ? (
            <Badge className="bg-success/10 text-success border-success/20 h-7 px-2 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              <span className="text-[10px]">PROPOSTA OK</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="border-dashed h-7 px-2 flex items-center gap-1 text-muted-foreground bg-muted/30">
              <span className="text-[10px]">SEM PROPOSTA</span>
            </Badge>
          )}

          {orcamento.status_id && statuses.find(s => s.id === orcamento.status_id)?.nome.toLowerCase().includes('documentação') ? (
            <Badge variant="outline" className="border-warning/50 text-warning bg-warning/5 h-7 px-2 flex items-center gap-1">
              <span className="text-[10px]">DOC. PENDENTE</span>
            </Badge>
          ) : orcamento.status_id && statuses.find(s => s.id === orcamento.status_id)?.nome.toLowerCase().includes('validação') ? (
            <Badge variant="outline" className="border-primary/50 text-primary bg-primary/5 h-7 px-2 flex items-center gap-1">
              <span className="text-[10px]">EM VALIDAÇÃO</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="border-success/30 text-success/70 bg-success/5 h-7 px-2 flex items-center gap-1">
              <span className="text-[10px]">DOC OK</span>
            </Badge>
          )}

        </div>

        {/* Critical Actions — Phase 3: Single primary CTA */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          {!isConverted ? (
            <Button
              variant={orcamento.proposta_token ? "default" : "outline"}
              size="sm"
              className={cn(
                "flex-1 h-11 text-xs gap-2 font-bold transition-all shadow-sm",
                orcamento.proposta_token ? "bg-primary hover:bg-primary/90" : "text-muted-foreground"
              )}
              onClick={() => orcamento.proposta_token ? onConvert?.() : onView()}
            >
              {orcamento.proposta_token ? (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  Converter em Venda
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Gerar Orçamento Primeiro
                </>

              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-11 text-xs gap-2 font-semibold bg-success/5 text-success border-success/20"
              onClick={onView}
            >
              <UserCheck className="w-4 h-4" />
              Venda Convertida
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full text-success hover:bg-success/10 shrink-0"
            onClick={() => window.open(`https://wa.me/55${orcamento.telefone.replace(/\D/g, '')}`, '_blank')}
          >
            <Phone className="w-5 h-5" />
          </Button>
          
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive/50 hover:text-destructive hover:bg-destructive/10 h-11 w-11 rounded-full shrink-0"
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
