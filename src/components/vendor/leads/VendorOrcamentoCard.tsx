import { Phone, Eye, Trash2, ShoppingCart, UserCheck, Calendar, MapPin, Zap, ExternalLink, FileText, AlertTriangle, Clock, CheckCircle, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
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
  onCreditRequest?: (lead: OrcamentoVendedor) => void;
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
  onCreditRequest,
  quickLoading,
}: VendorOrcamentoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
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
    <Card className={cn(cardBg, "overflow-hidden transition-all duration-200")}>
      <CardContent className="p-0">
        {/* Main Visible Area — Compact Row */}
        <div 
          className="p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <Checkbox
              checked={orcamento.visto}
              onCheckedChange={(checked) => {
                // Prevent expanding card when clicking checkbox
                onToggleVisto();
              }}
              onClick={(e) => e.stopPropagation()}
              className="data-[state=checked]:bg-success data-[state=checked]:border-success shrink-0 h-5 w-5"
            />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm sm:text-base truncate leading-tight">
                  {orcamento.nome}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {statusBadge}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px]">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="w-3 h-3 text-primary/70" />
                  <span className="truncate max-w-[80px]">{orcamento.cidade}</span>
                </div>
                
                <a 
                  href={`tel:${orcamento.telefone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-success font-medium hover:underline"
                >
                  <Phone className="w-3 h-3" />
                  <span>{formatPhoneBR(orcamento.telefone)}</span>
                </a>

                {!orcamento.proposta_token && (
                  <Badge variant="warning" className="h-4 px-1 text-[9px] animate-pulse leading-none">
                    SEM PROPOSTA
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Info Area */}
        {isExpanded && (
          <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Consumo / Geração</p>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-semibold">{orcamento.media_consumo} kWh</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Data de Cadastro</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs">{format(new Date(orcamento.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Código do Orçamento</p>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono opacity-70">
                  {orcamento.orc_code || "-"}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Status do Lead</p>
                <OrcamentoStatusSelector
                  orcamentoId={orcamento.id}
                  currentStatusId={orcamento.status_id}
                  statuses={statuses}
                  onStatusChange={onStatusChange}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {orcamento.proposta_token ? (
                <Badge className="bg-success/10 text-success border-success/20 h-6 px-2 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span className="text-[10px]">PROPOSTA OK</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="h-6 px-2 text-muted-foreground bg-muted/30 border-dashed">
                  <span className="text-[10px]">AGUARDANDO ORÇAMENTO</span>
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
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
                    Venda
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Orcamento
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
                Convertido
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-11 text-xs gap-2 font-semibold border-primary/30 text-primary hover:bg-primary/5"
              onClick={() => onCreditRequest?.(orcamento)}
            >
              <CreditCard className="w-4 h-4" />
              Crédito
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-10 gap-2 text-success hover:bg-success/10"
              onClick={() => window.open(`https://wa.me/55${orcamento.telefone.replace(/\D/g, '')}`, '_blank')}
            >
              <Phone className="w-4 h-4" />
              WhatsApp
            </Button>
            
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive/50 hover:text-destructive hover:bg-destructive/10 h-10 w-10 rounded-full shrink-0"
                onClick={onDelete}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
