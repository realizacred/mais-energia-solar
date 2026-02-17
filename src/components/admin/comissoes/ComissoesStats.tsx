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
      label: "Total comissões",
      value: formatCurrency(totalComissoes),
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/40 bg-primary/5",
    },
    {
      label: "Total pago",
      value: formatCurrency(totalPago),
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
      borderColor: "border-success/40 bg-success/5",
    },
    {
      label: "Pendente",
      value: formatCurrency(totalPendente),
      icon: Calendar,
      color: "text-warning",
      bgColor: "bg-warning/10",
      borderColor: "border-warning/40 bg-warning/5",
    },
    {
      label: "Registros",
      value: quantidadeRegistros.toString(),
      icon: Users,
      color: "text-info",
      bgColor: "bg-info/10",
      borderColor: "border-info/40 bg-info/5",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className={`rounded-xl border-2 ${stat.borderColor}`}>
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
        <Card className="rounded-xl border-2 border-warning/40 bg-warning/5 col-span-2 md:col-span-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/20">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-warning">
                  {comissoesAtrasadas} comissão(ões) pendente(s) há mais de 30 dias
                </p>
                <p className="text-xs text-warning/80">
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
