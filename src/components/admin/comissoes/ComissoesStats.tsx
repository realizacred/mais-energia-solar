import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, Calendar, Users, AlertTriangle, Clock } from "lucide-react";

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
  const stats = [
    {
      label: "Total Comissões",
      value: formatCurrency(totalComissoes),
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Total Pago",
      value: formatCurrency(totalPago),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Pendente",
      value: formatCurrency(totalPendente),
      icon: Calendar,
      color: "text-orange-600",
      bgColor: "bg-orange-500/10",
    },
    {
      label: "Registros",
      value: quantidadeRegistros.toString(),
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {comissoesAtrasadas > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 col-span-2 md:col-span-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                  {comissoesAtrasadas} comissão(ões) pendente(s) há mais de 30 dias
                </p>
                <p className="text-xs text-orange-600/80">
                  Considere regularizar os pagamentos em atraso
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
