import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, User, ArrowRight, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePendingValidations } from "@/hooks/usePendingValidations";

interface PendingValidationWidgetProps {
  onNavigate?: () => void;
}

export function PendingValidationWidget({ onNavigate }: PendingValidationWidgetProps) {
  const navigate = useNavigate();
  const { pendingCount, pendingItems, loading } = usePendingValidations();

  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate();
    } else {
      navigate("/admin/validacao");
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const totalValue = pendingItems.reduce(
    (acc, c) => acc + (c.simulacoes?.investimento_estimado || c.valor_projeto || 0),
    0
  );

  if (loading) return null;
  if (pendingCount === 0) return null;

  const recentItems = pendingItems.slice(0, 4);

  return (
    <Card className="border-l-4 border-l-warning">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            Vendas Aguardando Validação
          </CardTitle>
          <Badge variant="secondary" className="bg-warning/10 text-warning border-0 font-bold">
            {pendingCount}
          </Badge>
        </div>
        {totalValue > 0 && (
          <p className="text-sm text-muted-foreground">
            Valor total: <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Mini list */}
        <div className="space-y-2">
          {recentItems.map((item) => {
            const valor = item.simulacoes?.investimento_estimado || item.valor_projeto || 0;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.nome}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="truncate">{item.leads?.vendedor || "-"}</span>
                    <span>•</span>
                    <span>{format(new Date(item.created_at), "dd/MM", { locale: ptBR })}</span>
                  </div>
                </div>
                {valor > 0 && (
                  <div className="flex items-center gap-1 text-sm font-semibold text-foreground ml-3">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatCurrency(valor)}
                  </div>
                )}
              </div>
            );
          })}
          {pendingCount > 4 && (
            <p className="text-xs text-muted-foreground text-center">
              +{pendingCount - 4} mais pendentes
            </p>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleNavigate}
        >
          <CheckCircle className="h-4 w-4" />
          Validar Vendas
          <ArrowRight className="h-3.5 w-3.5 ml-auto" />
        </Button>
      </CardContent>
    </Card>
  );
}
