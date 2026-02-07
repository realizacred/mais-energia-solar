import { useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ConsumptionChartProps {
  mediaConsumo: number;
  consumoPrevisto: number;
}

export default function ConsumptionChart({ mediaConsumo, consumoPrevisto }: ConsumptionChartProps) {
  const { mediaPercentage, previstoPercentage, changePercentage, isIncrease } = useMemo(() => {
    const maxValue = Math.max(mediaConsumo, consumoPrevisto);
    const mediaPercentage = (mediaConsumo / maxValue) * 100;
    const previstoPercentage = (consumoPrevisto / maxValue) * 100;
    const changePercentage = ((consumoPrevisto - mediaConsumo) / mediaConsumo) * 100;
    const isIncrease = changePercentage > 0;

    return { mediaPercentage, previstoPercentage, changePercentage, isIncrease };
  }, [mediaConsumo, consumoPrevisto]);

  return (
    <Card className="bg-gradient-to-br from-secondary/5 to-primary/5 border-0">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4 text-foreground font-semibold">
          <BarChart3 className="w-5 h-5 text-secondary" />
          Comparativo de Consumo
        </div>

        {/* Media Atual */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-secondary" />
              <span className="text-sm font-medium text-foreground">Média Atual</span>
            </div>
            <span className="text-sm font-bold text-secondary">
              {mediaConsumo.toLocaleString()} kWh
            </span>
          </div>
          <Progress value={mediaPercentage} className="h-3 bg-muted [&>div]:bg-secondary" />
        </div>

        {/* Consumo Previsto */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm font-medium text-foreground">Consumo Previsto</span>
            </div>
            <span className="text-sm font-bold text-primary">
              {consumoPrevisto.toLocaleString()} kWh
            </span>
          </div>
          <Progress value={previstoPercentage} className="h-3 bg-muted [&>div]:bg-primary" />
        </div>

        {/* Summary */}
        <div className="bg-card rounded-lg p-4 mt-4 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              {isIncrease ? (
                <TrendingUp className="w-4 h-4 text-primary" />
              ) : (
                <TrendingDown className="w-4 h-4 text-destructive" />
              )}
              Variação Prevista
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${isIncrease ? "text-primary" : "text-destructive"}`}>
                {isIncrease ? "+" : ""}
                {changePercentage.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {isIncrease ? "Aumento" : "Redução"}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
