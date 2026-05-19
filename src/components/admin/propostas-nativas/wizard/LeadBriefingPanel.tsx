import { useMemo } from "react";
import { formatNumberBR } from "@/lib/formatters";
import { 
  Zap, 
  MapPin, 
  MessageSquare, 
  Target, 
  Layout,
  Calculator,
  ClipboardList
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWizardContext } from "./WizardContext";
import { cn } from "@/lib/utils";

/**
 * Premium Executive Briefing for the Proposal Wizard.
 * Unifies client context and sizing motor into a cockpit view.
 */
export function LeadBriefingPanel() {
  const { 
    selectedLead, 
    ucs, 
    potenciaKwp, 
    setPotenciaKwp,
    preDimensionamento 
  } = useWizardContext();

  const consumoTotal = useMemo(() => {
    return ucs.reduce((sum, uc) => {
      if (uc.grupo_tarifario === "A") {
        return sum + (uc.consumo_mensal_p || 0) + (uc.consumo_mensal_fp || 0);
      }
      return sum + (uc.consumo_mensal || 0);
    }, 0);
  }, [ucs]);

  const topologiaAtiva = preDimensionamento.topologias?.[0] || "tradicional";
  const fatorGeracao = preDimensionamento.topologia_configs?.[topologiaAtiva]?.fator_geracao || preDimensionamento.fator_geracao || 0;
  
  const estimativaCalculada = useMemo(() => {
    if (fatorGeracao > 0 && potenciaKwp > 0) {
      return Math.round(potenciaKwp * fatorGeracao);
    }
    return 0;
  }, [potenciaKwp, fatorGeracao]);

  const geracaoDesejada = selectedLead?.geracao_estimada_kwh;
  const observacao = selectedLead?.observacoes || selectedLead?.orc_observacoes;
  const necessidade = selectedLead?.necessidade_cliente;

  if (!selectedLead) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      {/* BLOCO 1: CONTEXTO DO CLIENTE (Briefing) - Compactado para 3 colunas */}
      <Card className="lg:col-span-3 border-primary/10 bg-gradient-to-br from-primary/[0.03] via-card to-card shadow-sm overflow-hidden">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-3 w-3 text-primary" />
            </div>
            <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider">Briefing Operacional</h3>
            <Badge variant="outline" className="ml-auto text-[9px] font-medium bg-background/50 border-primary/10 h-4 px-1.5">
              Origem: {selectedLead.source_type === "orcamento" ? "Orçamento" : "Lead"} #{selectedLead.lead_code}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
            {/* Geração Desejada */}
            <div className="space-y-0.5">
              <p className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                <Target className="h-2 w-2" /> Geração Desejada
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold text-foreground">
                  {geracaoDesejada ? formatNumberBR(geracaoDesejada) : "—"}
                </span>
                <span className="text-[9px] text-muted-foreground">kWh/mês</span>
              </div>
            </div>

            {/* Telhado */}
            <div className="space-y-0.5">
              <p className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                <Layout className="h-2 w-2" /> Telhado
              </p>
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-bold bg-secondary/10 text-secondary border-secondary/20">
                {selectedLead.tipo_telhado || "—"}
              </Badge>
            </div>

            {/* Localização */}
            <div className="space-y-0.5">
              <p className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                <MapPin className="h-2 w-2" /> Cidade/UF
              </p>
              <p className="text-xs font-semibold text-foreground truncate">
                {selectedLead.cidade || "—"} / {selectedLead.estado || "—"}
              </p>
            </div>

            {/* Rede / Fase */}
            <div className="space-y-0.5">
              <p className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                <Zap className="h-2 w-2" /> Rede / Fase
              </p>
              <p className="text-xs font-semibold text-foreground truncate">
                {selectedLead.rede_atendimento || "—"}
              </p>
            </div>
          </div>

          {/* Observação / Necessidade - Mais discreta */}
          {(observacao || necessidade) && (
            <div className="mt-2 pt-2 border-t border-primary/5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-start gap-1.5 cursor-help">
                      <div className="mt-0.5 h-4 w-4 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                        <MessageSquare className="h-2.5 w-2.5 text-warning" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold text-warning/80 uppercase tracking-tight mb-0">Observação do Cliente</p>
                        <p className="text-[11px] text-foreground/80 leading-tight italic line-clamp-1">
                          "{observacao || necessidade}"
                        </p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs italic">"{observacao || necessidade}"</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BLOCO 2: MOTOR DE DIMENSIONAMENTO (Cockpit) - 1 coluna lateral */}
      <Card className="border-secondary/20 bg-secondary/[0.03] shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-5 rounded bg-secondary/10 flex items-center justify-center">
              <Calculator className="h-3 w-3 text-secondary" />
            </div>
            <h3 className="text-[10px] font-bold text-secondary uppercase tracking-wider">Cockpit Técnico</h3>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">Consumo Total</span>
              <span className="text-xs font-bold text-foreground">{formatNumberBR(consumoTotal)} <span className="text-[9px] font-normal">kWh</span></span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">Potência</span>
              <Badge variant="outline" className="font-mono text-[10px] h-4 px-1 border-secondary/30 text-secondary">
                {potenciaKwp.toFixed(2)} kWp
              </Badge>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">Geração</span>
              <div className="flex items-center gap-1">
                <span className={cn(
                  "text-xs font-bold",
                  geracaoDesejada && Math.abs(estimativaCalculada - geracaoDesejada) < 50 ? "text-success" : "text-foreground"
                )}>
                  {formatNumberBR(estimativaCalculada)} 
                </span>
                <span className="text-[9px] text-muted-foreground">kWh</span>
              </div>
            </div>

            {geracaoDesejada && geracaoDesejada > 0 && fatorGeracao > 0 && (
              <Button 
                variant="secondary" 
                size="sm" 
                className="w-full h-6 text-[9px] gap-1 font-bold uppercase tracking-tight bg-secondary/10 hover:bg-secondary/20 text-secondary border-none"
                onClick={() => {
                  const ideal = Math.round((geracaoDesejada / fatorGeracao) * 100) / 100;
                  setPotenciaKwp(ideal);
                }}
              >
                <Target className="h-2.5 w-2.5" />
                Igualar Desejada
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
