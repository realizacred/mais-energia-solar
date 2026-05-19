import { useMemo } from "react";
import { formatNumberBR } from "@/lib/formatters";
import { 
  Zap, 
  MapPin, 
  MessageSquare, 
  Target, 
  Building2, 
  Info,
  Sun,
  Layout,
  Calculator,
  ArrowRight,
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
  const necessidade = (selectedLead as any)?.necessidade_cliente; // Fallback to extra field if exists

  if (!selectedLead) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      {/* BLOCO 1: CONTEXTO DO CLIENTE (Briefing) */}
      <Card className="lg:col-span-2 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Briefing Operacional</h3>
            <Badge variant="outline" className="ml-auto text-[10px] font-medium bg-background/50 border-primary/20">
              Origem: {selectedLead.source_type === "orcamento" ? "Orçamento" : "Lead"} #{selectedLead.lead_code}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Geração Desejada */}
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Target className="h-2.5 w-2.5" /> Geração Desejada
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-foreground">
                  {geracaoDesejada ? formatNumberBR(geracaoDesejada) : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground">kWh/mês</span>
              </div>
            </div>

            {/* Telhado */}
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Layout className="h-2.5 w-2.5" /> Tipo de Telhado
              </p>
              <Badge variant="secondary" className="text-[10px] h-5 font-bold bg-secondary/10 text-secondary border-secondary/20">
                {selectedLead.tipo_telhado || "Não informado"}
              </Badge>
            </div>

            {/* Localização */}
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5" /> Cidade/UF
              </p>
              <p className="text-xs font-semibold text-foreground truncate">
                {selectedLead.cidade || "—"} / {selectedLead.estado || "—"}
              </p>
            </div>

            {/* Rede / Fase */}
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Zap className="h-2.5 w-2.5" /> Rede / Fase
              </p>
              <p className="text-xs font-semibold text-foreground truncate">
                {selectedLead.rede_atendimento || "—"}
              </p>
            </div>
          </div>

          {/* Observação / Necessidade */}
          {(observacao || necessidade) && (
            <div className="mt-4 pt-3 border-t border-primary/10">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 h-5 w-5 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-3 w-3 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-warning uppercase tracking-tight mb-0.5">Observação do Cliente</p>
                  <p className="text-xs text-foreground/90 leading-relaxed italic line-clamp-2">
                    "{observacao || necessidade}"
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BLOCO 2: MOTOR DE DIMENSIONAMENTO (Cockpit) */}
      <Card className="border-secondary/20 bg-secondary/5 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded bg-secondary/10 flex items-center justify-center">
              <Calculator className="h-3.5 w-3.5 text-secondary" />
            </div>
            <h3 className="text-xs font-bold text-secondary uppercase tracking-wider">Cockpit Técnico</h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Consumo Total</span>
              <span className="text-sm font-bold text-foreground">{formatNumberBR(consumoTotal)} <span className="text-[10px] font-normal">kWh</span></span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Potência Atual</span>
              <Badge variant="outline" className="font-mono text-xs border-secondary/30 text-secondary">
                {potenciaKwp.toFixed(2)} kWp
              </Badge>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Geração Estimada</span>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-sm font-bold",
                  geracaoDesejada && Math.abs(estimativaCalculada - geracaoDesejada) < 50 ? "text-success" : "text-foreground"
                )}>
                  {formatNumberBR(estimativaCalculada)} 
                </span>
                <span className="text-[10px] text-muted-foreground">kWh/mês</span>
              </div>
            </div>

            <Separator className="bg-secondary/10" />

            {geracaoDesejada && geracaoDesejada > 0 && fatorGeracao > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="w-full h-8 text-[10px] gap-1.5 font-bold uppercase tracking-tight"
                      onClick={() => {
                        const ideal = Math.round((geracaoDesejada / fatorGeracao) * 100) / 100;
                        setPotenciaKwp(ideal);
                      }}
                    >
                      <Target className="h-3 w-3" />
                      Usar Geração Desejada ({formatNumberBR(geracaoDesejada)} kWh)
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-[10px]">Ajusta a potência para atingir {formatNumberBR(geracaoDesejada)} kWh/mês</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
