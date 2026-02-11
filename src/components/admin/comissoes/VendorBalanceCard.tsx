import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface VendorBalance {
  vendedor_id: string;
  vendedor_nome: string;
  total_comissoes: number;
  total_pago: number;
  saldo: number; // positive = credit (overpaid), negative = pending
}

interface VendorBalanceCardProps {
  balances: VendorBalance[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function VendorBalanceCard({ balances }: VendorBalanceCardProps) {
  // Filter to show only vendors with non-zero balance
  const vendorsWithCredits = balances.filter(b => b.saldo > 0);
  const vendorsWithPending = balances.filter(b => b.saldo < 0);

  const totalCredits = vendorsWithCredits.reduce((acc, b) => acc + b.saldo, 0);
  const totalPending = Math.abs(vendorsWithPending.reduce((acc, b) => acc + b.saldo, 0));

  if (balances.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Saldo por Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 pb-3 border-b">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Créditos</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totalCredits)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Pendente</p>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(totalPending)}</p>
          </div>
        </div>

        {/* Vendors with credits */}
        {vendorsWithCredits.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
               <TrendingUp className="h-3 w-3 text-success" />
              Créditos (Vale Antecipado)
            </p>
            {vendorsWithCredits.map((v) => (
              <div key={v.vendedor_id} className="flex justify-between items-center text-sm py-1 px-2 rounded bg-success/10">
                <span>{v.vendedor_nome}</span>
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                  +{formatCurrency(v.saldo)}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Vendors with pending */}
        {vendorsWithPending.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
               <TrendingDown className="h-3 w-3 text-warning" />
              Saldo Pendente
            </p>
            {vendorsWithPending.map((v) => (
              <div key={v.vendedor_id} className="flex justify-between items-center text-sm py-1 px-2 rounded bg-warning/10">
                <span>{v.vendedor_nome}</span>
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  {formatCurrency(Math.abs(v.saldo))}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {vendorsWithCredits.length === 0 && vendorsWithPending.length === 0 && (
          <p className="text-sm text-center text-muted-foreground py-2">
            Todos os consultores estão com saldo zerado
          </p>
        )}
      </CardContent>
    </Card>
  );
}
