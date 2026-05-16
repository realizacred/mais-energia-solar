/**
 * ProjetoFinancialBadges
 * ---------------------------------------------------------------
 * Exibe três valores no header do projeto:
 *  - Valor comercial (deal.value)        — usado pelo Kanban/CRM
 *  - Valor contratado (vendas_transacional) — usado pelo financeiro
 *  - Valor recebido (recebimentos.total_pago)
 *
 * Mostra alerta discreto quando comercial difere do contratado.
 * NÃO sincroniza. NÃO escreve. Apenas leitura.
 */
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { useFinancialSummary } from "@/hooks/useFinancialSummary";
import { cn } from "@/lib/utils";

interface Props {
  dealId: string;
  projetoId?: string | null;
  valorComercial: number;
}

export function ProjetoFinancialBadges({ dealId, projetoId, valorComercial }: Props) {
  const { data } = useFinancialSummary(dealId, projetoId);
  const valorContratado = data?.valorContratado ?? 0;
  const valorRecebido = data?.valorRecebido ?? 0;
  const hasContrato = data?.hasContrato ?? false;

  const diverge =
    hasContrato &&
    valorComercial > 0 &&
    Math.abs(valorContratado - valorComercial) > 0.01;

  if (valorComercial <= 0 && !hasContrato) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {valorComercial > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-xs h-7 px-2.5 font-bold bg-primary/5 text-primary border-primary/20 cursor-help"
                >
                  Comercial: {formatBRL(valorComercial)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                Valor comercial vendido (CRM/Kanban).<br />
                Origem: <code>deals.value</code>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {hasContrato && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs h-7 px-2.5 font-semibold cursor-help",
                    diverge
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : "bg-muted/60 text-foreground border-border"
                  )}
                >
                  Contratado: {formatBRL(valorContratado)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                Valor contratado (financeiro).<br />
                Origem: <code>vendas_transacional.valor_total</code>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {(valorRecebido > 0 || hasContrato) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-xs h-7 px-2.5 font-semibold bg-success/10 text-success border-success/20 cursor-help"
                >
                  Recebido: {formatBRL(valorRecebido)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                Valor efetivamente recebido.<br />
                Origem: <code>recebimentos.total_pago</code>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {diverge && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-[10px] text-amber-700 cursor-help">
                <AlertCircle className="h-3 w-3" />
                Valor comercial difere do valor contratado.
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs max-w-xs bg-amber-50 text-amber-900 border-amber-200">
              O valor exibido no CRM ({formatBRL(valorComercial)}) não bate com o
              valor contratado no financeiro ({formatBRL(valorContratado)}).
              <br />
              <br />
              Nenhuma sincronização automática é executada. Comissões e forecast
              seguem o valor comercial.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
