import { useVendaFinanceSnapshot } from "@/hooks/useVendaFinanceSnapshot";
import { PaymentComposer } from "@/components/admin/vendas/PaymentComposer";
import type { PaymentItemInput } from "@/services/paymentComposition/types";
import { Wallet, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StepFinanceiroProps {
  valorVenda: number;
  paymentItems: PaymentItemInput[];
  onCompositionChange: (items: PaymentItemInput[]) => void;
}

export function StepFinanceiro({ 
  valorVenda, 
  paymentItems, 
  onCompositionChange 
}: StepFinanceiroProps) {
  const finance = useVendaFinanceSnapshot(valorVenda, paymentItems);

  return (
    <div className="space-y-6">
      <div className="bg-muted/30 p-4 rounded-lg border border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Valor do Contrato</p>
            <p className="text-2xl font-bold text-teal-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorVenda)}
            </p>
          </div>
        </div>
        
        {!finance.isValid && (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1.5 py-1 px-3">
            <AlertTriangle className="w-3.5 h-3.5" />
            Pagamento Incompleto
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Composição do Pagamento
          </p>
          <div className="text-xs text-muted-foreground">
            Alocado: <span className={finance.valorRestante === 0 ? "text-success font-bold" : "text-foreground font-medium"}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finance.totalAlocado)}
            </span>
          </div>
        </div>
        
        <PaymentComposer
          valorVenda={valorVenda}
          items={paymentItems}
          onItemsChange={onCompositionChange}
        />
      </div>

      {finance.errors.length > 0 && (
        <div className="p-3 rounded-md bg-destructive/5 border border-destructive/10">
          <ul className="list-disc list-inside space-y-1">
            {finance.errors.map((error, idx) => (
              <li key={idx} className="text-xs text-destructive font-medium">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
