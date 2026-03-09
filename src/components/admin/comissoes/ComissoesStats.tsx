import { StatCard } from "@/components/ui-kit/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, Calendar, Users, AlertTriangle } from "lucide-react";

interface ComissoesStatsProps {
  totalComissoes: number;
  totalPago: number;
  totalPendente: number;
  quantidadeRegistros: number;
  comissoesAtrasadas: number;
  formatCurrency: (value: number) => string;
}

export function ComissoesStats({
  totalComissoes,
  totalPago,
  totalPendente,
  quantidadeRegistros,
  comissoesAtrasadas,
  formatCurrency,
}: ComissoesStatsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Total comissões"
          value={formatCurrency(totalComissoes)}
          color="primary"
        />
        <StatCard
          icon={DollarSign}
          label="Total pago"
          value={formatCurrency(totalPago)}
          color="success"
        />
        <StatCard
          icon={Calendar}
          label="Pendente"
          value={formatCurrency(totalPendente)}
          color="warning"
        />
        <StatCard
          icon={Users}
          label="Registros"
          value={quantidadeRegistros.toString()}
          color="info"
        />
      </div>

      {comissoesAtrasadas > 0 && (
        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {comissoesAtrasadas} comissão(ões) pendente(s) há mais de 30 dias
              </p>
              <p className="text-xs text-muted-foreground">
                Considere regularizar os pagamentos em atraso
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
